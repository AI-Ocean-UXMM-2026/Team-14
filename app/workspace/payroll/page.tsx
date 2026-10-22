import {randomUUID} from 'node:crypto';
import {redirect} from 'next/navigation';
import {isConfigured} from '@/lib/supabase/server';
import {requireMembership} from '@/lib/supabase/authorization';
import {localStartDate} from '@/lib/domain/payroll';
import PayrollClient from './payroll-client';
import WorkspaceUnavailable from '@/app/components/workspace-unavailable';
export const dynamic='force-dynamic';
export default async function Payroll({searchParams}:{searchParams:Promise<{run?:string;view?:string;status?:string;period?:string;offset?:string;history?:string}>}){
 if(!isConfigured())redirect('/login');const {client,membership}=await requireMembership();const admin=membership.role==='admin',params=await searchParams,paymentsView=!admin||params.view==='payments',status=['all','paid','unpaid'].includes(params.status??'')?params.status!:'all',offset=Math.max(0,Math.min(1000000,Number(params.offset)||0)),history=Math.max(0,Math.min(1000000,Number(params.history)||0));
 const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);const period=params.period&&uuid(params.period)?params.period:'';
 const unavailable=<WorkspaceUnavailable role={admin?'admin':'teacher'} page={paymentsView?'payments':'payroll'} title={paymentsView?admin?'Payments':'My payments':'Teacher payroll'} retry={paymentsView?'/workspace/payroll?view=payments':'/workspace/payroll'}/>;
 if(paymentsView){const {data,error}=await client.rpc('get_payment_register',{p_status:status,p_run:period||null,p_offset:offset,p_limit:50});if(error||!data)return unavailable;return <PayrollClient admin={admin} paymentsView runs={[]} detail={null} teachers={[]} register={data} status={status} period={period} offset={offset} today={localStartDate(new Date().toISOString())} requestKey={randomUUID()} historyOffset={0} hasMoreRuns={false}/>;}
 const [runsResult,teachersResult,navResult]=await Promise.all([client.from('payroll_runs').select('id,starts_on,ends_on,status,version,revision,policy_version,total_mmk,approved_at,void_reason').order('starts_on',{ascending:false}).order('id').range(history,history+50),client.from('teachers').select('id,name,code').order('name'),client.rpc('get_navigation_count')]);
 if(runsResult.error||teachersResult.error||navResult.error)return unavailable;
 const runs=(runsResult.data??[]).slice(0,50),selected=params.run&&uuid(params.run)?params.run:runs[0]?.id;let detail=null;
 if(params.run&&!uuid(params.run))return unavailable;
 if(selected){const response=await client.rpc('get_payroll_detail',{p_run_id:selected});if(response.error)return unavailable;detail=response.data;if(!runs.some(r=>r.id===selected))runs.unshift(detail.run);}
 return <PayrollClient navCount={navResult.data??0} admin paymentsView={false} runs={runs} detail={detail} teachers={teachersResult.data??[]} register={null} status="all" period="" offset={0} today={localStartDate(new Date().toISOString())} requestKey={randomUUID()} historyOffset={history} hasMoreRuns={(runsResult.data?.length??0)>50}/>;
}
