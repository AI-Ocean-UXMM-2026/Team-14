// Local-only component harness: actual authenticated views, fictional props, stubbed actions.
// It is never a Next.js route and is never published to Netlify.
import {build} from 'esbuild';
import {mkdir,writeFile} from 'node:fs/promises';
const out='/workspace/scratch/sayasync-ui-harness';await mkdir(out,{recursive:true});
await build({entryPoints:['tests/ui/harness.tsx'],bundle:true,outfile:out+'/harness.js',platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},plugins:[{name:'test-only-next-adapters',setup(b){b.onResolve({filter:/next\/navigation$/},()=>({path:'navigation',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`export function useRouter(){return {push(path){const url=new URL(path,location.origin);url.searchParams.set('screen',path.includes('/payroll')?'finance':path.includes('/manage')?'management':'records');if(new URLSearchParams(location.search).get('role')==='teacher')url.searchParams.set('role','teacher');location.href='/?'+url.searchParams;},refresh(){}}}` }));b.onResolve({filter:/\/actions$|^\.\/actions$/},args=>args.importer.includes('/app/')?{path:'actions',namespace:'actions'}:null);b.onLoad({filter:/.*/,namespace:'actions'},()=>({contents:`const fail=async()=>({ok:false,message:'This record changed. Refresh before editing again.'});export const mutateWorkspace=fail,mutatePayroll=fail,manageMaster=fail;export async function logout(){}` }));b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'link'}));b.onLoad({filter:/.*/,namespace:'link'},()=>({resolveDir:process.cwd(),contents:`import React from 'react';export default function Link(props){return React.createElement('a',props,props.children);}` }));}}]});
const styles=['styles','responsive','controls','theme-blue','refinements-v03','typography-accessibility','flows','live-review'].map(n=>`<link rel="stylesheet" href="/prototype/${n}.css">`).join('');
// Use the built application CSS, including Tailwind preflight and React adapters.
import {readdir} from 'node:fs/promises';
const css=(await readdir('.next/static/chunks')).filter(n=>n.endsWith('.css'));
await writeFile(out+'/index.html',`<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${css.map(n=>`<link rel="stylesheet" href="/_next/static/chunks/${n}">`).join('')}${styles}</head><body><div id="root"></div><script src="/harness.js"></script></body></html>`);
console.log('Built local component harness:',out);

import {symlink} from 'node:fs/promises';await mkdir(out+'/_next',{recursive:true});for(const [source,target] of [['public/prototype','prototype'],['.next/static','_next/static']]){try{await symlink(process.cwd()+'/'+source,out+'/'+target,'dir');}catch(e){if(e.code!=='EEXIST')throw e;}}
