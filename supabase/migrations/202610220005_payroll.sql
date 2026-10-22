begin;
alter table public.payroll_runs
 add column source_snapshot jsonb,
 add column prepared_by uuid references auth.users(id),
 add column approved_by uuid references auth.users(id),
 add column voided_by uuid references auth.users(id),
 add column voided_at timestamptz,
 add column void_reason text;
alter table public.payroll_runs drop constraint payroll_runs_total_mmk_check;
alter table public.payroll_runs add constraint payroll_total_valid check(status='draft' or total_mmk>=0);
-- One editable signed adjustment per Teacher/run; earlier values remain in audit.
create unique index one_teacher_adjustment on public.payroll_adjustments(run_id,teacher_id);

-- Source writers share the same parent-row lock as approval/calculation.
create function private.lock_payroll_source() returns trigger language plpgsql security definer set search_path='' as $$
declare v_teacher uuid; v_school uuid; v_session uuid;
begin
 if tg_op='DELETE' then
  if tg_table_name in ('session_exceptions','correction_requests') then v_session:=old.session_id;
  else v_teacher:=old.teacher_id;v_school:=old.school_id;end if;
 else
  if tg_table_name in ('session_exceptions','correction_requests') then v_session:=new.session_id;
  else v_teacher:=new.teacher_id;v_school:=new.school_id;end if;
  if tg_op='UPDATE' and (new.school_id<>old.school_id or
   (tg_table_name in ('session_exceptions','correction_requests') and to_jsonb(new)->>'session_id'<>to_jsonb(old)->>'session_id') or
   (tg_table_name not in ('session_exceptions','correction_requests') and to_jsonb(new)->>'teacher_id'<>to_jsonb(old)->>'teacher_id')) then raise exception 'SOURCE_IDENTITY_IMMUTABLE';end if;
 end if;
 if v_session is not null then select teacher_id,school_id into v_teacher,v_school from public.teaching_sessions where id=v_session;end if;
 perform 1 from public.teachers where school_id=v_school and id=v_teacher for update;
 if tg_table_name='teaching_sessions' and tg_op<>'INSERT' then
  if exists(select 1 from public.session_allocations where session_id=old.id and active) then raise exception 'PAYROLL_LOCKED';end if;
 elsif tg_table_name='correction_requests' then
  if exists(select 1 from public.session_allocations where session_id=v_session and active) then raise exception 'PAYROLL_LOCKED';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
do $$declare t text;begin
 foreach t in array array['teaching_sessions','teacher_rates','teacher_assignments','session_exceptions','correction_requests'] loop
 execute format('create trigger payroll_source_lock before insert or update or delete on public.%I for each row execute function private.lock_payroll_source()',t);
 end loop;
end $$;

-- Prevent a newly created teacher/session from appearing between parent-lock scan and approval.
create function private.lock_teacher_creation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended('sayasync-payroll:'||new.school_id::text,0));
 return new;
end $$;
create trigger payroll_teacher_creation before insert on public.teachers for each row execute function private.lock_teacher_creation();
revoke all on function private.lock_teacher_creation() from public,anon,authenticated;

-- All source data is snapshotted for stale-draft detection, including held rows.
create function private.payroll_source(p_school uuid,p_start date,p_end date) returns jsonb
language sql stable security definer set search_path='' as $$
 select jsonb_build_object('policy_version',(select policy_version from public.schools where id=p_school),'sessions',coalesce(jsonb_agg(item order by session_id),'[]'::jsonb))
 from (
 select s.id session_id,jsonb_build_object(
  'session_id',s.id,'teacher_id',s.teacher_id,
  'minutes',case when s.effective_end is not null then floor(extract(epoch from (s.effective_end-s.effective_start))/60)::integer else null end,
  'hourly_mmk',r.hourly_mmk,
  'amount_mmk',case when s.effective_end is not null and r.id is not null then round(floor(extract(epoch from (s.effective_end-s.effective_start))/60)*r.hourly_mmk::numeric/60)::bigint else null end,
  'reason',case
   when s.capture_status='cancelled' then 'Cancelled'
   when s.capture_status<>'completed' or s.effective_end is null then 'Missing checkout'
   when exists(select 1 from public.correction_requests c where c.session_id=s.id and c.status='pending') then 'Pending correction'
   when s.verification<>'verified' then 'Awaiting verification'
   when exists(select 1 from public.session_exceptions e where e.session_id=s.id and e.resolved_at is null) then 'Unresolved exception'
   when not exists(select 1 from public.teacher_assignments a where a.school_id=s.school_id and a.teacher_id=s.teacher_id and a.class_id=s.class_id and a.starts_at<=s.effective_start and (a.ends_at is null or a.ends_at>s.effective_start)) and not exists(select 1 from public.session_exceptions e where e.session_id=s.id and e.flag='assignment_mismatch' and e.resolved_at is not null) then 'Assignment mismatch'
   when r.id is null then 'Missing rate'
   when exists(select 1 from public.session_allocations a where a.session_id=s.id and a.active) then 'Already allocated'
   else 'Eligible' end,
  'source',jsonb_build_object('session',to_jsonb(s),'rate',to_jsonb(r),
   'assignments',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.teacher_assignments a where a.school_id=s.school_id and a.teacher_id=s.teacher_id and a.class_id=s.class_id),'[]'::jsonb),
   'corrections',coalesce((select jsonb_agg(to_jsonb(c) order by c.id) from public.correction_requests c where c.session_id=s.id),'[]'::jsonb),
   'exceptions',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.session_exceptions e where e.session_id=s.id),'[]'::jsonb),
   'allocations',coalesce((select jsonb_agg(to_jsonb(a) order by a.id) from public.session_allocations a where a.session_id=s.id and a.active),'[]'::jsonb))) item
 from public.teaching_sessions s
 left join lateral(select rate.* from public.teacher_rates rate where rate.school_id=s.school_id and rate.teacher_id=s.teacher_id
  and rate.starts_at<=(((s.effective_start at time zone 'Asia/Yangon')::date)::timestamp at time zone 'Asia/Yangon')
  and (rate.ends_at is null or rate.ends_at>(((s.effective_start at time zone 'Asia/Yangon')::date)::timestamp at time zone 'Asia/Yangon')) order by rate.starts_at desc limit 1) r on true
 where s.school_id=p_school and (s.effective_start at time zone 'Asia/Yangon')::date between p_start and p_end
 ) entries
$$;
create function private.payroll_totals(p_run uuid) returns table(teacher_id uuid,gross_mmk bigint,adjustment_mmk bigint,net_mmk bigint)
language sql stable security definer set search_path='' as $$
 select teacher_id,sum(gross)::bigint,sum(adjustment)::bigint,(sum(gross)+sum(adjustment))::bigint from (
  select teacher_id,amount_mmk::numeric gross,0::numeric adjustment from public.payroll_lines where run_id=p_run
  union all select teacher_id,0::numeric,amount_mmk::numeric from public.payroll_adjustments where run_id=p_run
 ) entries group by teacher_id
$$;
create function private.fill_payroll_lines(p_run uuid,p_school uuid,p_source jsonb) returns void
language plpgsql security definer set search_path='' as $$
begin
 delete from public.payroll_lines where run_id=p_run;
 insert into public.payroll_lines(school_id,run_id,teacher_id,session_id,minutes,hourly_mmk,amount_mmk,source_versions)
 select p_school,p_run,(item->>'teacher_id')::uuid,(item->>'session_id')::uuid,(item->>'minutes')::integer,(item->>'hourly_mmk')::bigint,(item->>'amount_mmk')::bigint,item->'source'
 from jsonb_array_elements(p_source->'sessions') item where item->>'reason'='Eligible';
end $$;

create function private.payroll_command(p_operation text,p_entity uuid,p_version integer,p_key uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 school_value uuid; run_row public.payroll_runs; payment public.payment_records; prior public.idempotency_records;
 source_value jsonb; fingerprint jsonb; result_value jsonb; before_value jsonb; teacher_value uuid;
 start_value date;end_value date; amount_value bigint;net_value bigint;reason_value text;
begin
 if auth.uid() is null or p_key is null or p_input is null then raise exception 'ACCESS_DENIED';end if;
 if p_operation='calculate_payroll' then
  select school_id into school_value from public.memberships where user_id=auth.uid() and active and role='admin';
 elsif p_operation='reverse_payment' then
  select * into payment from public.payment_records where id=p_entity;
  select * into run_row from public.payroll_runs where id=payment.run_id;
  school_value:=run_row.school_id;
 else select * into run_row from public.payroll_runs where id=p_entity;school_value:=run_row.school_id;
 end if;
 if school_value is null or not private.is_admin(school_value) then raise exception 'ACCESS_DENIED';end if;
 -- Serialize financial operations per school, then lock all source parents in UUID order.
 perform pg_advisory_xact_lock(hashtextextended('sayasync-payroll:'||school_value::text,0));
 perform 1 from public.teachers where school_id=school_value order by id for update;
 perform 1 from public.schools where id=school_value for update;
 if run_row.id is not null then select * into run_row from public.payroll_runs where id=run_row.id for update;end if;
 if not private.is_admin(school_value) then raise exception 'ACCESS_DENIED';end if;
 fingerprint:=jsonb_build_object('entity',p_entity,'version',p_version,'input',p_input);
 select * into prior from public.idempotency_records where school_id=school_value and actor_id=auth.uid() and operation=p_operation and key=p_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'VERSION_CONFLICT';end if;return prior.result;end if;
 if p_operation<>'calculate_payroll' then
  if p_version is null or run_row.version<>p_version then raise exception 'VERSION_CONFLICT';end if;
  before_value:=to_jsonb(run_row)-'source_snapshot';
 end if;
 reason_value:=trim(coalesce(p_input->>'reason',''));
 if length(reason_value)>2000 then raise exception 'INVALID_REASON';end if;
 if p_operation in ('calculate_payroll','recalculate_payroll') then
  if p_operation='calculate_payroll' then
   start_value:=(p_input->>'start')::date;end_value:=(p_input->>'end')::date;
   if start_value is null or end_value is null or not isfinite(start_value) or not isfinite(end_value) or end_value<start_value or end_value-start_value>366 then raise exception 'INVALID_PERIOD';end if;
   insert into public.payroll_runs(school_id,starts_on,ends_on,policy_version,prepared_by,revision)
    values(school_value,start_value,end_value,(select policy_version from public.schools where id=school_value),auth.uid(),coalesce((select max(revision)+1 from public.payroll_runs where school_id=school_value and starts_on=start_value and ends_on=end_value),1)) returning * into run_row;
  elsif run_row.status<>'draft' then raise exception 'PAYROLL_LOCKED';end if;
  source_value:=private.payroll_source(school_value,run_row.starts_on,run_row.ends_on);
  perform private.fill_payroll_lines(run_row.id,school_value,source_value);
  update public.payroll_runs set source_snapshot=source_value,policy_version=(source_value->>'policy_version')::integer,
   total_mmk=coalesce((select sum(net_mmk) from private.payroll_totals(run_row.id)),0),version=version+1 where id=run_row.id returning * into run_row;
 elsif p_operation='set_payroll_adjustment' then
  if run_row.status<>'draft' then raise exception 'PAYROLL_LOCKED';end if;
  teacher_value:=(p_input->>'teacher_id')::uuid;amount_value:=(p_input->>'amount')::bigint;
  if amount_value is null or abs(amount_value::numeric)>9007199254740991 then raise exception 'INVALID_AMOUNT';end if;
  if reason_value='' then raise exception 'REASON_REQUIRED';end if;
  if length(coalesce(p_input->>'reference',''))>500 then raise exception 'INVALID_REFERENCE';end if;
  if not exists(select 1 from public.teachers where school_id=school_value and id=teacher_value) then raise exception 'ACCESS_DENIED';end if;
  before_value:=jsonb_build_object('run',before_value,'adjustment',(select to_jsonb(a) from public.payroll_adjustments a where run_id=run_row.id and teacher_id=teacher_value));
  insert into public.payroll_adjustments(school_id,run_id,teacher_id,amount_mmk,reason,reference) values(school_value,run_row.id,teacher_value,amount_value,reason_value,p_input->>'reference')
   on conflict(run_id,teacher_id) do update set amount_mmk=excluded.amount_mmk,reason=excluded.reason,reference=excluded.reference;
  update public.payroll_runs set total_mmk=coalesce((select sum(net_mmk) from private.payroll_totals(run_row.id)),0),version=version+1 where id=run_row.id returning * into run_row;
 elsif p_operation='approve_payroll' then
  if run_row.status<>'draft' then raise exception 'PAYROLL_LOCKED';end if;
  source_value:=private.payroll_source(school_value,run_row.starts_on,run_row.ends_on);
  if run_row.source_snapshot is null or run_row.source_snapshot<>source_value then raise exception 'DRAFT_STALE';end if;
  -- Rebuild before validating totals so even a trusted accidental draft edit cannot forge pay.
  perform private.fill_payroll_lines(run_row.id,school_value,source_value);
  if not exists(select 1 from private.payroll_totals(run_row.id)) then raise exception 'EMPTY_PAYROLL';end if;
  if exists(select 1 from private.payroll_totals(run_row.id) where net_mmk<0) then raise exception 'NEGATIVE_NET';end if;
  insert into public.session_allocations(school_id,session_id,run_id) select school_value,session_id,run_row.id from public.payroll_lines where run_id=run_row.id;
  update public.payroll_runs set status='approved',approved_at=clock_timestamp(),approved_by=auth.uid(),version=version+1,
   total_mmk=(select sum(net_mmk) from private.payroll_totals(run_row.id)) where id=run_row.id returning * into run_row;
 elsif p_operation='void_payroll' then
  if run_row.status<>'approved' then raise exception 'INVALID_STATE';end if;
  if reason_value='' then raise exception 'REASON_REQUIRED';end if;
  if exists(select 1 from public.payment_records where run_id=run_row.id) then raise exception 'PAYMENT_HISTORY_EXISTS';end if;
  update public.payroll_runs set status='void',void_reason=reason_value,voided_by=auth.uid(),voided_at=clock_timestamp(),version=version+1 where id=run_row.id returning * into run_row;
  update public.session_allocations set active=false where run_id=run_row.id and active;
 elsif p_operation='record_payment' then
  if run_row.status<>'approved' then raise exception 'INVALID_STATE';end if;
  teacher_value:=(p_input->>'teacher_id')::uuid;
  select net_mmk into net_value from private.payroll_totals(run_row.id) where teacher_id=teacher_value;
  if not found or net_value<0 then raise exception 'ACCESS_DENIED';end if;
  if exists(select 1 from public.payment_records where run_id=run_row.id and teacher_id=teacher_value and reversed_at is null) then raise exception 'PAYMENT_EXISTS';end if;
  if trim(coalesce(p_input->>'method',''))='' or length(p_input->>'method')>100 or trim(coalesce(p_input->>'reference',''))='' or length(p_input->>'reference')>500 or (p_input->>'paid_on') is null or not isfinite((p_input->>'paid_on')::date) then raise exception 'PAYMENT_DETAILS_REQUIRED';end if;
  insert into public.payment_records(school_id,run_id,teacher_id,amount_mmk,paid_on,method,reference,actor_id)
   values(school_value,run_row.id,teacher_value,net_value,(p_input->>'paid_on')::date,trim(p_input->>'method'),trim(p_input->>'reference'),auth.uid()) returning * into payment;
  -- Payment changes never mutate the frozen payroll run.
  result_value:=to_jsonb(payment);
 elsif p_operation='reverse_payment' then
  if reason_value='' then raise exception 'REASON_REQUIRED';end if;
  select * into payment from public.payment_records where id=p_entity for update;
  if payment.reversed_at is not null then raise exception 'VERSION_CONFLICT';end if;
  before_value:=to_jsonb(payment);
  update public.payment_records set reversed_at=clock_timestamp(),reversed_by=auth.uid(),reversal_reason=reason_value where id=payment.id returning * into payment;
  result_value:=to_jsonb(payment);
 else raise exception 'ACCESS_DENIED';end if;
 if result_value is null then result_value:=to_jsonb(run_row)-'source_snapshot';end if;
 if p_operation='set_payroll_adjustment' then result_value:=result_value||jsonb_build_object('adjustment',(select to_jsonb(a) from public.payroll_adjustments a where run_id=run_row.id and teacher_id=teacher_value));end if;
 if run_row.total_mmk is not null and abs(run_row.total_mmk::numeric)>9007199254740991 then raise exception 'AMOUNT_OVERFLOW';end if;
 if exists(select 1 from private.payroll_totals(run_row.id) where abs(net_mmk::numeric)>9007199254740991 or gross_mmk>9007199254740991) then raise exception 'AMOUNT_OVERFLOW';end if;
 insert into public.audit_events(school_id,actor_id,action,entity_id,before_snapshot,after_snapshot) values(school_value,auth.uid(),p_operation,coalesce(p_entity,run_row.id),before_value,result_value);
 insert into public.idempotency_records(school_id,actor_id,operation,key,fingerprint,result) values(school_value,auth.uid(),p_operation,p_key,fingerprint,result_value);
 return result_value;
end $$;

-- Preserve approved financial snapshots and historical audit/payment records.
create function private.guard_financial_history() returns trigger language plpgsql set search_path='' as $$
declare run_value uuid;status_value text;
begin
 if tg_table_name='audit_events' then raise exception 'IMMUTABLE_HISTORY';end if;
 if tg_table_name='payment_records' then
  if tg_op='DELETE' then raise exception 'IMMUTABLE_HISTORY';end if;
  if old.reversed_at is not null or new.reversed_at is null or (to_jsonb(new)-array['reversed_at','reversed_by','reversal_reason'])<>(to_jsonb(old)-array['reversed_at','reversed_by','reversal_reason']) then raise exception 'IMMUTABLE_HISTORY';end if;
  return new;
 end if;
 if tg_table_name='payroll_runs' then
  if old.status='void' then raise exception 'IMMUTABLE_SNAPSHOT';end if;
  if old.status='approved' then
   if tg_op='DELETE' then raise exception 'IMMUTABLE_SNAPSHOT';end if;
   if new.status<>'void' or new.void_reason is null or trim(new.void_reason)='' or new.voided_by is null or new.voided_at is null or new.version<>old.version+1 or
    (to_jsonb(new)-array['status','version','void_reason','voided_by','voided_at'])<>(to_jsonb(old)-array['status','version','void_reason','voided_by','voided_at']) then raise exception 'IMMUTABLE_SNAPSHOT';end if;
   if exists(select 1 from public.payment_records where run_id=old.id) then raise exception 'PAYMENT_HISTORY_EXISTS';end if;
  end if;
 else
  if tg_op='DELETE' then run_value:=old.run_id;else run_value:=new.run_id;end if;
  if tg_op='UPDATE' and (new.run_id<>old.run_id or new.teacher_id<>old.teacher_id or new.school_id<>old.school_id) then raise exception 'IMMUTABLE_SNAPSHOT';end if;
  select status into status_value from public.payroll_runs where id=run_value;
  if status_value<>'draft' then raise exception 'IMMUTABLE_SNAPSHOT';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
create trigger immutable_payroll_run before update or delete on public.payroll_runs for each row execute function private.guard_financial_history();
create trigger immutable_payroll_lines before insert or update or delete on public.payroll_lines for each row execute function private.guard_financial_history();
create trigger immutable_adjustments before insert or update or delete on public.payroll_adjustments for each row execute function private.guard_financial_history();
create trigger immutable_payment_history before update or delete on public.payment_records for each row execute function private.guard_financial_history();
create trigger immutable_audit before update or delete on public.audit_events for each row execute function private.guard_financial_history();

create function public.calculate_payroll(p_start date,p_end date,p_idempotency_key uuid) returns jsonb language sql security definer set search_path='' as $$select private.payroll_command('calculate_payroll',null,null,p_idempotency_key,jsonb_build_object('start',p_start,'end',p_end))$$;
create function public.recalculate_payroll(p_run_id uuid,p_expected_version integer,p_idempotency_key uuid) returns jsonb language sql security definer set search_path='' as $$select private.payroll_command('recalculate_payroll',p_run_id,p_expected_version,p_idempotency_key,'{}'::jsonb)$$;
create function public.approve_payroll(p_run_id uuid,p_expected_version integer,p_idempotency_key uuid) returns jsonb language sql security definer set search_path='' as $$select private.payroll_command('approve_payroll',p_run_id,p_expected_version,p_idempotency_key,'{}'::jsonb)$$;
create function public.void_payroll(p_run_id uuid,p_expected_version integer,p_idempotency_key uuid,p_reason text) returns jsonb language sql security definer set search_path='' as $$select private.payroll_command('void_payroll',p_run_id,p_expected_version,p_idempotency_key,jsonb_build_object('reason',p_reason))$$;
create function public.set_payroll_adjustment(p_run_id uuid,p_expected_version integer,p_idempotency_key uuid,p_teacher_id uuid,p_amount bigint,p_reason text,p_reference text default '') returns jsonb language sql security definer set search_path='' as $$select private.payroll_command('set_payroll_adjustment',p_run_id,p_expected_version,p_idempotency_key,jsonb_build_object('teacher_id',p_teacher_id,'amount',p_amount,'reason',p_reason,'reference',p_reference))$$;
create function public.record_payment(p_run_id uuid,p_expected_version integer,p_idempotency_key uuid,p_teacher_id uuid,p_paid_on date,p_method text,p_reference text) returns jsonb language sql security definer set search_path='' as $$select private.payroll_command('record_payment',p_run_id,p_expected_version,p_idempotency_key,jsonb_build_object('teacher_id',p_teacher_id,'paid_on',p_paid_on,'method',p_method,'reference',p_reference))$$;
create function public.reverse_payment(p_payment_id uuid,p_expected_version integer,p_idempotency_key uuid,p_reason text) returns jsonb language sql security definer set search_path='' as $$select private.payroll_command('reverse_payment',p_payment_id,p_expected_version,p_idempotency_key,jsonb_build_object('reason',p_reason))$$;

create function public.get_payroll_detail(p_run_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.payroll_runs;begin
 select * into r from public.payroll_runs where id=p_run_id;
 if not found or not private.is_admin(r.school_id) then raise exception 'ACCESS_DENIED';end if;
 return jsonb_build_object('run',to_jsonb(r)-'source_snapshot',
 'held',coalesce((select jsonb_agg(jsonb_build_object('session_id',item->'session_id','teacher_id',item->'teacher_id','reason',item->'reason')) from jsonb_array_elements(r.source_snapshot->'sessions') item where item->>'reason'<>'Eligible'),'[]'::jsonb),
 'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.teacher_id,l.session_id) from public.payroll_lines l where run_id=r.id),'[]'::jsonb),
 'adjustments',coalesce((select jsonb_agg(to_jsonb(a) order by a.teacher_id) from public.payroll_adjustments a where run_id=r.id),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.payment_records p where run_id=r.id),'[]'::jsonb),
 'summaries',coalesce((select jsonb_agg(to_jsonb(t) order by t.teacher_id) from private.payroll_totals(r.id) t),'[]'::jsonb));
end $$;
create function public.get_my_payments() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare t public.teachers;result_value jsonb;begin
 select teacher.* into t from public.teachers teacher where private.owns_teacher(teacher.school_id,teacher.id);
 if not found then raise exception 'ACCESS_DENIED';end if;
 select coalesce(jsonb_agg(jsonb_build_object('run_id',r.id,'starts_on',r.starts_on,'ends_on',r.ends_on,'approved_at',r.approved_at,'summary',to_jsonb(totals),
 'lines',(select coalesce(jsonb_agg(to_jsonb(l) order by l.session_id),'[]'::jsonb) from public.payroll_lines l where l.run_id=r.id and l.teacher_id=t.id),
 'adjustments',(select coalesce(jsonb_agg(to_jsonb(a)),'[]'::jsonb) from public.payroll_adjustments a where a.run_id=r.id and a.teacher_id=t.id),
 'payments',(select coalesce(jsonb_agg(to_jsonb(p) order by p.created_at),'[]'::jsonb) from public.payment_records p where p.run_id=r.id and p.teacher_id=t.id)) order by r.starts_on desc),'[]'::jsonb)
 into result_value from public.payroll_runs r cross join lateral private.payroll_totals(r.id) totals where r.school_id=t.school_id and r.status='approved' and totals.teacher_id=t.id;
 return result_value;
end $$;
revoke all on function private.lock_payroll_source(),private.payroll_source(uuid,date,date),private.payroll_totals(uuid),private.fill_payroll_lines(uuid,uuid,jsonb),private.payroll_command(text,uuid,integer,uuid,jsonb),private.guard_financial_history() from public,anon,authenticated;
revoke all on function public.calculate_payroll(date,date,uuid),public.recalculate_payroll(uuid,integer,uuid),public.approve_payroll(uuid,integer,uuid),public.void_payroll(uuid,integer,uuid,text),public.set_payroll_adjustment(uuid,integer,uuid,uuid,bigint,text,text),public.record_payment(uuid,integer,uuid,uuid,date,text,text),public.reverse_payment(uuid,integer,uuid,text),public.get_payroll_detail(uuid),public.get_my_payments() from public,anon;
grant execute on function public.calculate_payroll(date,date,uuid),public.recalculate_payroll(uuid,integer,uuid),public.approve_payroll(uuid,integer,uuid),public.void_payroll(uuid,integer,uuid,text),public.set_payroll_adjustment(uuid,integer,uuid,uuid,bigint,text,text),public.record_payment(uuid,integer,uuid,uuid,date,text,text),public.reverse_payment(uuid,integer,uuid,text),public.get_payroll_detail(uuid),public.get_my_payments() to authenticated;
commit;
