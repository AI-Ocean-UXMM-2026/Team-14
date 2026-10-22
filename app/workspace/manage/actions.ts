'use server';
import {revalidatePath} from 'next/cache';
import {requireMembership} from '@/lib/supabase/authorization';
import {payrollDate,signedMmk} from '@/lib/domain/payroll-input';
export type MasterState={ok:boolean;message:string};
const errors:Record<string,string>={ACCESS_DENIED:'You do not have access to manage this record.',VERSION_CONFLICT:'This record changed. Refresh before editing again.',INVALID_PROFILE:'Enter a valid name, code, subject or email.',INVALID_RATE:'Enter a positive hourly rate and valid effective date.',INVALID_REASON:'Keep your reason within 2,000 characters.',REASON_REQUIRED:'Enter a reason for this change.',INVALID_STATE:'Activate this class before assigning teachers.',OPEN_SESSION_EXISTS:'Resolve open teaching records before deactivating.',RATE_INTERVAL_OVERLAP:'A rate already starts on this date. Choose a different effective date.',AUTH_USER_MISSING:'The invited user could not be found. Check the User UID.',ACCOUNT_LINK_CONFLICT:'This account is already linked or has another role. Ask your account administrator to review it.'};
const uuid=(s:string)=>/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export async function manageMaster(_state:MasterState,form:FormData):Promise<MasterState>{
 const {client,membership}=await requireMembership();if(membership.role!=='admin')return {ok:false,message:errors.ACCESS_DENIED};
 const val=(name:string)=>String(form.get(name)??'').trim(),op=val('operation'),entity=val('entity'),key=val('key'),version=Number(val('version'));
 if(!uuid(key)||entity&&!uuid(entity))return {ok:false,message:'Invalid request. Refresh and retry.'};
 try{
  let input:Record<string,unknown>;switch(op){
   case 'create_teacher':input={name:val('name'),email:val('email'),rate:signedMmk(val('rate')),from:payrollDate(val('from')),classes:form.getAll('classes').map(String)};break;
   case 'create_class':input={name:val('name'),code:val('code'),subject:val('subject')};break;
   case 'set_teacher_active':case 'set_class_active':input={active:val('active')==='true'};break;
   case 'set_teacher_assignments':input={classes:form.getAll('classes').map(String),reason:val('reason')};break;
   case 'set_class_assignments':input={teachers:form.getAll('teachers').map(String),expected:JSON.parse(val('expected_teachers')||'[]'),reason:val('reason')};break;
   case 'set_teacher_rate':input={rate:signedMmk(val('rate')),from:payrollDate(val('from')),reason:val('reason')};break;
   case 'link_teacher_account':if(!uuid(val('user_id')))throw Error('AUTH_USER_MISSING');input={user_id:val('user_id')};break;
   default:throw Error('ACCESS_DENIED');
  }
  if(!op.startsWith('create_')&&(!Number.isSafeInteger(version)||version<1))throw Error('VERSION_CONFLICT');
  const {error}=await client.rpc(op==='set_class_assignments'?'set_class_assignments':'manage_workspace',op==='set_class_assignments'?{p_class_id:entity,p_expected_version:version,p_expected_teacher_ids:input.expected,p_teacher_ids:input.teachers,p_reason:input.reason,p_idempotency_key:key}:{p_operation:op,p_entity:entity||null,p_expected_version:op.startsWith('create_')?null:version,p_idempotency_key:key,p_input:input});
  if(error){if(error.code==='23505')return {ok:false,message:'That code or account link is already in use.'};const code=Object.keys(errors).find(c=>error.message.includes(c));return {ok:false,message:code?errors[code]:'Unable to save. Your input is retained. Check that the latest workspace migration is installed, then retry.'};}
  revalidatePath('/workspace/manage');revalidatePath('/workspace');revalidatePath('/workspace/payroll');return {ok:true,message:'Saved successfully. History has been retained.'};
 }catch(e){return {ok:false,message:errors[e instanceof Error?e.message:'']??'Enter valid field values and try again.'};}
}
