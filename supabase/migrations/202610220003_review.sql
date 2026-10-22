begin;
alter table public.correction_requests add column decided_at timestamptz;
-- Clients cannot mutate tables; this command implements the shared lock/retry/audit protocol.
create function private.review_command(p_operation text,p_entity uuid,p_version integer,p_key uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 s public.teaching_sessions; c public.correction_requests; prior public.idempotency_records;
 exception_row public.session_exceptions; v_school uuid; v_teacher uuid; before_value jsonb; result_value jsonb;
 proposed_start timestamptz; proposed_end timestamptz; reason_value text; fingerprint jsonb;
begin
 if auth.uid() is null or p_key is null or p_version is null or p_input is null then raise exception 'ACCESS_DENIED'; end if;
 if p_operation in ('request_correction','verify_session') then
  select * into s from public.teaching_sessions where id=p_entity;
 elsif p_operation in ('review_correction','withdraw_correction') then
  select * into c from public.correction_requests where id=p_entity;
  select * into s from public.teaching_sessions where id=c.session_id and school_id=c.school_id;
 elsif p_operation='resolve_exception' then
  select * into exception_row from public.session_exceptions where id=p_entity;
  select * into s from public.teaching_sessions where id=exception_row.session_id and school_id=exception_row.school_id;
 else raise exception 'ACCESS_DENIED'; end if;
 if s.id is null then raise exception 'ACCESS_DENIED'; end if;
 v_school:=s.school_id; v_teacher:=s.teacher_id;
 if p_operation in ('review_correction','verify_session','resolve_exception') then
  if not private.is_admin(v_school) then raise exception 'ACCESS_DENIED'; end if;
 elsif not (private.is_admin(v_school) or private.owns_teacher(v_school,v_teacher)) then raise exception 'ACCESS_DENIED'; end if;
 -- Lock all source mutations in teacher -> session -> correction/exception order.
 perform 1 from public.teachers where school_id=v_school and id=v_teacher for update;
 select * into s from public.teaching_sessions where id=s.id for update;
 if p_operation in ('review_correction','verify_session','resolve_exception') then
  if not private.is_admin(v_school) then raise exception 'ACCESS_DENIED'; end if;
 elsif not (private.is_admin(v_school) or private.owns_teacher(v_school,v_teacher)) then raise exception 'ACCESS_DENIED'; end if;
 fingerprint:=jsonb_build_object('entity',p_entity,'version',p_version,'input',p_input);
 select * into prior from public.idempotency_records where school_id=v_school and actor_id=auth.uid() and operation=p_operation and key=p_key;
 if found then
  if prior.fingerprint<>fingerprint then raise exception 'VERSION_CONFLICT'; end if;
  return prior.result;
 end if;
 if exists(select 1 from public.session_allocations where school_id=v_school and session_id=s.id and active) then raise exception 'PAYROLL_LOCKED'; end if;
 if s.version<>p_version then raise exception 'VERSION_CONFLICT'; end if;
 if p_operation in ('review_correction','withdraw_correction') then
  select * into c from public.correction_requests where id=c.id for update;
  if c.status<>'pending' then raise exception 'VERSION_CONFLICT'; end if;
 end if;
 reason_value:=trim(coalesce(p_input->>'reason',''));
 if length(reason_value)>2000 then raise exception 'INVALID_REASON'; end if;
 before_value:=jsonb_build_object('session',to_jsonb(s));
 if p_operation='request_correction' then
  if reason_value='' then raise exception 'REASON_REQUIRED'; end if;
  if s.capture_status='cancelled' then raise exception 'INVALID_STATE'; end if;
  proposed_start:=(p_input->>'start')::timestamptz; proposed_end:=(p_input->>'end')::timestamptz;
  if proposed_start is null or proposed_end is null or not isfinite(proposed_start) or not isfinite(proposed_end) or proposed_end<=proposed_start
   or date_trunc('minute',proposed_start)<>proposed_start or date_trunc('minute',proposed_end)<>proposed_end then raise exception 'INVALID_INTERVAL'; end if;
  if exists(select 1 from public.correction_requests where school_id=v_school and session_id=s.id and status='pending') then raise exception 'PENDING_CORRECTION_EXISTS'; end if;
  insert into public.correction_requests(school_id,session_id,base_version,prior_snapshot,proposed_start,proposed_end,reason,actor_id)
   values(v_school,s.id,s.version,to_jsonb(s),proposed_start,proposed_end,reason_value,auth.uid()) returning * into c;
  -- Request creation holds payroll but leaves times and current verification intact.
  update public.teaching_sessions set version=version+1 where id=s.id returning * into s;
  result_value:=to_jsonb(c);
 elsif p_operation='review_correction' then
  if (p_input->>'decision') is null or (p_input->>'decision') not in ('approved','rejected') then raise exception 'INVALID_DECISION'; end if;
  if p_input->>'decision'='rejected' and reason_value='' then raise exception 'REASON_REQUIRED'; end if;
  -- Only request creation itself may have advanced the source version since request.
  if s.version<>c.base_version+1 then raise exception 'VERSION_CONFLICT'; end if;
  before_value:=before_value||jsonb_build_object('correction',to_jsonb(c));
  if p_input->>'decision'='approved' then
   update public.teaching_sessions set effective_start=c.proposed_start,effective_end=c.proposed_end,
    capture_status='completed',verification='pending',version=version+1 where id=s.id returning * into s;
  else
   update public.teaching_sessions set version=version+1 where id=s.id returning * into s;
  end if;
  update public.correction_requests set status=p_input->>'decision',reviewer_id=auth.uid(),decision_reason=nullif(reason_value,''),decided_at=clock_timestamp() where id=c.id returning * into c;
  result_value:=to_jsonb(c);
 elsif p_operation='withdraw_correction' then
  if c.actor_id<>auth.uid() and not private.is_admin(v_school) then raise exception 'ACCESS_DENIED'; end if;
  before_value:=before_value||jsonb_build_object('correction',to_jsonb(c));
  update public.correction_requests set status='withdrawn',decided_at=clock_timestamp() where id=c.id returning * into c;
  update public.teaching_sessions set version=version+1 where id=s.id returning * into s;
  result_value:=to_jsonb(c);
 elsif p_operation='resolve_exception' then
  if reason_value='' then raise exception 'REASON_REQUIRED'; end if;
  if exists(select 1 from public.correction_requests where session_id=s.id and status='pending') then raise exception 'PENDING_CORRECTION_EXISTS'; end if;
  select * into exception_row from public.session_exceptions where id=exception_row.id for update;
  if exception_row.resolved_at is not null then raise exception 'VERSION_CONFLICT'; end if;
  before_value:=before_value||jsonb_build_object('exception',to_jsonb(exception_row));
  update public.session_exceptions set resolved_at=clock_timestamp(),resolution_reason=reason_value,reviewer_id=auth.uid() where id=exception_row.id returning * into exception_row;
  update public.teaching_sessions set version=version+1,verification='pending' where id=s.id returning * into s;
  result_value:=to_jsonb(exception_row);
 elsif p_operation='verify_session' then
  if (p_input->>'decision') is null or (p_input->>'decision') not in ('verified','rejected') then raise exception 'INVALID_DECISION'; end if;
  if p_input->>'decision'='rejected' and reason_value='' then raise exception 'REASON_REQUIRED'; end if;
  if s.capture_status<>'completed' or s.effective_end is null then raise exception 'INCOMPLETE_SESSION'; end if;
  if exists(select 1 from public.correction_requests where session_id=s.id and status='pending') then raise exception 'PENDING_CORRECTION_EXISTS'; end if;
  if p_input->>'decision'='verified' then
   if exists(select 1 from public.session_exceptions where session_id=s.id and resolved_at is null) then raise exception 'UNRESOLVED_EXCEPTION'; end if;
   -- Missing assignment and overlaps must be acknowledged with a recorded reason.
   if not exists(select 1 from public.teacher_assignments a where a.school_id=v_school and a.teacher_id=v_teacher and a.class_id=s.class_id and a.starts_at<=s.effective_start and (a.ends_at is null or a.ends_at>s.effective_start))
    and not exists(select 1 from public.session_exceptions e where e.session_id=s.id and e.flag='assignment_mismatch' and e.resolved_at is not null) then raise exception 'ASSIGNMENT_MISMATCH'; end if;
   if exists(select 1 from public.teaching_sessions other where other.school_id=v_school and other.teacher_id=v_teacher and other.id<>s.id and other.capture_status<>'cancelled' and tstzrange(other.effective_start,other.effective_end,'[)') && tstzrange(s.effective_start,s.effective_end,'[)'))
    and not exists(select 1 from public.session_exceptions e where e.session_id=s.id and e.flag='overlap' and e.resolved_at is not null) then raise exception 'UNRESOLVED_OVERLAP'; end if;
  end if;
  insert into public.session_reviews(school_id,session_id,reviewed_version,reviewer_id,result,reason) values(v_school,s.id,s.version,auth.uid(),p_input->>'decision',nullif(reason_value,''));
  update public.teaching_sessions set verification=p_input->>'decision',version=version+1 where id=s.id returning * into s;
  result_value:=to_jsonb(s);
 end if;
 insert into public.audit_events(school_id,actor_id,action,entity_id,before_snapshot,after_snapshot)
  values(v_school,auth.uid(),p_operation,p_entity,before_value,jsonb_build_object('session',to_jsonb(s),'result',result_value));
 insert into public.idempotency_records(school_id,actor_id,operation,key,fingerprint,result) values(v_school,auth.uid(),p_operation,p_key,fingerprint,result_value);
 return result_value;
end $$;
revoke all on function private.review_command(text,uuid,integer,uuid,jsonb) from public,anon,authenticated;
create function public.request_correction(p_session_id uuid,p_expected_version integer,p_idempotency_key uuid,p_start timestamptz,p_end timestamptz,p_reason text) returns jsonb
 language sql security definer set search_path='' as $$ select private.review_command('request_correction',p_session_id,p_expected_version,p_idempotency_key,jsonb_build_object('start',p_start,'end',p_end,'reason',p_reason)) $$;
create function public.review_correction(p_correction_id uuid,p_expected_version integer,p_idempotency_key uuid,p_decision text,p_reason text default '') returns jsonb
 language sql security definer set search_path='' as $$ select private.review_command('review_correction',p_correction_id,p_expected_version,p_idempotency_key,jsonb_build_object('decision',p_decision,'reason',p_reason)) $$;
create function public.withdraw_correction(p_correction_id uuid,p_expected_version integer,p_idempotency_key uuid) returns jsonb
 language sql security definer set search_path='' as $$ select private.review_command('withdraw_correction',p_correction_id,p_expected_version,p_idempotency_key,'{}'::jsonb) $$;
create function public.verify_session(p_session_id uuid,p_expected_version integer,p_idempotency_key uuid,p_decision text default 'verified',p_reason text default '') returns jsonb
 language sql security definer set search_path='' as $$ select private.review_command('verify_session',p_session_id,p_expected_version,p_idempotency_key,jsonb_build_object('decision',p_decision,'reason',p_reason)) $$;
create function public.resolve_exception(p_exception_id uuid,p_expected_version integer,p_idempotency_key uuid,p_reason text) returns jsonb
 language sql security definer set search_path='' as $$ select private.review_command('resolve_exception',p_exception_id,p_expected_version,p_idempotency_key,jsonb_build_object('reason',p_reason)) $$;
revoke all on function public.request_correction(uuid,integer,uuid,timestamptz,timestamptz,text),public.review_correction(uuid,integer,uuid,text,text),public.withdraw_correction(uuid,integer,uuid),public.verify_session(uuid,integer,uuid,text,text),public.resolve_exception(uuid,integer,uuid,text) from public,anon;
grant execute on function public.request_correction(uuid,integer,uuid,timestamptz,timestamptz,text),public.review_correction(uuid,integer,uuid,text,text),public.withdraw_correction(uuid,integer,uuid),public.verify_session(uuid,integer,uuid,text,text),public.resolve_exception(uuid,integer,uuid,text) to authenticated;
-- Teachers may read flags on owned sessions, never another teacher's exceptions.
create policy own_exceptions on public.session_exceptions for select to authenticated using(exists(select 1 from public.teaching_sessions s where s.id=session_exceptions.session_id and s.school_id=session_exceptions.school_id and private.owns_teacher(s.school_id,s.teacher_id)));
create policy own_allocation_locks on public.session_allocations for select to authenticated using(exists(select 1 from public.teaching_sessions s where s.id=session_allocations.session_id and s.school_id=session_allocations.school_id and private.owns_teacher(s.school_id,s.teacher_id)));
commit;
