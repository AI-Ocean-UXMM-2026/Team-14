import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {readFile,readdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const exec=promisify(execFile);
const image='postgres:17-alpine@sha256:1bcc18d81671b02906296aad470ec9778a6b71016ce953092024b680bad007b0';
// Disposable database, no published ports, no network, no real user data or credentials.
test('PostgreSQL 17 multi-connection capture and review races',async t=>{
 const name='sayasync-test-'+randomUUID();
 const user=randomUUID(),admin=randomUUID(),school=randomUUID(),teacher=randomUUID(),classId=randomUUID(),assignment=randomUUID();
 const sql=(query:string,onOutput?:(chunk:string)=>void)=>new Promise<string>((resolve,reject)=>{
  const process=spawn('docker',['exec','-i',name,'psql','-h','127.0.0.1','-X','-qAt','-U','postgres','-v','ON_ERROR_STOP=1']);let output='',error='';
  process.stdout.on('data',data=>{const chunk=String(data);output+=chunk;onOutput?.(output);});process.stderr.on('data',data=>error+=String(data));process.on('error',reject);process.on('close',code=>code===0?resolve(output.trim()):reject(new Error(error.trim())));process.stdin.end(query);
 });
 const as=(who:string,query:string)=>`begin;set role authenticated;select set_config('request.jwt.claim.sub','${who}',true);${query};commit;`;
 const race=async(who:string,first:string,second:string)=>{
  let unlock!:()=>void;const locked=new Promise<void>(resolve=>unlock=resolve);
  const a=sql(as(who,`${first};select 'LOCK_HELD';select pg_sleep(0.4)`),chunk=>{if(chunk.includes('LOCK_HELD'))unlock();});
  // A failure before the sentinel must not hang the test.
  await Promise.race([locked,a.then(()=>{throw new Error('Missing lock sentinel');})]);
  const b=sql(as(who,second));return Promise.allSettled([a,b]);
 };
 try{
 await exec('docker',['run','--rm','-d','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust',image]);
 let ready=false;for(let i=0;i<60;i++){try{await exec('docker',['exec',name,'pg_isready','-h','127.0.0.1','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}assert.ok(ready,'PostgreSQL started');
 await sql(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const file of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await sql(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await sql(`insert into auth.users values('${user}'),('${admin}');insert into schools(id,name) values('${school}','Fictional concurrency school');insert into memberships(id,school_id,user_id,role) values('${user}','${school}','${user}','teacher'),('${admin}','${school}','${admin}','admin');insert into teachers(id,school_id,membership_id,code,name) values('${teacher}','${school}','${user}','A','Teacher A');insert into classes(id,school_id,code,subject) values('${classId}','${school}','MATH','Math');insert into teacher_assignments(id,school_id,teacher_id,class_id,starts_at,reason) values('${assignment}','${school}','${teacher}','${classId}','2020-01-01','Pilot');`);
 let session='';
 await t.test('parallel same-key check-in returns one original session',async()=>{
  const key=randomUUID();const query=`select check_in('${assignment}','${key}')`;const result=await race(user,query,query);assert.equal(result.filter(r=>r.status==='fulfilled').length,2);assert.equal(await sql('select count(*) from teaching_sessions'),'1');session=await sql('select id from teaching_sessions');assert.equal(await sql('select count(*) from audit_events'),'1');
 });
 await t.test('parallel checkout is idempotent with immutable original server end',async()=>{
  const key=randomUUID();const query=`select check_out('${session}',1,'${key}')`;const result=await race(user,query,query);assert.equal(result.filter(r=>r.status==='fulfilled').length,2);assert.equal(await sql('select version from teaching_sessions'),'2');assert.equal(await sql('select count(*) from audit_events'),'2');
 });
 let correction='';
 await t.test('parallel correction requests cannot overwrite the same base version',async()=>{
  const args=`'${session}',2`;const times=`'2026-10-12T09:00:00+06:30','2026-10-12T10:05:00+06:30','Forgot checkout'`;
  const result=await race(user,`select request_correction(${args},'${randomUUID()}',${times})`,`select request_correction(${args},'${randomUUID()}',${times})`);
  assert.equal(result[0].status,'fulfilled');assert.equal(result[1].status,'rejected');if(result[1].status==='rejected')assert.match(result[1].reason.message,/VERSION_CONFLICT/);assert.equal(await sql('select count(*) from correction_requests'),'1');correction=await sql('select id from correction_requests');
 });
 await t.test('parallel approve/reject has one audited winner',async()=>{
  const result=await race(admin,`select review_correction('${correction}',3,'${randomUUID()}','approved','Reviewed')`,`select review_correction('${correction}',3,'${randomUUID()}','rejected','Different decision')`);
  assert.equal(result[0].status,'fulfilled');assert.equal(result[1].status,'rejected');if(result[1].status==='rejected')assert.match(result[1].reason.message,/VERSION_CONFLICT/);assert.equal(await sql('select status from correction_requests'),'approved');assert.equal(await sql('select verification from teaching_sessions'),'pending');assert.equal(await sql("select count(*) from audit_events where action='review_correction'"),'1');
 });
 await t.test('parallel verification protects reviewed version',async()=>{
  const result=await race(admin,`select verify_session('${session}',4,'${randomUUID()}','verified','Reviewed')`,`select verify_session('${session}',4,'${randomUUID()}','rejected','Changed opinion')`);
  assert.equal(result[0].status,'fulfilled');assert.equal(result[1].status,'rejected');if(result[1].status==='rejected')assert.match(result[1].reason.message,/VERSION_CONFLICT/);assert.equal(await sql('select count(*) from session_reviews'),'1');assert.equal(await sql('select verification from teaching_sessions'),'verified');
 });
 await sql(`insert into teacher_rates(school_id,teacher_id,starts_at,hourly_mmk,reason,actor_id) values('${school}','${teacher}','2020-01-01',12000,'Pilot','${admin}');`);
 const firstRun=JSON.parse((await sql(as(admin,"select calculate_payroll('2026-10-12','2026-10-18','"+randomUUID()+"')"))).split('\n').at(-1)!);
 const secondRun=JSON.parse((await sql(as(admin,"select calculate_payroll('2026-10-12','2026-10-18','"+randomUUID()+"')"))).split('\n').at(-1)!);
 await t.test('rate mutation racing approval makes the waiting draft stale',async()=>{
  let notify!:()=>void;const locked=new Promise<void>(r=>notify=r);
  const sourceWrite=sql(`begin;update teacher_rates set version=version+1 where teacher_id='${teacher}';select 'RATE_LOCK_HELD';select pg_sleep(0.4);commit;`,chunk=>{if(chunk.includes('RATE_LOCK_HELD'))notify();});
  await Promise.race([locked,sourceWrite.then(()=>{throw new Error('Missing source lock sentinel');})]);
  const approval=sql(as(admin,`select approve_payroll('${firstRun.id}',${firstRun.version},'${randomUUID()}')`));
  const outcomes=await Promise.allSettled([sourceWrite,approval]);assert.equal(outcomes[0].status,'fulfilled');assert.equal(outcomes[1].status,'rejected');if(outcomes[1].status==='rejected')assert.match(outcomes[1].reason.message,/DRAFT_STALE/);
  for(const run of [firstRun,secondRun])Object.assign(run,JSON.parse((await sql(as(admin,`select recalculate_payroll('${run.id}',${run.version},'${randomUUID()}')`))).split('\n').at(-1)!));
 });
 await t.test('overlapping concurrent payroll approvals have one winner and allocation',async()=>{
  const result=await race(admin,`select approve_payroll('${firstRun.id}',${firstRun.version},'${randomUUID()}')`,`select approve_payroll('${secondRun.id}',${secondRun.version},'${randomUUID()}')`);
  assert.equal(result[0].status,'fulfilled');assert.equal(result[1].status,'rejected');if(result[1].status==='rejected')assert.match(result[1].reason.message,/DRAFT_STALE/);assert.equal(await sql('select count(*) from session_allocations where active'),'1');
 });
 const approvedVersion=Number(await sql(`select version from payroll_runs where id='${firstRun.id}'`));
 await t.test('parallel same-key payment requests return one fixed full payment',async()=>{
  const key=randomUUID();const query=`select record_payment('${firstRun.id}',${approvedVersion},'${key}','${teacher}','2026-10-22','cash','Receipt 001')`;
  const result=await race(admin,query,query);assert.equal(result.filter(r=>r.status==='fulfilled').length,2);assert.equal(await sql('select count(*) from payment_records'),'1');assert.equal(await sql('select amount_mmk from payment_records'),'13000');
 });
 await t.test('parallel reversal has one winner and preserves original payment',async()=>{
  const paymentId=await sql('select id from payment_records');
  const result=await race(admin,`select reverse_payment('${paymentId}',${approvedVersion},'${randomUUID()}','Wrong reference')`,`select reverse_payment('${paymentId}',${approvedVersion},'${randomUUID()}','Second attempt')`);
  assert.equal(result[0].status,'fulfilled');assert.equal(result[1].status,'rejected');if(result[1].status==='rejected')assert.match(result[1].reason.message,/VERSION_CONFLICT/);assert.equal(await sql('select count(*) from payment_records'),'1');assert.equal(await sql('select count(*) from payment_records where reversed_at is not null'),'1');
 });
 }finally{await exec('docker',['rm','-f',name]).catch(()=>{});}
});
