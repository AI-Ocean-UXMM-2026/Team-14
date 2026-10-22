import {redirect} from 'next/navigation';
import {isConfigured} from '@/lib/supabase/server';
import {requireMembership} from '@/lib/supabase/authorization';
import {localStartDate} from '@/lib/domain/payroll';
import ManageClient from './manage-client';
export const dynamic='force-dynamic';
export default async function Manage({searchParams}:{searchParams:Promise<{view?:string}>}){
 if(!isConfigured())redirect('/login');const {client,membership}=await requireMembership();if(membership.role!=='admin')redirect('/workspace');
 const {view:requested}=await searchParams,view=['teachers','classes','audit'].includes(requested??'')?requested!:'teachers';
 const results=await Promise.all([client.from('teachers').select('*').order('name').limit(100),client.from('classes').select('*').order('code').limit(100),client.from('teacher_rates').select('*').order('starts_at',{ascending:false}).limit(1000),client.from('teacher_assignments').select('*').order('starts_at',{ascending:false}).limit(1000),client.from('audit_events').select('id,action,entity_id,created_at,actor_id').order('created_at',{ascending:false}).limit(100)]);
 if(results.some(r=>r.error))return <main className="login-card"><h1>Workspace data unavailable</h1><p role="alert">Please retry or contact your administrator. No records have been changed.</p></main>;
 return <ManageClient view={view} teachers={results[0].data??[]} classes={results[1].data??[]} rates={results[2].data??[]} assignments={results[3].data??[]} audit={results[4].data??[]} today={localStartDate(new Date().toISOString())}/>;
}
