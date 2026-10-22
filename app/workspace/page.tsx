import {randomUUID} from 'node:crypto';
import WorkspaceUnavailable from '../components/workspace-unavailable';
import {redirect} from 'next/navigation';
import {isConfigured} from '@/lib/supabase/server';
import {requireMembership} from '@/lib/supabase/authorization';
import RecordsClient from './records-client';
export const dynamic='force-dynamic';
export default async function Workspace({searchParams}:{searchParams:Promise<{view?:string;q?:string;status?:string;review?:string;tab?:string;offset?:string;detail?:string}>}){
 if(!isConfigured())redirect('/login');
 const {client,membership}=await requireMembership();const admin=membership.role==='admin';
 const params=await searchParams;const view=(admin?['overview','sessions','reviews']:['home','sessions','reviews']).includes(params.view??'')?params.view!:(admin?'overview':'home');
 const query=params.q??'',status=params.status??'',review=params.review==='sessions'?'sessions':'corrections',tab=['pending','approved','rejected','withdrawn','all'].includes(params.tab??'')?params.tab!:'pending';
 const offset=Math.max(0,Math.min(1000000,Number(params.offset)||0));
 const {data,error}=await client.rpc('get_workspace',{p_view:view,p_query:query,p_status:status,p_review:review,p_tab:tab,p_offset:offset,p_limit:view==='overview'||view==='home'?5:50});
 if(error||!data)return <WorkspaceUnavailable role={admin?'admin':'teacher'} page={view} title="Teaching workspace" retry="/workspace"/>;
 return <RecordsClient initialDetail={params.detail} role={admin?'admin':'teacher'} view={view} {...data} assignments={data.assignments.map((a:{id:string})=>({...a,request_key:randomUUID()}))} paging={{total:data.total,offset:data.offset,limit:data.limit,record_ids:data.record_ids,query,status,review,tab}}/>;
}
