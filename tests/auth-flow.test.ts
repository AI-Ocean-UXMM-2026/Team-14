import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configurationError} from '../lib/supabase/config';

const require=createRequire(import.meta.url);
test('public Supabase configuration rejects missing, malformed and accidental credential URLs',()=>{
 assert.match(configurationError('', 'fictional')!,/not configured/);
 assert.match(configurationError('https://example.supabase.co','')!,/not configured/);
 for(const url of ['example.supabase.co','file:///etc/passwd','https://user:password@example.supabase.co','https://example.supabase.co/auth/v1','https://example.supabase.co?key=secret'])assert.match(configurationError(url,'fictional')!,/invalid/);
 assert.match(configurationError('https://example.supabase.co',' fictional ')!,/spaces/);
 assert.equal(configurationError('https://example.supabase.co','fictional'),undefined);
});

test('server login, school authorization and refresh-cookie contracts',async t=>{
 const dir=await mkdtemp(join(tmpdir(),'sayasync-auth-'));
 const previousUrl=process.env.NEXT_PUBLIC_SUPABASE_URL,previousKey=process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
 const state:any={};(globalThis as any).__sayasyncAuthTest=state;
 try{
 await build({stdin:{contents:`export {login} from './app/login/actions';export {requireMembership} from './lib/supabase/authorization';export {proxy} from './proxy';`,resolveDir:process.cwd()},bundle:true,format:'cjs',platform:'node',outfile:join(dir,'server.cjs'),write:true,plugins:[{name:'isolated-auth-adapters',setup(b){
  b.onResolve({filter:/^server-only$|^next\/headers$|^next\/navigation$|^@supabase\/ssr$/},args=>({path:args.path,namespace:'auth-test'}));
  b.onResolve({filter:/^next\/server$/},()=>({path:require.resolve('next/server'),external:true}));
  b.onLoad({filter:/.*/,namespace:'auth-test'},args=>({contents:args.path==='server-only'?'':args.path==='next/headers'?`export async function cookies(){return globalThis.__sayasyncAuthTest.cookies;}`:args.path==='next/navigation'?`export function redirect(path){throw new Error('REDIRECT:'+path);}`:`export function createServerClient(url,key,options){globalThis.__sayasyncAuthTest.options=options;return globalThis.__sayasyncAuthTest.client;}`}));
 }}]});
 const {login,requireMembership,proxy}=require(join(dir,'server.cjs'));
 const {NextRequest}=require('next/server');
 process.env.NEXT_PUBLIC_SUPABASE_URL='https://fictional.supabase.co';process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='fictional';
 const fields=(email='fictional@example.com',password='fictional-password')=>{const data=new FormData();data.set('email',email);data.set('password',password);return data;};
 const reset=()=>{state.cookies={getAll:()=>[],set(){}};state.client={auth:{signInWithPassword:async()=>({error:null}),getUser:async()=>({data:{user:{id:'fictional-user'}},error:null})}};};
 await t.test('missing configuration returns a useful error without authenticating',async()=>{reset();process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='';assert.match((await login({},fields())).message,/not configured/);process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY='fictional';});
 await t.test('invalid email never reaches the authentication service',async()=>{reset();state.client.auth.signInWithPassword=()=>{throw new Error('must not call');};assert.match((await login({},fields('bad-email'))).message,/valid email/);});
 await t.test('successful login trims email, preserves password and redirects outside the catch',async()=>{reset();let submitted:any;state.client.auth.signInWithPassword=async(value:any)=>{submitted=value;return {error:null};};await assert.rejects(login({},fields(' fictional@example.com ',' password with spaces ')),/REDIRECT:\/workspace/);assert.deepEqual(submitted,{email:'fictional@example.com',password:' password with spaces '});});
 for(const [error,expected] of [[{status:400,code:'invalid_credentials'},/incorrect/],[{status:429},/Too many/],[{status:503},/Unable to reach/],[{status:0},/Unable to reach/],[{status:400,code:'email_not_confirmed'},/Confirm your email/]] as const){await t.test('sign-in handles '+JSON.stringify(error),async()=>{reset();state.client.auth.signInWithPassword=async()=>({error});assert.match((await login({},fields())).message,expected);});}
 await t.test('unexpected connection failures stay on the form',async()=>{reset();state.client.auth.signInWithPassword=async()=>{throw new Error('private connection detail');};const result=await login({},fields());assert.match(result.message,/Unable to connect/);assert.doesNotMatch(result.message,/private/);});
 await t.test('unverified identities cannot query memberships',async()=>{reset();state.client.auth.getUser=async()=>({data:{user:null},error:{}});await assert.rejects(requireMembership(),/REDIRECT:\/login$/);});
 await t.test('membership query filters the authenticated user and active status',async()=>{reset();const filters:any[]=[];const query={select(){return query;},eq(...args:any[]){filters.push(args);return query;},async maybeSingle(){return {data:{id:'member',role:'admin',school_id:'school'},error:null};}};state.client.from=(table:string)=>{assert.equal(table,'memberships');return query;};assert.equal((await requireMembership()).membership.role,'admin');assert.deepEqual(filters,[['user_id','fictional-user'],['active',true]]);query.maybeSingle=async()=>({data:null,error:null}) as any;await assert.rejects(requireMembership(),/access-denied/);});
 await t.test('refresh cookies reach both the next server render and browser response',async()=>{reset();state.client.auth.getUser=async()=>{state.options.cookies.setAll([{name:'fictional-session',value:'refreshed',options:{httpOnly:true,sameSite:'lax',path:'/'}}]);return {data:{user:{id:'fictional'}},error:null};};const request=new NextRequest('https://example.test/workspace',{headers:{cookie:'fictional-session=expired'}});const response=await proxy(request);assert.equal(request.cookies.get('fictional-session').value,'refreshed');assert.equal(response.cookies.get('fictional-session').value,'refreshed');assert.equal(response.cookies.get('fictional-session').httpOnly,true);assert.equal(response.headers.get('Cache-Control'),'private, no-store');});
 await t.test('refresh outage leaves identity checks to the protected route',async()=>{reset();state.client.auth.getUser=async()=>{throw new Error('network failure');};const response=await proxy(new NextRequest('https://example.test/workspace'));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'private, no-store');});
 }finally{
 if(previousUrl===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_URL;else process.env.NEXT_PUBLIC_SUPABASE_URL=previousUrl;
 if(previousKey===undefined)delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;else process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=previousKey;
 delete (globalThis as any).__sayasyncAuthTest;await rm(dir,{recursive:true,force:true});
 }
});
