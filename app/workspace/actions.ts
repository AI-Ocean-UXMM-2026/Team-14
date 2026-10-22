'use server';
import {revalidatePath} from 'next/cache';
import {requireMembership} from '@/lib/supabase/authorization';
import {yangonTimestamp} from '@/lib/domain/datetime';
export type MutationState={ok:boolean;message:string};
const messages:Record<string,string>={SESSION_OVERLAP:'These times overlap another recorded or requested class. Check the dates and times.',ACCESS_DENIED:'You do not have permission to change this record.',VERSION_CONFLICT:'This record changed. Refresh and review the latest version before trying again.',PAYROLL_LOCKED:'This session belongs to approved payroll and cannot be changed.',REASON_REQUIRED:'Please enter a reason.',INVALID_REASON:'Use a reason of up to 2,000 characters.',INVALID_INTERVAL:'Enter valid start and end dates/times, with end after start.',PENDING_CORRECTION_EXISTS:'A pending correction must be reviewed or withdrawn first.',INCOMPLETE_SESSION:'Complete the session or approve a correction before verification.',UNRESOLVED_EXCEPTION:'Resolve all session flags with a reason before verification.',ASSIGNMENT_MISMATCH:'Review and resolve the assignment mismatch first.',UNRESOLVED_OVERLAP:'Review the overlapping session flag first.',OPEN_SESSION_EXISTS:'You already have an open teaching session.',INVALID_STATE:'This action is not available for the current session.',INVALID_DECISION:'Choose a valid review decision.'};
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export async function mutateWorkspace(_previous:MutationState,form:FormData):Promise<MutationState>{
 const {client,membership}=await requireMembership();
 const text=(name:string)=>String(form.get(name)??'');
 const operation=text('operation'),entity=text('entity'),key=text('key'),version=Number(text('version')),reason=text('reason');
 if(!uuid(entity)||!uuid(key)||reason.length>2000)return {ok:false,message:'Invalid request. Refresh the page and try again.'};
 if(['create_admin_session','review_correction','verify_session','resolve_exception'].includes(operation)&&membership.role!=='admin')return {ok:false,message:messages.ACCESS_DENIED};
 let args:Record<string,unknown>;
 try{
  if(operation==='check_in')args={p_assignment_id:entity,p_idempotency_key:key};
  else if(operation==='create_admin_session'){
   if(!uuid(text('class_id')))throw new Error('ACCESS_DENIED');
   args={p_teacher_id:entity,p_class_id:text('class_id'),p_start:yangonTimestamp(text('start')),p_end:yangonTimestamp(text('end')),p_reason:reason,p_idempotency_key:key};
  }else{
   if(!Number.isSafeInteger(version)||version<1)throw new Error('VERSION_CONFLICT');
   const common={p_expected_version:version,p_idempotency_key:key};
   switch(operation){
    case 'check_out':args={...common,p_session_id:entity};break;
    case 'request_correction':args={...common,p_session_id:entity,p_start:yangonTimestamp(text('start')),p_end:yangonTimestamp(text('end')),p_reason:reason};break;
    case 'review_correction':args={...common,p_correction_id:entity,p_decision:text('decision'),p_reason:reason};break;
    case 'withdraw_correction':args={...common,p_correction_id:entity};break;
    case 'verify_session':args={...common,p_session_id:entity,p_decision:text('decision'),p_reason:reason};break;
    case 'resolve_exception':args={...common,p_exception_id:entity,p_reason:reason};break;
    default:throw new Error('ACCESS_DENIED');
   }
  }
  const {error}=await client.rpc(operation,args);
  if(error){const known=Object.keys(messages).find(code=>error.message.includes(code));return {ok:false,message:known?messages[known]:'Unable to save. Your input is kept; retry with the same request. If this persists, refresh and contact your administrator.'};}
  revalidatePath('/workspace');const success:Record<string,string>={check_in:'Checked in. Teaching time is now recording.',check_out:'Checked out. Your class record is ready for Admin review.',request_correction:'Correction requested. Original times stay in history until review.',withdraw_correction:'Correction withdrawn. Original times are unchanged.',review_correction:text('decision')==='approved'?'Correction approved. Verify the corrected class record before payroll.':'Correction rejected. Original times are unchanged.',verify_session:text('decision')==='verified'?'Class record verified. Eligible records can now be included in payroll.':'Class record rejected and excluded from payroll.',resolve_exception:'Exception resolved. Verify the class record before payroll.',create_admin_session:'Class record added as Pending verification.'};return {ok:true,message:success[operation]??'School record updated.'};
 }catch(error){const code=error instanceof Error?error.message:'';return {ok:false,message:messages[code]??'Unable to save. Your input has been kept. Please retry.'};}
}
