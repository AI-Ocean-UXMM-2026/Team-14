import {randomUUID} from 'node:crypto';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {isConfigured} from '@/lib/supabase/server';
import {requireMembership} from '@/lib/supabase/authorization';
import {yangonInput} from '@/lib/domain/datetime';
import {logout} from '../login/actions';
import MutationForm from './mutation-form';
export const dynamic='force-dynamic';
const stamp=(value:string|null)=>value?new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Yangon',dateStyle:'medium',timeStyle:'short'}).format(new Date(value)):'No checkout';
export default async function Workspace(){
 if(!isConfigured())redirect('/login');
 const {client,membership}=await requireMembership();const admin=membership.role==='admin';
 const results=await Promise.all([
  client.from('teaching_sessions').select('*').order('effective_start',{ascending:false}).limit(50),
  client.from('teachers').select('id,name,active').order('name').limit(100),
  client.from('classes').select('id,code,subject,active').order('code').limit(100),
  client.from('teacher_assignments').select('id,teacher_id,class_id,starts_at,ends_at').lte('starts_at',new Date().toISOString()).or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`).limit(100),
  client.from('teaching_sessions').select('*').eq('capture_status','in_progress').order('effective_start',{ascending:false}).limit(100)
 ]);
 if(results.some(r=>r.error))return <main className="login-card"><h1>Unable to load your workspace</h1><p role="alert">School data could not be loaded. Please retry or contact your administrator. No changes have been made.</p><Link href="/workspace">Retry →</Link></main>;
 const [sessionResult,teacherResult,classResult,assignmentResult,openSessionResult]=results;
 const sessions=Array.from(new Map([...(openSessionResult.data??[]),...(sessionResult.data??[])].map(s=>[s.id,s])).values()),teachers=teacherResult.data??[],classes=classResult.data??[],assignments=assignmentResult.data??[];
 const ids=sessions.map(s=>s.id);
 const [correctionsResult,exceptionsResult,allocationsResult,reviewsResult]=ids.length?await Promise.all([
  client.from('correction_requests').select('*').in('session_id',ids).order('created_at',{ascending:false}),
  client.from('session_exceptions').select('*').in('session_id',ids),
  client.from('session_allocations').select('session_id').in('session_id',ids).eq('active',true),
  client.from('session_reviews').select('id,session_id,reviewed_version,result,reason,created_at').in('session_id',ids).order('created_at',{ascending:false})
 ]):[{data:[],error:null},{data:[],error:null},{data:[],error:null},{data:[],error:null}];
 if([correctionsResult,exceptionsResult,allocationsResult,reviewsResult].some(r=>r.error))return <main className="login-card"><h1>Review data unavailable</h1><p role="alert">Please retry before changing any records.</p><Link href="/workspace">Retry →</Link></main>;
 const teacherName=(id:string)=>teachers.find(t=>t.id===id)?.name??'Teacher';const className=(id:string)=>{const c=classes.find(c=>c.id===id);return c?`${c.code} · ${c.subject}`:'Class';};
 return <main className="real-workspace"><div className="workspace-heading"><div><Link className="brand" href="/">SayaSync</Link><p className="eyebrow">SCHOOL WORKSPACE · {admin?'ADMIN':'TEACHER'}</p><h1>Teaching records · သင်ကြားမှုမှတ်တမ်း</h1><p className="muted">Server-recorded teaching time. All displayed times use Asia/Yangon.</p></div><div><Link className="button" href="/workspace/payroll">{admin?'Payroll & payments':'My payments'}</Link><form action={logout}><button className="secondary">Sign out</button></form></div></div>
 {!admin&&<section className="panel workspace-panel"><h2>Assigned classes · တာဝန်ပေးထားသောအတန်းများ</h2>{assignments.filter(a=>teachers.some(t=>t.id===a.teacher_id&&t.active)&&classes.some(c=>c.id===a.class_id&&c.active)).map(a=><div className="assignment-row" key={a.id}><span>{className(a.class_id)}</span><MutationForm operation="check_in" entity={a.id} requestKey={randomUUID()} label="Check in"/></div>)}{assignments.length===0&&<p>No active assignments. Contact your administrator.</p>}<p className="muted">An unfinished session stays open until checkout or an approved correction. There is no automatic duration.</p></section>}
 {admin&&teachers.length>0&&classes.length>0&&<details className="panel workspace-panel"><summary>Add completed session on behalf of a teacher</summary><p className="muted">Requires explicit start/end dates and a reason. New entries start Pending review.</p><MutationForm operation="create_admin_session" entity={teachers[0].id} teachers={teachers.map(t=>({id:t.id,label:t.name}))} classes={classes.map(c=>({id:c.id,label:className(c.id)}))} requestKey={randomUUID()} dates reason reasonRequired label="Save completed session"/></details>}
 <p className="muted">Showing {sessions.length} sessions: the latest 50 plus any open sessions (up to 100 pilot teachers). Use Payroll & payments for calculation, approval and external payment records.</p>
 {sessions.length===0&&<section className="panel empty">No teaching sessions yet.</section>}
 {sessions.map(s=>{const corrections=(correctionsResult.data??[]).filter(c=>c.session_id===s.id),pending=corrections.find(c=>c.status==='pending'),exceptions=(exceptionsResult.data??[]).filter(e=>e.session_id===s.id),locked=(allocationsResult.data??[]).some(a=>a.session_id===s.id);return <section className="panel workspace-panel" key={`${s.id}-${s.version}`}><div className="workspace-heading"><div><h2>{teacherName(s.teacher_id)} · {className(s.class_id)}</h2><p className="muted">{s.capture_status} · {s.verification} · Version {s.version} · {s.source==='admin'?'Admin entry':'Teacher capture'}</p></div><span className={`badge ${locked?'hold':'good'}`}>{locked?'Payroll locked':s.verification}</span></div><dl className="time-grid"><div><dt>Original start</dt><dd>{stamp(s.original_start)}</dd></div><div><dt>Original end</dt><dd>{stamp(s.original_end)}</dd></div><div><dt>Effective start</dt><dd>{stamp(s.effective_start)}</dd></div><div><dt>Effective end</dt><dd>{stamp(s.effective_end)}</dd></div></dl>{s.entry_reason&&<p>Entry reason: {s.entry_reason}</p>}
 {!locked&&s.capture_status==='in_progress'&&!admin&&<MutationForm operation="check_out" entity={s.id} version={s.version} requestKey={randomUUID()} label="Check out"/>}
 {exceptions.map(e=><div className="flag-card" key={e.id}><b>{e.flag.replaceAll('_',' ')}</b><p>{e.resolved_at?`Resolved: ${e.resolution_reason}`:'This flag needs Admin review before verification.'}</p>{admin&&!locked&&!pending&&!e.resolved_at&&<MutationForm operation="resolve_exception" entity={e.id} version={s.version} requestKey={randomUUID()} reason reasonRequired label="Resolve flag"/>}</div>)}
 {pending&&<div className="correction-card"><h3>Pending correction · ပြင်ဆင်ရန်တောင်းဆိုချက်</h3><p>{stamp(pending.proposed_start)} → {stamp(pending.proposed_end)}</p><p>{pending.reason}</p><p className="muted">Payroll remains on hold until this request is resolved.</p>{!locked&&(admin?<><MutationForm operation="review_correction" entity={pending.id} version={s.version} requestKey={randomUUID()} decisions={['approved','rejected']} reason label="Save correction decision"/><MutationForm operation="withdraw_correction" entity={pending.id} version={s.version} requestKey={randomUUID()} label="Withdraw pending request"/></>:<MutationForm operation="withdraw_correction" entity={pending.id} version={s.version} requestKey={randomUUID()} label="Withdraw request"/>)}</div>}
 {!locked&&!pending&&s.capture_status!=='cancelled'&&<details><summary>Request time correction · အချိန်ပြင်ဆင်ရန်</summary><MutationForm operation="request_correction" entity={s.id} version={s.version} requestKey={randomUUID()} dates start={yangonInput(s.effective_start)} end={s.effective_end?yangonInput(s.effective_end):''} reason reasonRequired label="Request correction"/></details>}
 {admin&&!locked&&!pending&&s.capture_status==='completed'&&<details><summary>Review this session</summary><MutationForm operation="verify_session" entity={s.id} version={s.version} requestKey={randomUUID()} decisions={['verified','rejected']} reason label="Save session review"/></details>}
 {corrections.some(c=>c.status!=='pending')&&<details><summary>Correction history</summary>{corrections.filter(c=>c.status!=='pending').map(c=><article className="history-item" key={c.id}><b>{c.status}</b><p>{stamp(c.proposed_start)} → {stamp(c.proposed_end)}</p><p>{c.reason}</p>{c.decision_reason&&<p>Reviewer: {c.decision_reason}</p>}</article>)}</details>}
 {(reviewsResult.data??[]).some(r=>r.session_id===s.id)&&<details><summary>Verification history</summary>{(reviewsResult.data??[]).filter(r=>r.session_id===s.id).map(r=><p className="history-item" key={r.id}>{r.result} · Reviewed version {r.reviewed_version} · {stamp(r.created_at)}{r.reason&&` · ${r.reason}`}</p>)}</details>}
 </section>})}</main>;
}
