import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
const school='10000000-0000-0000-0000-000000000001';
const userA='20000000-0000-0000-0000-000000000001',userB='20000000-0000-0000-0000-000000000002',admin='20000000-0000-0000-0000-000000000003';
const teacherA='30000000-0000-0000-0000-000000000001',teacherB='30000000-0000-0000-0000-000000000002';
const assignment='40000000-0000-0000-0000-000000000001', classId='50000000-0000-0000-0000-000000000001';
test('migrations, ownership RLS, capture retries, and deactivation',async t=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$; grant usage on schema auth to authenticated; grant execute on function auth.uid() to authenticated;`);
 for(const file of (await readdir(new URL('../supabase/migrations/',import.meta.url))).filter(f=>f.endsWith('.sql')).sort())await db.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
 await db.exec(`insert into auth.users values('${userA}'),('${userB}'),('${admin}'); insert into schools(id,name) values('${school}','Fictional school'); insert into memberships(id,school_id,user_id,role) values('${userA}','${school}','${userA}','teacher'),('${userB}','${school}','${userB}','teacher'),('${admin}','${school}','${admin}','admin'); insert into teachers(id,school_id,membership_id,code,name) values('${teacherA}','${school}','${userA}','A','Teacher A'),('${teacherB}','${school}','${userB}','B','Teacher B'); insert into classes(id,school_id,code,subject) values('${classId}','${school}','MATH','Math'); insert into teacher_assignments(id,school_id,teacher_id,class_id,starts_at,reason) values('${assignment}','${school}','${teacherA}','${classId}','2020-01-01','Pilot');`);
 const asUser=async(id:string)=>{await db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${id}',false);`);};
 await t.test('Teacher A cannot read Teacher B',async()=>{await asUser(userA);const {rows}=await db.query('select id from teachers');assert.deepEqual(rows,[{id:teacherA}]);});
 await t.test('teacher cannot read raw rate history',async()=>{
 await db.exec(`reset role; insert into teacher_rates(school_id,teacher_id,starts_at,hourly_mmk,reason,actor_id) values('${school}','${teacherA}','2020-01-01',12000,'Initial rate','${admin}')`);
 await asUser(userA);assert.equal((await db.query('select * from teacher_rates')).rows.length,0);
 });
 await t.test('direct writes are denied',async()=>{await assert.rejects(db.exec(`update memberships set role='admin'`),/permission denied/);});
 let sessionId='';
 await t.test('check-in is idempotent and server timed',async()=>{const key='60000000-0000-0000-0000-000000000001';const result=await db.query<{s:{id:string;original_start:string}}>(`select check_in('${assignment}','${key}') s`);sessionId=result.rows[0].s.id;assert.ok(Math.abs(Date.now()-Date.parse(result.rows[0].s.original_start))<10000);const retry=await db.query(`select check_in('${assignment}','${key}') s`);assert.deepEqual(retry.rows,result.rows);await assert.rejects(db.exec(`select check_in('${assignment}','60000000-0000-0000-0000-000000000002')`),/OPEN_SESSION_EXISTS/);});
 await t.test('Teacher B cannot check out A session',async()=>{await asUser(userB);await assert.rejects(db.exec(`select check_out('${sessionId}',1,'60000000-0000-0000-0000-000000000003')`),/ACCESS_DENIED/);});
 await t.test('checkout retries return original result; changed request conflicts',async()=>{await asUser(userA);const key='60000000-0000-0000-0000-000000000004';const result=await db.query(`select check_out('${sessionId}',1,'${key}') s`);const retry=await db.query(`select check_out('${sessionId}',1,'${key}') s`);assert.deepEqual(retry.rows,result.rows);await assert.rejects(db.exec(`select check_out('${sessionId}',2,'${key}')`),/VERSION_CONFLICT/);});
 await t.test('audit and capture commit together',async()=>{await asUser(admin);const {rows}=await db.query<{count:number}>('select count(*)::int count from audit_events');assert.equal(rows[0].count,2);});
 await t.test('inactive teacher profile retains history but cannot start teaching',async()=>{
 await db.exec(`reset role; update teachers set active=false where id='${teacherA}'`);await asUser(userA);
 assert.equal((await db.query('select * from teaching_sessions')).rows.length,1);
 await assert.rejects(db.exec(`select check_in('${assignment}','60000000-0000-0000-0000-000000000005')`),/ACCESS_DENIED/);
 });
 await t.test('stale token denied after membership deactivation',async()=>{await db.exec(`reset role; update memberships set active=false where user_id='${userA}'`);await asUser(userA);assert.equal((await db.query('select * from teaching_sessions')).rows.length,0);await assert.rejects(db.exec(`select check_in('${assignment}','60000000-0000-0000-0000-000000000001')`),/ACCESS_DENIED/);});
 } finally {await db.close();}
});
