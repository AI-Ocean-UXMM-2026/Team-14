'use server';
import {revalidatePath} from 'next/cache';
import {requireMembership} from '@/lib/supabase/authorization';
import {payrollDate,signedMmk} from '@/lib/domain/payroll-input';
export type PayrollActionState={ok:boolean;message:string;runId?:string};
const errors:Record<string,string>={ACCESS_DENIED:'You do not have permission to perform this action.',VERSION_CONFLICT:'This record or request changed. Refresh and review the latest version.',DRAFT_STALE:'Source records changed after calculation. Recalculate and review before approval.',PAYROLL_LOCKED:'Approved or void payroll cannot be edited.',NEGATIVE_NET:'A teacher has a negative net amount. Correct the adjustment before approval.',EMPTY_PAYROLL:'There are no payable lines or adjustments to approve.',PAYMENT_EXISTS:'An active payment already exists for this teacher.',PAYMENT_HISTORY_EXISTS:'A run with any payment history cannot be voided, even after reversal.',REASON_REQUIRED:'Enter a reason.',INVALID_REASON:'Keep the reason under 2,000 characters.',INVALID_PERIOD:'Choose valid dates in order, covering at most 367 days.',INVALID_AMOUNT:'Enter a whole MMK amount within the supported range.',PAYMENT_DETAILS_REQUIRED:'Enter the actual payment date, method, and reference or receipt note.',AMOUNT_OVERFLOW:'The amount exceeds the supported range.',INVALID_STATE:'This action is unavailable for this payroll state.',IMMUTABLE_SNAPSHOT:'Approved financial snapshots cannot be changed.'};
const uuid=(value:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function mutatePayroll(_previous:PayrollActionState,form:FormData):Promise<PayrollActionState>{
 const {client,membership}=await requireMembership();
 if(membership.role!=='admin')return {ok:false,message:errors.ACCESS_DENIED};
 const text=(key:string)=>String(form.get(key)??'');
 const op=text('operation'),entity=text('entity'),key=text('key'),reason=text('reason'),version=Number(text('version'));
 if(!uuid(key)||reason.length>2000)return {ok:false,message:'Invalid request. Refresh and try again.'};
 let args:Record<string,unknown>;
 try{
  if(op==='calculate_payroll')args={p_start:payrollDate(text('start')),p_end:payrollDate(text('end')),p_idempotency_key:key};
  else{
   if(!uuid(entity)||!Number.isSafeInteger(version)||version<1)throw new Error('VERSION_CONFLICT');
   const common={p_run_id:entity,p_expected_version:version,p_idempotency_key:key};
   switch(op){
    case 'recalculate_payroll':case 'approve_payroll':args=common;break;
    case 'void_payroll':args={...common,p_reason:reason};break;
    case 'set_payroll_adjustment':
     if(!uuid(text('teacher_id')))throw new Error('ACCESS_DENIED');
     args={...common,p_teacher_id:text('teacher_id'),p_amount:signedMmk(text('amount')),p_reason:reason,p_reference:text('reference')};break;
    case 'record_payment':
     if(!uuid(text('teacher_id')))throw new Error('ACCESS_DENIED');
     args={...common,p_teacher_id:text('teacher_id'),p_paid_on:payrollDate(text('paid_on')),p_method:text('method'),p_reference:text('reference')};break;
    case 'reverse_payment':args={p_payment_id:entity,p_expected_version:version,p_idempotency_key:key,p_reason:reason};break;
    default:throw new Error('ACCESS_DENIED');
   }
  }
  const {data,error}=await client.rpc(op,args);
  if(error){const code=Object.keys(errors).find(code=>error.message.includes(code));return {ok:false,message:code?errors[code]:'Unable to save. Your input is retained. Retry the original request; contact your administrator if this persists.'};}
  revalidatePath('/workspace/payroll');revalidatePath('/workspace');
  return {ok:true,message:op==='record_payment'?'External payment recorded. No bank transfer was executed.':op==='reverse_payment'?'Payment record reversed. No money was transferred.':'Saved successfully.',runId:op==='calculate_payroll'?data?.id:undefined};
 }catch(error){return {ok:false,message:errors[error instanceof Error?error.message:'']??'Unable to save. Your input is retained.'};}
}
