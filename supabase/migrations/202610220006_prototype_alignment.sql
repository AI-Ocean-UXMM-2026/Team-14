-- Prototype alignment: explicit correction hold, review UX and master-data APIs.
-- Apply once after migrations 001-005. No resets, seed accounts or credential values.
begin;
do $$declare check_name text;begin
 for check_name in select conname from pg_constraint where conrelid='public.teaching_sessions'::regclass and contype='c' and pg_get_constraintdef(oid) like '%capture_status%' loop
  execute format('alter table public.teaching_sessions drop constraint %I',check_name);
 end loop;
end $$;
alter table public.teaching_sessions add constraint teaching_sessions_capture_status_check check(capture_status in ('in_progress','correction_hold','completed','cancelled'));
alter table public.teaching_sessions add constraint teaching_sessions_capture_interval_check check((capture_status in ('in_progress','correction_hold') and effective_end is null) or (capture_status='completed' and effective_end is not null) or capture_status='cancelled');
alter table public.correction_requests add column capture_hold_version integer;
alter table public.teachers add column email text;
alter table public.classes add column name text;
create or replace function private.review_command(p_operation text,p_entity uuid,p_version integer,p_key uuid,p_input jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
<<review_logic>>
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
  if exists(select 1 from public.teaching_sessions other left join public.correction_requests c1 on c1.session_id=other.id and c1.status='pending'
   where other.school_id=v_school and other.teacher_id=v_teacher and other.id<>s.id and other.capture_status<>'cancelled'
   and tstzrange(coalesce(c1.proposed_start,other.effective_start),coalesce(c1.proposed_end,other.effective_end),'[)') && tstzrange(review_logic.proposed_start,review_logic.proposed_end,'[)')) then raise exception 'SESSION_OVERLAP';end if;
  insert into public.correction_requests(school_id,session_id,base_version,prior_snapshot,proposed_start,proposed_end,reason,actor_id)
   values(v_school,s.id,s.version,to_jsonb(s),proposed_start,proposed_end,reason_value,auth.uid()) returning * into c;
  -- Request creation holds payroll but leaves times and current verification intact.
  update public.teaching_sessions set version=version+1 where id=s.id returning * into s;
  result_value:=to_jsonb(c);
 elsif p_operation='review_correction' then
  if (p_input->>'decision') is null or (p_input->>'decision') not in ('approved','rejected') then raise exception 'INVALID_DECISION'; end if;
  if p_input->>'decision'='rejected' and reason_value='' then raise exception 'REASON_REQUIRED'; end if;
  -- Only request creation itself may have advanced the source version since request.
  if s.version<>coalesce(c.capture_hold_version,c.base_version+1) then raise exception 'VERSION_CONFLICT'; end if;
  before_value:=before_value||jsonb_build_object('correction',to_jsonb(c));
  if p_input->>'decision'='approved' then
   if exists(select 1 from public.teaching_sessions other left join public.correction_requests c1 on c1.session_id=other.id and c1.status='pending'
    where other.school_id=v_school and other.teacher_id=v_teacher and other.id<>s.id and other.capture_status<>'cancelled'
    and tstzrange(coalesce(c1.proposed_start,other.effective_start),coalesce(c1.proposed_end,other.effective_end),'[)') && tstzrange(c.proposed_start,c.proposed_end,'[)')) then raise exception 'SESSION_OVERLAP';end if;
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
   if exists(select 1 from public.session_exceptions where session_id=s.id and resolved_at is null) then
    if reason_value='' then raise exception 'UNRESOLVED_EXCEPTION';end if;
    update public.session_exceptions set resolved_at=clock_timestamp(),reviewer_id=auth.uid(),resolution_reason=reason_value where session_id=s.id and resolved_at is null;
   end if;
   -- Missing assignment and overlaps must be acknowledged with a recorded reason.
   if not exists(select 1 from public.teacher_assignments a where a.school_id=v_school and a.teacher_id=v_teacher and a.class_id=s.class_id and a.starts_at<=s.effective_start and (a.ends_at is null or a.ends_at>s.effective_start))
    and not exists(select 1 from public.session_exceptions e where e.session_id=s.id and e.flag='assignment_mismatch' and e.resolved_at is not null) then raise exception 'ASSIGNMENT_MISMATCH'; end if;
   if exists(select 1 from public.teaching_sessions other left join public.correction_requests c1 on c1.session_id=other.id and c1.status='pending' where other.school_id=v_school and other.teacher_id=v_teacher and other.id<>s.id and other.capture_status<>'cancelled' and tstzrange(coalesce(c1.proposed_start,other.effective_start),coalesce(c1.proposed_end,other.effective_end),'[)') && tstzrange(s.effective_start,s.effective_end,'[)'))
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
create or replace function public.check_in(p_assignment_id uuid,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.teacher_assignments;t public.teachers;s public.teaching_sessions;prior public.idempotency_records;stamp timestamptz;fingerprint jsonb;held public.teaching_sessions;
begin
 if auth.uid() is null or p_idempotency_key is null then raise exception 'ACCESS_DENIED';end if;
 select * into a from public.teacher_assignments where id=p_assignment_id;
 if not found or not private.owns_teacher(a.school_id,a.teacher_id) then raise exception 'ACCESS_DENIED';end if;
 select * into t from public.teachers where id=a.teacher_id and school_id=a.school_id for update;
 if not private.owns_teacher(a.school_id,a.teacher_id) then raise exception 'ACCESS_DENIED';end if;
 fingerprint:=jsonb_build_object('assignment_id',p_assignment_id);
 select * into prior from public.idempotency_records where school_id=a.school_id and actor_id=auth.uid() and operation='check_in' and key=p_idempotency_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'VERSION_CONFLICT';end if;return prior.result;end if;
 stamp:=clock_timestamp();
 if not t.active or a.starts_at>stamp or (a.ends_at is not null and a.ends_at<=stamp) or not exists(select 1 from public.classes where id=a.class_id and school_id=a.school_id and active) then raise exception 'ACCESS_DENIED';end if;
 if exists(select 1 from public.teaching_sessions old where old.school_id=a.school_id and old.teacher_id=a.teacher_id and old.capture_status in ('in_progress','correction_hold') and not exists(select 1 from public.correction_requests c where c.session_id=old.id and c.status='pending' and c.proposed_end<=stamp)) then raise exception 'OPEN_SESSION_EXISTS';end if;
 if exists(select 1 from public.teaching_sessions other left join public.correction_requests c on c.session_id=other.id and c.status='pending'
  where other.school_id=a.school_id and other.teacher_id=a.teacher_id and other.capture_status<>'cancelled' and stamp>=coalesce(c.proposed_start,other.effective_start) and stamp<coalesce(c.proposed_end,other.effective_end,'infinity'::timestamptz)) then raise exception 'SESSION_OVERLAP';end if;
 -- Preserve unresolved original timestamps; do not invent a checkout from a request.
 for held in select * from public.teaching_sessions where school_id=a.school_id and teacher_id=a.teacher_id and capture_status='in_progress' for update loop
  update public.teaching_sessions set capture_status='correction_hold',version=version+1 where id=held.id;
  update public.correction_requests set capture_hold_version=held.version+1 where session_id=held.id and status='pending';
  insert into public.audit_events(school_id,actor_id,action,entity_id,before_snapshot,after_snapshot) values(a.school_id,auth.uid(),'capture_correction_hold',held.id,to_jsonb(held),jsonb_build_object('capture_status','correction_hold','version',held.version+1));
 end loop;
 insert into public.teaching_sessions(school_id,teacher_id,class_id,original_start,effective_start,source,actor_id) values(a.school_id,a.teacher_id,a.class_id,stamp,stamp,'teacher',auth.uid()) returning * into s;
 insert into public.audit_events(school_id,actor_id,action,entity_id,after_snapshot) values(s.school_id,auth.uid(),'check_in',s.id,to_jsonb(s));
 insert into public.idempotency_records(school_id,actor_id,operation,key,fingerprint,result) values(a.school_id,auth.uid(),'check_in',p_idempotency_key,fingerprint,to_jsonb(s));
 return to_jsonb(s);
end $$;
create or replace function public.check_out(p_session_id uuid,p_expected_version integer,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.teaching_sessions;before_value jsonb;prior public.idempotency_records;fingerprint jsonb;stamp timestamptz;
begin
 if auth.uid() is null or p_idempotency_key is null or p_expected_version is null then raise exception 'ACCESS_DENIED';end if;
 select * into s from public.teaching_sessions where id=p_session_id;
 if not found or not private.owns_teacher(s.school_id,s.teacher_id) then raise exception 'ACCESS_DENIED';end if;
 perform 1 from public.teachers where id=s.teacher_id and school_id=s.school_id for update;
 if not private.owns_teacher(s.school_id,s.teacher_id) then raise exception 'ACCESS_DENIED';end if;
 select * into s from public.teaching_sessions where id=p_session_id for update;
 fingerprint:=jsonb_build_object('session_id',p_session_id,'expected_version',p_expected_version);
 select * into prior from public.idempotency_records where school_id=s.school_id and actor_id=auth.uid() and operation='check_out' and key=p_idempotency_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'VERSION_CONFLICT';end if;return prior.result;end if;
 if s.version<>p_expected_version or s.capture_status<>'in_progress' then raise exception 'VERSION_CONFLICT';end if;
 if exists(select 1 from public.correction_requests where session_id=s.id and status='pending') then raise exception 'PENDING_CORRECTION_EXISTS';end if;
 before_value:=to_jsonb(s);stamp:=clock_timestamp();
 update public.teaching_sessions set original_end=stamp,effective_end=stamp,capture_status='completed',verification='pending',version=version+1 where id=s.id returning * into s;
 insert into public.audit_events(school_id,actor_id,action,entity_id,before_snapshot,after_snapshot) values(s.school_id,auth.uid(),'check_out',s.id,before_value,to_jsonb(s));
 insert into public.idempotency_records(school_id,actor_id,operation,key,fingerprint,result) values(s.school_id,auth.uid(),'check_out',p_idempotency_key,fingerprint,to_jsonb(s));
 return to_jsonb(s);
end $$;
-- Match the prototype's six-hour review flag; no automatic duration is added.
create function private.flag_long_session() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.capture_status='completed' and new.effective_end-new.effective_start>interval '6 hours' and not exists(select 1 from public.session_exceptions where session_id=new.id and flag='long_duration' and resolved_at is null) then
  insert into public.session_exceptions(school_id,session_id,flag) values(new.school_id,new.id,'long_duration');
 end if;return new;
end $$;
create trigger flag_long_session after insert or update of effective_start,effective_end,capture_status on public.teaching_sessions for each row execute function private.flag_long_session();
revoke all on function private.flag_long_session() from public,anon,authenticated;

create or replace function private.flag_session_exceptions() returns trigger language plpgsql security definer set search_path='' as $$
declare other public.teaching_sessions;
begin
 if new.capture_status='cancelled' then return new; end if;
 if not exists(select 1 from public.teacher_assignments a where a.school_id=new.school_id and a.teacher_id=new.teacher_id and a.class_id=new.class_id and a.starts_at<=new.effective_start and (a.ends_at is null or a.ends_at>new.effective_start)) then
  if not exists(select 1 from public.session_exceptions where session_id=new.id and flag='assignment_mismatch' and resolved_at is null) then
   insert into public.session_exceptions(school_id,session_id,flag) values(new.school_id,new.id,'assignment_mismatch');
  end if;
 end if;
 for other in select s.* from public.teaching_sessions s left join public.correction_requests c on c.session_id=s.id and c.status='pending' where s.school_id=new.school_id and s.teacher_id=new.teacher_id and s.id<>new.id and s.capture_status<>'cancelled' and tstzrange(coalesce(c.proposed_start,s.effective_start),coalesce(c.proposed_end,s.effective_end),'[)') && tstzrange(coalesce((select proposed_start from public.correction_requests where session_id=new.id and status='pending'),new.effective_start),coalesce((select proposed_end from public.correction_requests where session_id=new.id and status='pending'),new.effective_end),'[)') order by s.id for update of s loop
  if not exists(select 1 from public.session_exceptions where session_id=new.id and flag='overlap' and resolved_at is null) then
   insert into public.session_exceptions(school_id,session_id,flag) values(new.school_id,new.id,'overlap');
  end if;
  if not exists(select 1 from public.session_exceptions where session_id=other.id and flag='overlap' and resolved_at is null) then
   insert into public.session_exceptions(school_id,session_id,flag) values(new.school_id,other.id,'overlap');
  end if;
  -- A new conflicting session invalidates prior verification, never financial snapshots.
  if other.verification='verified' and not exists(select 1 from public.session_allocations where session_id=other.id and active) then
   update public.teaching_sessions set verification='pending',version=version+1 where id=other.id;
   insert into public.audit_events(school_id,actor_id,action,entity_id,before_snapshot,after_snapshot)
    values(new.school_id,auth.uid(),'overlap_invalidated_review',other.id,to_jsonb(other),jsonb_build_object('caused_by',new.id));
  end if;
 end loop;
 return new;
end $$;

create or replace function public.create_admin_session(p_teacher_id uuid,p_class_id uuid,p_start timestamptz,p_end timestamptz,p_reason text,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.teachers; s public.teaching_sessions; prior public.idempotency_records; fingerprint jsonb;
begin
 select * into t from public.teachers where id=p_teacher_id;
 if not found or p_idempotency_key is null or not private.is_admin(t.school_id) then raise exception 'ACCESS_DENIED'; end if;
 perform 1 from public.teachers where id=t.id for update;
 if not private.is_admin(t.school_id) then raise exception 'ACCESS_DENIED'; end if;
 fingerprint:=jsonb_build_object('teacher',p_teacher_id,'class',p_class_id,'start',p_start,'end',p_end,'reason',p_reason);
 select * into prior from public.idempotency_records where school_id=t.school_id and actor_id=auth.uid() and operation='create_admin_session' and key=p_idempotency_key;
 if found then
  if prior.fingerprint<>fingerprint then raise exception 'VERSION_CONFLICT'; end if;
  return prior.result;
 end if;
 if p_reason is null or length(trim(p_reason))=0 or length(p_reason)>2000 then raise exception 'REASON_REQUIRED'; end if;
 if p_start is null or p_end is null or not isfinite(p_start) or not isfinite(p_end) or p_end<=p_start or date_trunc('minute',p_start)<>p_start or date_trunc('minute',p_end)<>p_end then raise exception 'INVALID_INTERVAL'; end if;
 if not exists(select 1 from public.classes where id=p_class_id and school_id=t.school_id) then raise exception 'ACCESS_DENIED'; end if;
 if exists(select 1 from public.teaching_sessions other left join public.correction_requests c on c.session_id=other.id and c.status='pending'
  where other.school_id=t.school_id and other.teacher_id=t.id and other.capture_status<>'cancelled'
  and tstzrange(coalesce(c.proposed_start,other.effective_start),coalesce(c.proposed_end,other.effective_end),'[)') && tstzrange(p_start,p_end,'[)')) then raise exception 'SESSION_OVERLAP';end if;
 insert into public.teaching_sessions(school_id,teacher_id,class_id,original_start,original_end,effective_start,effective_end,capture_status,verification,source,actor_id,entry_reason)
  values(t.school_id,t.id,p_class_id,p_start,p_end,p_start,p_end,'completed','pending','admin',auth.uid(),trim(p_reason)) returning * into s;
 insert into public.audit_events(school_id,actor_id,action,entity_id,after_snapshot) values(t.school_id,auth.uid(),'create_admin_session',s.id,to_jsonb(s));
 insert into public.idempotency_records(school_id,actor_id,operation,key,fingerprint,result) values(t.school_id,auth.uid(),'create_admin_session',p_idempotency_key,fingerprint,to_jsonb(s));
 return to_jsonb(s);
end $$;
-- Admin-only master-data writes, with source locks, versions, retry and audit.
create function public.manage_workspace(p_operation text,p_entity uuid,p_expected_version integer,p_idempotency_key uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare school_value uuid;t public.teachers;c public.classes;prior public.idempotency_records;fingerprint jsonb;before_value jsonb;result_value jsonb;reason_value text;stamp timestamptz:=clock_timestamp();from_value timestamptz;next_rate timestamptz;rate_value bigint;member_value uuid;user_value uuid;class_value uuid;
begin
 select school_id into school_value from public.memberships where user_id=auth.uid() and active and role='admin';
 if school_value is null or p_idempotency_key is null or p_input is null then raise exception 'ACCESS_DENIED';end if;
 if p_operation not in ('create_teacher','set_teacher_active','set_teacher_assignments','set_teacher_rate','create_class','set_class_active','link_teacher_account') then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended('sayasync-payroll:'||school_value::text,0));
 perform 1 from public.teachers where school_id=school_value order by id for update;
 perform 1 from public.schools where id=school_value for update;
 if not private.is_admin(school_value) then raise exception 'ACCESS_DENIED';end if;
 fingerprint:=jsonb_build_object('operation',p_operation,'entity',p_entity,'version',p_expected_version,'input',p_input);
 select * into prior from public.idempotency_records where school_id=school_value and actor_id=auth.uid() and operation='manage_workspace' and key=p_idempotency_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'VERSION_CONFLICT';end if;return prior.result;end if;
 reason_value:=trim(coalesce(p_input->>'reason',''));
 if length(reason_value)>2000 then raise exception 'INVALID_REASON';end if;
 if p_operation not in ('create_teacher','create_class') then
  if p_operation='set_class_active' then
   select * into c from public.classes where id=p_entity and school_id=school_value for update;
   if not found then raise exception 'ACCESS_DENIED';end if;
   if p_expected_version is null or c.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;before_value:=to_jsonb(c);
  else
   select * into t from public.teachers where id=p_entity and school_id=school_value;
   if not found then raise exception 'ACCESS_DENIED';end if;
   if p_expected_version is null or t.version<>p_expected_version then raise exception 'VERSION_CONFLICT';end if;before_value:=to_jsonb(t);
  end if;
 end if;
 if p_operation in ('create_teacher','set_teacher_rate') then
  rate_value:=(p_input->>'rate')::bigint;from_value:=((p_input->>'from')::date)::timestamp at time zone 'Asia/Yangon';
  if rate_value is null or rate_value<=0 or rate_value>1000000000 or from_value is null or not isfinite(from_value) then raise exception 'INVALID_RATE';end if;
 end if;
 if p_operation='create_teacher' then
  if trim(coalesce(p_input->>'name',''))='' or length(p_input->>'name')>200 or coalesce(p_input->>'email','')!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(p_input->>'email')>254 then raise exception 'INVALID_PROFILE';end if;
  insert into public.teachers(school_id,code,name,email) values(school_value,'T'||lpad(((select count(*) from public.teachers where school_id=school_value)+1)::text,3,'0'),trim(p_input->>'name'),trim(p_input->>'email')) returning * into t;
  insert into public.teacher_rates(school_id,teacher_id,starts_at,hourly_mmk,reason,actor_id) values(school_value,t.id,from_value,rate_value,'Initial hourly rate',auth.uid());
 elsif p_operation='create_class' then
  if trim(coalesce(p_input->>'code',''))='' or length(p_input->>'code')>50 or trim(coalesce(p_input->>'name',''))='' or length(p_input->>'name')>200 or trim(coalesce(p_input->>'subject',''))='' or length(p_input->>'subject')>200 then raise exception 'INVALID_PROFILE';end if;
  insert into public.classes(school_id,code,name,subject) values(school_value,trim(p_input->>'code'),trim(p_input->>'name'),trim(p_input->>'subject')) returning * into c;
 elsif p_operation='set_teacher_rate' then
  if reason_value='' then raise exception 'REASON_REQUIRED';end if;
  if exists(select 1 from public.teacher_rates where teacher_id=t.id and starts_at=from_value) then raise exception 'RATE_INTERVAL_OVERLAP';end if;
  select min(starts_at) into next_rate from public.teacher_rates where teacher_id=t.id and starts_at>from_value;
  before_value:=before_value||jsonb_build_object('rates',(select jsonb_agg(to_jsonb(r)) from public.teacher_rates r where teacher_id=t.id));
  update public.teacher_rates set ends_at=from_value,version=version+1 where teacher_id=t.id and starts_at<from_value and (ends_at is null or ends_at>from_value);
  insert into public.teacher_rates(school_id,teacher_id,starts_at,ends_at,hourly_mmk,reason,actor_id) values(school_value,t.id,from_value,next_rate,rate_value,reason_value,auth.uid());
  update public.teachers set version=version+1 where id=t.id returning * into t;
 elsif p_operation='set_teacher_active' then
  if (p_input->>'active') is null then raise exception 'INVALID_PROFILE';end if;
  if not (p_input->>'active')::boolean and exists(select 1 from public.teaching_sessions where teacher_id=t.id and effective_end is null and capture_status<>'cancelled') then raise exception 'OPEN_SESSION_EXISTS';end if;
  update public.teachers set active=(p_input->>'active')::boolean,version=version+1 where id=t.id returning * into t;
  if t.membership_id is not null then update public.memberships set active=t.active where id=t.membership_id and school_id=school_value and role='teacher';end if;
 elsif p_operation='set_class_active' then
  if (p_input->>'active') is null then raise exception 'INVALID_PROFILE';end if;
  if not (p_input->>'active')::boolean and exists(select 1 from public.teaching_sessions where class_id=c.id and effective_end is null and capture_status<>'cancelled') then raise exception 'OPEN_SESSION_EXISTS';end if;
  update public.classes set active=(p_input->>'active')::boolean,version=version+1 where id=c.id returning * into c;
 elsif p_operation='link_teacher_account' then
  user_value:=(p_input->>'user_id')::uuid;
  if user_value is null or not exists(select 1 from auth.users where id=user_value) then raise exception 'AUTH_USER_MISSING';end if;
  select id into member_value from public.memberships where user_id=user_value and school_id=school_value and role='teacher';
  if member_value is null then
   if exists(select 1 from public.memberships where user_id=user_value) then raise exception 'ACCOUNT_LINK_CONFLICT';end if;
   insert into public.memberships(school_id,user_id,role,active) values(school_value,user_value,'teacher',t.active) returning id into member_value;
  end if;
  if t.membership_id is not null and t.membership_id<>member_value then raise exception 'ACCOUNT_LINK_CONFLICT';end if;
  if exists(select 1 from public.teachers where membership_id=member_value and id<>t.id) then raise exception 'ACCOUNT_LINK_CONFLICT';end if;
  update public.teachers set membership_id=member_value,version=version+1 where id=t.id returning * into t;
 end if;
 if p_operation in ('create_teacher','set_teacher_assignments') then
  if jsonb_typeof(coalesce(p_input->'classes','[]'::jsonb))<>'array' then raise exception 'INVALID_PROFILE';end if;
  if p_operation='set_teacher_assignments' and reason_value='' then raise exception 'REASON_REQUIRED';end if;
  for class_value in select distinct value::uuid from jsonb_array_elements_text(coalesce(p_input->'classes','[]'::jsonb)) loop
   if not exists(select 1 from public.classes where id=class_value and school_id=school_value and active) then raise exception 'ACCESS_DENIED';end if;
  end loop;
  before_value:=coalesce(before_value,'{}')||jsonb_build_object('assignments',(select jsonb_agg(to_jsonb(a)) from public.teacher_assignments a where teacher_id=t.id));
  if p_operation='set_teacher_assignments' then
   update public.teacher_assignments set ends_at=stamp,version=version+1 where teacher_id=t.id and starts_at<stamp and (ends_at is null or ends_at>stamp) and not exists(select 1 from jsonb_array_elements_text(coalesce(p_input->'classes','[]'::jsonb)) ids where ids.value::uuid=class_id);
  end if;
  for class_value in select distinct value::uuid from jsonb_array_elements_text(coalesce(p_input->'classes','[]'::jsonb)) loop
   if not exists(select 1 from public.teacher_assignments where teacher_id=t.id and class_id=class_value and starts_at<=stamp and (ends_at is null or ends_at>stamp)) then
    insert into public.teacher_assignments(school_id,teacher_id,class_id,starts_at,reason) values(school_value,t.id,class_value,case when p_operation='create_teacher' then from_value else stamp end,coalesce(nullif(reason_value,''),'Initial assignment'));
   end if;
  end loop;
  if p_operation='set_teacher_assignments' then update public.teachers set version=version+1 where id=t.id returning * into t;end if;
 end if;
 result_value:=case when p_operation in ('create_class','set_class_active') then to_jsonb(c) else to_jsonb(t) end;
 insert into public.audit_events(school_id,actor_id,action,entity_id,before_snapshot,after_snapshot) values(school_value,auth.uid(),p_operation,coalesce(t.id,c.id),before_value,result_value||jsonb_build_object('input',p_input));
 insert into public.idempotency_records(school_id,actor_id,operation,key,fingerprint,result) values(school_value,auth.uid(),'manage_workspace',p_idempotency_key,fingerprint,result_value);
 return result_value;
end $$;
revoke all on function public.manage_workspace(text,uuid,integer,uuid,jsonb) from public,anon;
grant execute on function public.manage_workspace(text,uuid,integer,uuid,jsonb) to authenticated;
commit;
