import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {isConfigured} from '@/lib/supabase/server';
import {requireMembership} from '@/lib/supabase/authorization';
import RecordsClient from './records-client';
export const dynamic='force-dynamic';
export default async function Workspace({searchParams}:{searchParams:Promise<{view?:string}>}){
 if(!isConfigured())redirect('/login');
 const {client,membership}=await requireMembership();const admin=membership.role==='admin';
 const results=await Promise.all([
  client.from('teaching_sessions').select('*').order('effective_start',{ascending:false}).limit(50),
  client.from('teachers').select('id,name,active').order('name').limit(100),
  client.from('classes').select('id,code,subject,active').order('code').limit(100),
  client.from('teacher_assignments').select('id,teacher_id,class_id,starts_at,ends_at').lte('starts_at',new Date().toISOString()).or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`).limit(100),
  client.from('teaching_sessions').select('*').in('capture_status',['in_progress','correction_hold']).order('effective_start',{ascending:false}).limit(100)
 ]);
 if(results.some(r=>r.error))return <main className="login-card"><h1>Unable to load your workspace</h1><p role="alert">School data could not be loaded. Please retry or contact your administrator. No changes have been made.</p><Link href="/workspace">Retry →</Link></main>;
 const [sessionResult,teacherResult,classResult,assignmentResult,openSessionResult]=results;
 const sessions=Array.from(new Map([...(openSessionResult.data??[]),...(sessionResult.data??[])].map(s=>[s.id,s])).values()).sort((a,b)=>Date.parse(b.effective_start)-Date.parse(a.effective_start)),teachers=teacherResult.data??[],classes=classResult.data??[],assignments=assignmentResult.data??[];
 const ids=sessions.map(s=>s.id);
 const [correctionsResult,exceptionsResult,allocationsResult,reviewsResult]=ids.length?await Promise.all([
  client.from('correction_requests').select('*').in('session_id',ids).order('created_at',{ascending:false}),
  client.from('session_exceptions').select('*').in('session_id',ids),
  client.from('session_allocations').select('session_id').in('session_id',ids).eq('active',true),
  client.from('session_reviews').select('id,session_id,reviewed_version,result,reason,created_at').in('session_id',ids).order('created_at',{ascending:false})
 ]):[{data:[],error:null},{data:[],error:null},{data:[],error:null},{data:[],error:null}];
 if([correctionsResult,exceptionsResult,allocationsResult,reviewsResult].some(r=>r.error))return <main className="login-card"><h1>Review data unavailable</h1><p role="alert">Please retry before changing any records.</p><Link href="/workspace">Retry →</Link></main>;
 const {view}=await searchParams;
 return <RecordsClient role={admin?'admin':'teacher'} view={view??(admin?'overview':'home')} sessions={sessions} teachers={teachers} classes={classes} assignments={assignments.map(a=>({...a,request_key:randomUUID()}))} corrections={correctionsResult.data??[]} exceptions={exceptionsResult.data??[]} allocations={allocationsResult.data??[]} reviews={reviewsResult.data??[]}/>;
}
