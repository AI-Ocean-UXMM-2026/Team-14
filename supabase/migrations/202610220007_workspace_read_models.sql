-- Complete dashboard totals and paged record/review reads. RLS remains authoritative.
begin;
-- Fail before changing anything if the prior increment was not fully installed.
do $$begin
 if not exists(select 1 from pg_constraint where conrelid='public.teaching_sessions'::regclass and contype='c' and pg_get_constraintdef(oid) like '%correction_hold%')
 or not coalesce(position('capture_correction_hold' in pg_get_functiondef(to_regprocedure('public.check_in(uuid,uuid)')))>0,false)
 or not coalesce(position('capture_hold_version' in pg_get_functiondef(to_regprocedure('private.review_command(text,uuid,integer,uuid,jsonb)')))>0,false)
 then raise exception 'MIGRATION_006_INCOMPLETE: review the installed 006 definitions before applying 007; do not delete existing columns';end if;
end $$;
create or replace function public.get_navigation_count() returns bigint language plpgsql stable security invoker set search_path='' as $$
declare member public.memberships;value bigint;
begin
 select * into member from public.memberships where user_id=auth.uid() and active;if member.id is null then raise exception 'ACCESS_DENIED';end if;
 select (select count(*) from public.correction_requests where school_id=member.school_id and status='pending') + case when member.role='admin' then (select count(*) from public.teaching_sessions s where school_id=member.school_id and capture_status='completed' and verification='pending' and not exists(select 1 from public.correction_requests q where q.session_id=s.id and q.status='pending') and not exists(select 1 from public.session_allocations a where a.session_id=s.id and a.active)) else 0 end into value;
 return value;
end $$;
revoke all on function public.get_navigation_count() from public,anon;
grant execute on function public.get_navigation_count() to authenticated;
create or replace function public.get_workspace(
 p_view text default 'overview',p_query text default '',p_status text default '',
 p_review text default 'corrections',p_tab text default 'pending',p_offset integer default 0,p_limit integer default 50
) returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare member public.memberships; selected uuid[]; all_ids uuid[]; total bigint; result jsonb; stats jsonb; eligible_minutes bigint:=0;eligible_mmk numeric:=0;unpaid numeric:=0; page_size integer;page_offset integer; today date:=(now() at time zone 'Asia/Yangon')::date;
begin
 select * into member from public.memberships where user_id=auth.uid() and active;
 if member.id is null then raise exception 'ACCESS_DENIED';end if;
 if p_view not in ('overview','home','sessions','reviews') or p_review not in ('sessions','corrections') or p_tab not in ('pending','approved','rejected','withdrawn','all') then raise exception 'INVALID_FILTER';end if;
 page_size:=greatest(1,least(coalesce(p_limit,50),100));page_offset:=greatest(coalesce(p_offset,0),0);
 -- All joins execute as the caller. Teachers cannot read other teachers or raw rates.
 with candidates as (
  select s.id,s.effective_start from public.teaching_sessions s join public.teachers t on t.id=s.teacher_id join public.classes c on c.id=s.class_id
  where s.school_id=member.school_id
  and (coalesce(p_query,'')='' or strpos(lower(t.name||' '||t.code||' '||c.subject||' '||s.id::text),lower(p_query))>0)
  and (coalesce(p_status,'')='' or p_status=case when s.capture_status='cancelled' then 'Cancelled' when s.effective_end is null then case when s.capture_status='correction_hold' or (s.effective_start at time zone 'Asia/Yangon')::date<today then 'Missing checkout' else 'In progress' end else initcap(s.verification) end)
  and (p_view<>'reviews' or case when p_review='sessions' then
   s.capture_status='completed' and s.verification='pending' and not exists(select 1 from public.correction_requests q where q.session_id=s.id and q.status='pending') and not exists(select 1 from public.session_allocations a where a.session_id=s.id and a.active)
   else exists(select 1 from public.correction_requests q where q.session_id=s.id and (p_tab='all' or q.status=p_tab)) end)
 ), paged as (select id from candidates order by effective_start desc,id desc limit page_size offset page_offset)
 select (select count(*) from candidates),(select coalesce(array_agg(id),'{}'::uuid[]) from paged) into total,selected;
 select array_agg(distinct id) into all_ids from (
  select unnest(selected) id union all select id from public.teaching_sessions where school_id=member.school_id and capture_status in ('in_progress','correction_hold')
 ) ids;
 if member.role='admin' then
  -- Same duration, start-date rate, hold and allocation rules used by payroll_source.
  select coalesce(sum(floor(extract(epoch from(s.effective_end-s.effective_start))/60)),0),
   coalesce(sum(round(floor(extract(epoch from(s.effective_end-s.effective_start))/60)*r.hourly_mmk::numeric/60)),0)
  into eligible_minutes,eligible_mmk
  from public.teaching_sessions s join lateral(
   select rate.hourly_mmk from public.teacher_rates rate where rate.teacher_id=s.teacher_id and rate.school_id=s.school_id
   and rate.starts_at<=date_trunc('day',s.effective_start at time zone 'Asia/Yangon') at time zone 'Asia/Yangon'
   and (rate.ends_at is null or rate.ends_at>date_trunc('day',s.effective_start at time zone 'Asia/Yangon') at time zone 'Asia/Yangon') order by rate.starts_at desc limit 1
  ) r on true
  where s.school_id=member.school_id and s.capture_status='completed' and s.verification='verified'
  and not exists(select 1 from public.correction_requests q where q.session_id=s.id and q.status='pending')
  and not exists(select 1 from public.session_exceptions e where e.session_id=s.id and e.resolved_at is null)
  and not exists(select 1 from public.session_allocations a where a.session_id=s.id and a.active)
  and (exists(select 1 from public.teacher_assignments a where a.teacher_id=s.teacher_id and a.class_id=s.class_id and a.starts_at<=s.effective_start and (a.ends_at is null or a.ends_at>s.effective_start))
   or exists(select 1 from public.session_exceptions e where e.session_id=s.id and e.flag='assignment_mismatch' and e.resolved_at is not null));
 elsif exists(select 1 from public.teachers where school_id=member.school_id) then
  select coalesce(sum((item->'summary'->>'net_mmk')::numeric),0) into unpaid from jsonb_array_elements(public.get_my_payments()) item
  where not exists(select 1 from jsonb_array_elements(item->'payments') payment where payment->>'reversed_at' is null);
 end if;
 select jsonb_build_object(
  'active_teachers',(select count(*) from public.teachers where school_id=member.school_id and active),
  'active_classes',(select count(*) from public.classes where school_id=member.school_id and active),
  'eligible_minutes',eligible_minutes,'eligible_mmk',eligible_mmk,'awaiting_mmk',unpaid,
  'record_count',count(*),'verified_minutes',coalesce(sum(case when s.verification='verified' and s.capture_status='completed' then floor(extract(epoch from(s.effective_end-s.effective_start))/60) else 0 end),0),
  'verify_count',count(*) filter(where s.capture_status='completed' and s.verification='pending' and not exists(select 1 from public.correction_requests q where q.session_id=s.id and q.status='pending') and not exists(select 1 from public.session_allocations a where a.session_id=s.id and a.active)),
  'missing_count',count(*) filter(where s.capture_status in ('in_progress','correction_hold') and (s.capture_status='correction_hold' or (s.effective_start at time zone 'Asia/Yangon')::date<today)),
  'correction_count',(select count(*) from public.correction_requests where school_id=member.school_id and status='pending')
 ) into stats from public.teaching_sessions s where s.school_id=member.school_id;
 select jsonb_build_object('stats',stats,'total',total,'offset',page_offset,'limit',page_size,'record_ids',to_jsonb(selected),
  'sessions',coalesce((select jsonb_agg(to_jsonb(s) order by s.effective_start desc,s.id desc) from public.teaching_sessions s where s.id=any(all_ids)),'[]'),
  'teachers',coalesce((select jsonb_agg(to_jsonb(t) order by t.name,t.id) from public.teachers t where school_id=member.school_id),'[]'),
  'classes',coalesce((select jsonb_agg(to_jsonb(c) order by c.code,c.id) from public.classes c where school_id=member.school_id),'[]'),
  'assignments',coalesce((select jsonb_agg(to_jsonb(a)) from public.teacher_assignments a where school_id=member.school_id and starts_at<=now() and (ends_at is null or ends_at>now())),'[]'),
  'corrections',coalesce((select jsonb_agg(to_jsonb(q) order by q.created_at desc,q.id desc) from public.correction_requests q where q.session_id=any(all_ids)),'[]'),
  'exceptions',coalesce((select jsonb_agg(to_jsonb(e)) from public.session_exceptions e where e.session_id=any(all_ids)),'[]'),
  'allocations',coalesce((select jsonb_agg(jsonb_build_object('session_id',a.session_id)) from public.session_allocations a where a.session_id=any(all_ids) and a.active),'[]'),
  'reviews',coalesce((select jsonb_agg(to_jsonb(r) order by r.created_at desc) from public.session_reviews r where r.session_id=any(all_ids)),'[]'),
  'activity',coalesce((with ending as (select coalesce(max((effective_start at time zone 'Asia/Yangon')::date),today) d from public.teaching_sessions where school_id=member.school_id), days as (select d-i as activity_date from ending cross join generate_series(0,6) i) select jsonb_agg(jsonb_build_object('date',activity_date,'hours',coalesce((select sum(floor(extract(epoch from(s.effective_end-s.effective_start))/60))/60 from public.teaching_sessions s where s.school_id=member.school_id and s.capture_status<>'cancelled' and (s.effective_start at time zone 'Asia/Yangon')::date=activity_date),0)) order by activity_date) from days),'[]')
 ) into result;
 return result;
end $$;
revoke all on function public.get_workspace(text,text,text,text,text,integer,integer) from public,anon;
grant execute on function public.get_workspace(text,text,text,text,text,integer,integer) to authenticated;
create or replace function public.get_payroll_detail(p_run_id uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r public.payroll_runs;begin
 select * into r from public.payroll_runs where id=p_run_id;
 if not found or not private.is_admin(r.school_id) then raise exception 'ACCESS_DENIED';end if;
 return jsonb_build_object('is_stale',r.status='draft' and r.source_snapshot is distinct from private.payroll_source(r.school_id,r.starts_on,r.ends_on),'run',to_jsonb(r)-'source_snapshot',
 'held',coalesce((select jsonb_agg(jsonb_build_object('session_id',item->'session_id','teacher_id',item->'teacher_id','reason',item->'reason')) from jsonb_array_elements(r.source_snapshot->'sessions') item where item->>'reason'<>'Eligible'),'[]'::jsonb),
 'lines',coalesce((select jsonb_agg(to_jsonb(l) order by l.teacher_id,l.session_id) from public.payroll_lines l where run_id=r.id),'[]'::jsonb),
 'adjustments',coalesce((select jsonb_agg(to_jsonb(a) order by a.teacher_id) from public.payroll_adjustments a where run_id=r.id),'[]'::jsonb),
 'payments',coalesce((select jsonb_agg(to_jsonb(p) order by p.created_at) from public.payment_records p where run_id=r.id),'[]'::jsonb),
 'summaries',coalesce((select jsonb_agg(to_jsonb(t) order by t.teacher_id) from private.payroll_totals(r.id) t),'[]'::jsonb));
end $$;

-- A Teacher receives only their own approved payment rows, never drafts or other Teachers.
create or replace function public.get_payment_register(p_status text default 'all',p_run uuid default null,p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare member public.memberships;owner_teacher uuid;result jsonb;
begin
 select * into member from public.memberships where user_id=auth.uid() and active;
 if member.id is null then raise exception 'ACCESS_DENIED';end if;
 if member.role='teacher' then
  select id into owner_teacher from public.teachers where school_id=member.school_id and membership_id=member.id;
  if owner_teacher is null then raise exception 'ACCESS_DENIED';end if;
 end if;
 if p_status is null or p_status not in ('all','paid','unpaid') then raise exception 'INVALID_FILTER';end if;
 with entries as materialized (
  select r.id run_id,r.version run_version,r.starts_on,r.ends_on,t.id teacher_id,t.name,t.code,totals.gross_mmk,totals.adjustment_mmk,totals.net_mmk,
   exists(select 1 from public.payment_records payment where payment.run_id=r.id and payment.teacher_id=t.id and payment.reversed_at is null) paid
  from public.payroll_runs r cross join lateral private.payroll_totals(r.id) totals join public.teachers t on t.id=totals.teacher_id and t.school_id=r.school_id
  where r.school_id=member.school_id and r.status='approved' and (member.role='admin' or t.id=owner_teacher)
 ), filtered as (select * from entries where (p_run is null or run_id=p_run) and (p_status='all' or paid=(p_status='paid'))),
 paged as (select * from filtered order by starts_on desc,run_id,teacher_id limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(0,coalesce(p_offset,0)))
 select jsonb_build_object(
  'nav_count',public.get_navigation_count(),'profile',(select jsonb_build_object('name',t.name,'code',t.code) from public.teachers t where t.id=owner_teacher),
  'total',(select count(*) from filtered),
  'stats',(select jsonb_build_object('periods',count(distinct run_id),'approved_mmk',coalesce(sum(net_mmk),0),'paid_mmk',coalesce(sum(net_mmk) filter(where paid),0),'unpaid_count',count(*) filter(where not paid)) from filtered),
  'runs',coalesce((select jsonb_agg(to_jsonb(r) order by starts_on desc,run_id) from (select distinct run_id,starts_on,ends_on from entries) r),'[]'),
  'rows',coalesce((select jsonb_agg(to_jsonb(row)||jsonb_build_object(
   'lines',(select coalesce(jsonb_agg(to_jsonb(l) order by session_id),'[]') from public.payroll_lines l where l.run_id=row.run_id and l.teacher_id=row.teacher_id),
   'adjustments',(select coalesce(jsonb_agg(to_jsonb(a)),'[]') from public.payroll_adjustments a where a.run_id=row.run_id and a.teacher_id=row.teacher_id),
   'payments',(select coalesce(jsonb_agg(to_jsonb(p) order by created_at),'[]') from public.payment_records p where p.run_id=row.run_id and p.teacher_id=row.teacher_id)) order by starts_on desc,run_id,teacher_id) from paged row),'[]')
 ) into result;
 return result;
end $$;
revoke all on function public.get_payment_register(text,uuid,integer,integer) from public,anon;
grant execute on function public.get_payment_register(text,uuid,integer,integer) to authenticated;

-- Class-side assignment changes are one versioned, audited command, never N browser writes.
create or replace function public.set_class_assignments(p_class_id uuid,p_expected_version integer,p_expected_teacher_ids uuid[],p_teacher_ids uuid[],p_reason text,p_idempotency_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare school_value uuid;c public.classes;prior public.idempotency_records;fingerprint jsonb;old_ids uuid[];expected_ids uuid[];new_ids uuid[];stamp timestamptz:=clock_timestamp();result jsonb;before_value jsonb;teacher_value uuid;
begin
 select school_id into school_value from public.memberships where user_id=auth.uid() and active and role='admin';
 if school_value is null or p_idempotency_key is null then raise exception 'ACCESS_DENIED';end if;
 perform pg_advisory_xact_lock(hashtextextended('sayasync-payroll:'||school_value::text,0));
 perform 1 from public.teachers where school_id=school_value order by id for update;
 select * into c from public.classes where id=p_class_id and school_id=school_value for update;
 if c.id is null or not private.is_admin(school_value) then raise exception 'ACCESS_DENIED';end if;
 fingerprint:=jsonb_build_object('class',p_class_id,'version',p_expected_version,'expected',p_expected_teacher_ids,'teachers',p_teacher_ids,'reason',p_reason);
 select * into prior from public.idempotency_records where school_id=school_value and actor_id=auth.uid() and operation='set_class_assignments' and key=p_idempotency_key;
 if found then if prior.fingerprint<>fingerprint then raise exception 'VERSION_CONFLICT';end if;return prior.result;end if;
 if p_expected_version is null or p_expected_version<>c.version or p_expected_teacher_ids is null or p_teacher_ids is null then raise exception 'VERSION_CONFLICT';end if;
 if trim(coalesce(p_reason,''))='' then raise exception 'REASON_REQUIRED';end if;
 if length(p_reason)>2000 then raise exception 'INVALID_REASON';end if;
 select coalesce(array_agg(distinct teacher_id order by teacher_id),'{}') into old_ids from public.teacher_assignments where class_id=c.id and starts_at<=stamp and (ends_at is null or ends_at>stamp);
 select coalesce(array_agg(distinct id order by id),'{}') into expected_ids from unnest(p_expected_teacher_ids) id;
 select coalesce(array_agg(distinct id order by id),'{}') into new_ids from unnest(p_teacher_ids) id;
 if old_ids<>expected_ids then raise exception 'VERSION_CONFLICT';end if;
 if exists(select 1 from unnest(new_ids) candidate(teacher_id) where not exists(select 1 from public.teachers where teachers.id=candidate.teacher_id and school_id=school_value)) then raise exception 'ACCESS_DENIED';end if;
 if not c.active and cardinality(new_ids)>0 then raise exception 'INVALID_STATE';end if;
 before_value:=jsonb_build_object('class',to_jsonb(c),'teachers',to_jsonb(old_ids));
 update public.teacher_assignments set ends_at=stamp,version=version+1 where class_id=c.id and starts_at<stamp and (ends_at is null or ends_at>stamp) and not teacher_id=any(new_ids);
 foreach teacher_value in array new_ids loop
  if not teacher_value=any(old_ids) then insert into public.teacher_assignments(school_id,teacher_id,class_id,starts_at,reason) values(school_value,teacher_value,c.id,stamp,trim(p_reason));end if;
 end loop;
 update public.teachers set version=version+1 where school_id=school_value and (id=any(old_ids) or id=any(new_ids)) and not (id=any(old_ids) and id=any(new_ids));
 update public.classes set version=version+1 where id=c.id returning * into c;
 result:=to_jsonb(c)||jsonb_build_object('teachers',to_jsonb(new_ids));
 insert into public.audit_events(school_id,actor_id,action,entity_id,before_snapshot,after_snapshot) values(school_value,auth.uid(),'set_class_assignments',c.id,before_value,result||jsonb_build_object('reason',trim(p_reason)));
 insert into public.idempotency_records(school_id,actor_id,operation,key,fingerprint,result) values(school_value,auth.uid(),'set_class_assignments',p_idempotency_key,fingerprint,result);
 return result;
end $$;
revoke all on function public.set_class_assignments(uuid,integer,uuid[],uuid[],text,uuid) from public,anon;
grant execute on function public.set_class_assignments(uuid,integer,uuid[],uuid[],text,uuid) to authenticated;

create or replace function public.get_management(p_offset integer default 0,p_limit integer default 50)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare school_value uuid;result jsonb;
begin
 select school_id into school_value from public.memberships where user_id=auth.uid() and active and role='admin';
 if school_value is null then raise exception 'ACCESS_DENIED';end if;
 select jsonb_build_object(
  'nav_count',public.get_navigation_count(),
  'teachers',coalesce((select jsonb_agg(to_jsonb(t) order by name,id) from public.teachers t where school_id=school_value),'[]'),
  'classes',coalesce((select jsonb_agg(to_jsonb(c) order by code,id) from public.classes c where school_id=school_value),'[]'),
  'rates',coalesce((select jsonb_agg(to_jsonb(r) order by starts_at desc) from public.teacher_rates r where school_id=school_value),'[]'),
  'assignments',coalesce((select jsonb_agg(to_jsonb(a) order by starts_at desc) from public.teacher_assignments a where school_id=school_value and starts_at<=now() and (ends_at is null or ends_at>now())),'[]'),
  'audit_total',(select count(*) from public.audit_events where school_id=school_value),
  'audit',coalesce((select jsonb_agg(to_jsonb(a)||jsonb_build_object(
    'actor_name',coalesce((select t.name from public.teachers t join public.memberships m on m.id=t.membership_id where m.user_id=a.actor_id), 'School administrator'),
    'entity_name',coalesce((select t.name from public.teachers t where t.id=a.entity_id),(select c.name from public.classes c where c.id=a.entity_id),(select t.name||' · '||c.subject from public.teaching_sessions s join public.teachers t on t.id=s.teacher_id join public.classes c on c.id=s.class_id where s.id=a.entity_id),(select r.starts_on::text||' → '||r.ends_on::text from public.payroll_runs r where r.id=a.entity_id),(select t.name||' · '||c.subject from public.correction_requests q join public.teaching_sessions session on session.id=q.session_id join public.teachers t on t.id=session.teacher_id join public.classes c on c.id=session.class_id where q.id=a.entity_id),(select t.name||' · '||r.starts_on::text||' → '||r.ends_on::text from public.payment_records payment join public.teachers t on t.id=payment.teacher_id join public.payroll_runs r on r.id=payment.run_id where payment.id=a.entity_id),(select t.name||' · '||c.subject from public.session_exceptions e join public.teaching_sessions session on session.id=e.session_id join public.teachers t on t.id=session.teacher_id join public.classes c on c.id=session.class_id where e.id=a.entity_id),'Workspace record'),
    'reason',coalesce(a.after_snapshot->>'reason',a.after_snapshot->'input'->>'reason',a.after_snapshot->'result'->>'decision_reason',a.after_snapshot->'result'->>'reason','')) order by a.created_at desc,a.id desc) from (select id,action,entity_id,created_at,actor_id,after_snapshot from public.audit_events where school_id=school_value order by created_at desc,id desc limit greatest(1,least(coalesce(p_limit,50),100)) offset greatest(0,coalesce(p_offset,0))) a),'[]')
 ) into result;
 -- Audit snapshots are used only to derive a reason and are never returned by this read model.
 result:=jsonb_set(result,'{audit}',coalesce((select jsonb_agg(item-'after_snapshot') from jsonb_array_elements(result->'audit') item),'[]'));
 return result;
end $$;
revoke all on function public.get_management(integer,integer) from public,anon;
grant execute on function public.get_management(integer,integer) to authenticated;
create or replace function public.manage_workspace(p_operation text,p_entity uuid,p_expected_version integer,p_idempotency_key uuid,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare school_value uuid;t public.teachers;c public.classes;prior public.idempotency_records;fingerprint jsonb;before_value jsonb;result_value jsonb;reason_value text;stamp timestamptz:=clock_timestamp();from_value timestamptz;next_rate timestamptz;rate_value bigint;member_value uuid;user_value uuid;class_value uuid;code_value text;number_value numeric;
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
  select coalesce(max(substring(code from 2)::numeric),0)+1 into number_value from public.teachers where school_id=school_value and code~'^T[0-9]+$';
  code_value:='T'||lpad(number_value::text,greatest(3,length(number_value::text)),'0');
  insert into public.teachers(school_id,code,name,email) values(school_value,code_value,trim(p_input->>'name'),trim(p_input->>'email')) returning * into t;
  insert into public.teacher_rates(school_id,teacher_id,starts_at,hourly_mmk,reason,actor_id) values(school_value,t.id,from_value,rate_value,'Initial hourly rate',auth.uid());
 elsif p_operation='create_class' then
  code_value:=trim(coalesce(p_input->>'code',''));
  if code_value='' then select coalesce(max(substring(code from 2)::numeric),100)+1 into number_value from public.classes where school_id=school_value and code~'^C[0-9]+$';code_value:='C'||number_value::text;end if;
  if length(code_value)>50 or trim(coalesce(p_input->>'name',''))='' or length(p_input->>'name')>200 or trim(coalesce(p_input->>'subject',''))='' or length(p_input->>'subject')>200 then raise exception 'INVALID_PROFILE';end if;
  insert into public.classes(school_id,code,name,subject) values(school_value,code_value,trim(p_input->>'name'),trim(p_input->>'subject')) returning * into c;
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
comment on function public.get_workspace(text,text,text,text,text,integer,integer) is 'SayaSync migration 007: complete RLS dashboard and paged records';
comment on function public.get_payment_register(text,uuid,integer,integer) is 'SayaSync migration 007: approved payment register with explicit Teacher ownership';
comment on function public.get_management(integer,integer) is 'SayaSync migration 007: Admin management and paged readable audit';
comment on function public.set_class_assignments(uuid,integer,uuid[],uuid[],text,uuid) is 'SayaSync migration 007: atomic versioned class assignments';
commit;
