import WorkspaceUnavailable from '@/app/components/workspace-unavailable';
import {redirect} from 'next/navigation';
import {isConfigured} from '@/lib/supabase/server';
import {requireMembership} from '@/lib/supabase/authorization';
import {localStartDate} from '@/lib/domain/payroll';
import ManageClient from './manage-client';
export const dynamic='force-dynamic';
export default async function Manage({searchParams}:{searchParams:Promise<{view?:string;offset?:string}>}){
 if(!isConfigured())redirect('/login');const {client,membership}=await requireMembership();if(membership.role!=='admin')redirect('/workspace');
 const {view:requested,offset:rawOffset}=await searchParams,view=['teachers','classes','audit'].includes(requested??'')?requested!:'teachers';
 const offset=Math.max(0,Math.min(1000000,Number(rawOffset)||0));const {data,error}=await client.rpc('get_management',{p_offset:offset,p_limit:50});
 if(error||!data)return <WorkspaceUnavailable role="admin" page={view} title={view==='teachers'?'Teachers':view==='classes'?'Classes & assignments':'Activity log'} retry={'/workspace/manage?view='+view}/>;
 return <ManageClient view={view} {...data} offset={offset} today={localStartDate(new Date().toISOString())}/>;
}
