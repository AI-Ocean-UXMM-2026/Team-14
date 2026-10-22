-- Initial development schema. Apply to a NEW development project after review.
-- Monetary values are integer MMK. All timestamps are UTC timestamptz.
begin;
create schema if not exists private;
revoke all on schema private from public;
create table public.schools (
 id uuid primary key default gen_random_uuid(), name text not null,
 timezone text not null default 'Asia/Yangon' check(timezone='Asia/Yangon'),
 currency text not null default 'MMK' check(currency='MMK'),
 policy_version integer not null default 1 check(policy_version>0), created_at timestamptz not null default now()
);
create table public.memberships (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 user_id uuid not null references auth.users(id), role text not null check(role in ('admin','teacher')),
 active boolean not null default true, created_at timestamptz not null default now(),
 unique(user_id), unique(school_id,id)
);
create table public.teachers (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 membership_id uuid, code text not null, name text not null, active boolean not null default true,
 version integer not null default 1, created_at timestamptz not null default now(),
 unique(school_id,id), unique(school_id,code), unique(membership_id),
 foreign key(school_id,membership_id) references public.memberships(school_id,id)
);
create table public.classes (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 code text not null, subject text not null, active boolean not null default true,
 version integer not null default 1, unique(school_id,id), unique(school_id,code)
);
create table public.teacher_assignments (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, teacher_id uuid not null, class_id uuid not null,
 starts_at timestamptz not null, ends_at timestamptz, reason text not null check(length(trim(reason))>0), version integer not null default 1,
 unique(school_id,id), foreign key(school_id,teacher_id) references public.teachers(school_id,id),
 foreign key(school_id,class_id) references public.classes(school_id,id), check(ends_at is null or ends_at>starts_at)
);
create table public.teacher_rates (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, teacher_id uuid not null,
 starts_at timestamptz not null, ends_at timestamptz, hourly_mmk bigint not null check(hourly_mmk>0),
 reason text not null check(length(trim(reason))>0), actor_id uuid not null references auth.users(id), version integer not null default 1,
 unique(school_id,id), foreign key(school_id,teacher_id) references public.teachers(school_id,id), check(ends_at is null or ends_at>starts_at)
);
-- A trigger uses a parent-row lock, avoiding a btree_gist extension dependency.
create function private.prevent_rate_overlap() returns trigger language plpgsql set search_path='' as $$
begin
 perform 1 from public.teachers where school_id=new.school_id and id=new.teacher_id for update;
 if exists(select 1 from public.teacher_rates r where r.school_id=new.school_id and r.teacher_id=new.teacher_id and r.id<>new.id and tstzrange(r.starts_at,r.ends_at,'[)') && tstzrange(new.starts_at,new.ends_at,'[)')) then
 raise exception 'RATE_INTERVAL_OVERLAP'; end if;
 return new;
end $$;
create trigger rate_overlap before insert or update on public.teacher_rates for each row execute function private.prevent_rate_overlap();
create table public.teaching_sessions (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, teacher_id uuid not null, class_id uuid not null,
 original_start timestamptz not null, original_end timestamptz,
 effective_start timestamptz not null, effective_end timestamptz,
 capture_status text not null default 'in_progress' check(capture_status in ('in_progress','completed','cancelled')),
 verification text not null default 'pending' check(verification in ('pending','verified','rejected')),
 source text not null check(source in ('teacher','admin')), actor_id uuid not null references auth.users(id),
 version integer not null default 1 check(version>0), created_at timestamptz not null default now(),
 unique(school_id,id), foreign key(school_id,teacher_id) references public.teachers(school_id,id),
 foreign key(school_id,class_id) references public.classes(school_id,id),
 check(original_end is null or original_end>original_start), check(effective_end is null or effective_end>effective_start),
 check((capture_status='in_progress' and effective_end is null) or (capture_status='completed' and effective_end is not null) or capture_status='cancelled')
);
create unique index one_open_session on public.teaching_sessions(school_id,teacher_id) where capture_status='in_progress';
create unique index no_exact_duplicate on public.teaching_sessions(school_id,teacher_id,class_id,effective_start,effective_end) where capture_status='completed';
create table public.correction_requests (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, session_id uuid not null,
 base_version integer not null, prior_snapshot jsonb not null, proposed_start timestamptz not null, proposed_end timestamptz not null,
 reason text not null check(length(trim(reason))>0), status text not null default 'pending' check(status in ('pending','approved','rejected','withdrawn')),
 actor_id uuid not null references auth.users(id), reviewer_id uuid references auth.users(id), decision_reason text,
 created_at timestamptz not null default now(), foreign key(school_id,session_id) references public.teaching_sessions(school_id,id),
 check(proposed_end>proposed_start), check(status<>'rejected' or (decision_reason is not null and length(trim(decision_reason))>0))
);
create unique index one_pending_correction on public.correction_requests(school_id,session_id) where status='pending';
create table public.session_exceptions (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, session_id uuid not null,
 flag text not null, resolved_at timestamptz, resolution_reason text, reviewer_id uuid references auth.users(id),
 foreign key(school_id,session_id) references public.teaching_sessions(school_id,id),
 check(resolved_at is null or (resolution_reason is not null and length(trim(resolution_reason))>0 and reviewer_id is not null))
);
create table public.session_reviews (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, session_id uuid not null,
 reviewed_version integer not null, reviewer_id uuid not null references auth.users(id), result text not null check(result in ('verified','rejected')), reason text,
 created_at timestamptz not null default now(), foreign key(school_id,session_id) references public.teaching_sessions(school_id,id)
);
create table public.payroll_runs (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id),
 starts_on date not null, ends_on date not null, revision integer not null default 1,
 status text not null default 'draft' check(status in ('draft','approved','void')), policy_version integer not null,
 total_mmk bigint, version integer not null default 1, approved_at timestamptz,
 unique(school_id,id), check(ends_on>=starts_on), check(total_mmk is null or total_mmk>=0)
);
create table public.payroll_lines (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, run_id uuid not null, teacher_id uuid not null, session_id uuid not null,
 minutes integer not null check(minutes>=0), hourly_mmk bigint not null check(hourly_mmk>0), amount_mmk bigint not null check(amount_mmk>=0),
 source_versions jsonb not null, unique(school_id,id), unique(run_id,session_id),
 foreign key(school_id,run_id) references public.payroll_runs(school_id,id),
 foreign key(school_id,teacher_id) references public.teachers(school_id,id), foreign key(school_id,session_id) references public.teaching_sessions(school_id,id)
);
create table public.payroll_adjustments (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, run_id uuid not null, teacher_id uuid not null,
 amount_mmk bigint not null, reason text not null check(length(trim(reason))>0), reference text,
 foreign key(school_id,run_id) references public.payroll_runs(school_id,id), foreign key(school_id,teacher_id) references public.teachers(school_id,id)
);
create table public.session_allocations (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, session_id uuid not null, run_id uuid not null, active boolean not null default true,
 foreign key(school_id,run_id) references public.payroll_runs(school_id,id), foreign key(school_id,session_id) references public.teaching_sessions(school_id,id)
);
create unique index one_active_allocation on public.session_allocations(school_id,session_id) where active;
create table public.payment_records (
 id uuid primary key default gen_random_uuid(), school_id uuid not null, run_id uuid not null, teacher_id uuid not null,
 amount_mmk bigint not null check(amount_mmk>=0), paid_on date not null, method text not null, reference text not null,
 actor_id uuid not null references auth.users(id), created_at timestamptz not null default now(),
 reversed_at timestamptz, reversed_by uuid references auth.users(id), reversal_reason text,
 foreign key(school_id,run_id) references public.payroll_runs(school_id,id), foreign key(school_id,teacher_id) references public.teachers(school_id,id),
 check((reversed_at is null and reversed_by is null and reversal_reason is null) or (reversed_at is not null and reversed_by is not null and reversal_reason is not null and length(trim(reversal_reason))>0))
);
create unique index one_active_payment on public.payment_records(school_id,run_id,teacher_id) where reversed_at is null;
create table public.audit_events (
 id uuid primary key default gen_random_uuid(), school_id uuid not null references public.schools(id), actor_id uuid not null references auth.users(id),
 action text not null, entity_id uuid not null, before_snapshot jsonb, after_snapshot jsonb, created_at timestamptz not null default now()
);
create table public.idempotency_records (
 school_id uuid not null references public.schools(id), actor_id uuid not null references auth.users(id), operation text not null,
 key uuid not null, fingerprint jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key(school_id,actor_id,operation,key)
);
-- Helpers read membership with owner privileges to avoid recursive membership RLS.
create function private.is_member(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where school_id=s and user_id=auth.uid() and active)
$$;
create function private.is_admin(s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.memberships where school_id=s and user_id=auth.uid() and active and role='admin')
$$;
create function private.owns_teacher(s uuid,t uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.teachers t1 join public.memberships m on m.id=t1.membership_id and m.school_id=t1.school_id where t1.school_id=s and t1.id=t and m.user_id=auth.uid() and m.active)
$$;
revoke all on all functions in schema private from public;
grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid),private.is_admin(uuid),private.owns_teacher(uuid,uuid) to authenticated;
-- Default deny all writes. RPCs added in later migrations are the only write API.
do $$ declare t text; begin
 foreach t in array array['schools','memberships','teachers','classes','teacher_assignments','teacher_rates','teaching_sessions','correction_requests','session_exceptions','session_reviews','payroll_runs','payroll_lines','payroll_adjustments','session_allocations','payment_records','audit_events','idempotency_records'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant select on public.%I to authenticated',t);
 if t<>'schools' then execute format('create policy admin_read on public.%I for select to authenticated using (private.is_admin(school_id))',t); end if;
 end loop; end $$;
create policy member_school on public.schools for select to authenticated using(private.is_member(id));
create policy own_membership on public.memberships for select to authenticated using(user_id=auth.uid() and active);
create policy own_teacher on public.teachers for select to authenticated using(private.owns_teacher(school_id,id));
create policy assigned_classes on public.classes for select to authenticated using(exists(select 1 from public.teacher_assignments a where a.school_id=classes.school_id and a.class_id=classes.id and private.owns_teacher(a.school_id,a.teacher_id)));
create policy own_assignments on public.teacher_assignments for select to authenticated using(private.owns_teacher(school_id,teacher_id));
create policy own_sessions on public.teaching_sessions for select to authenticated using(private.owns_teacher(school_id,teacher_id));
create policy own_corrections on public.correction_requests for select to authenticated using(exists(select 1 from public.teaching_sessions s where s.school_id=correction_requests.school_id and s.id=correction_requests.session_id and private.owns_teacher(s.school_id,s.teacher_id)));
create policy own_reviews on public.session_reviews for select to authenticated using(exists(select 1 from public.teaching_sessions s where s.school_id=session_reviews.school_id and s.id=session_reviews.session_id and private.owns_teacher(s.school_id,s.teacher_id)));
create policy own_approved_lines on public.payroll_lines for select to authenticated using(private.owns_teacher(school_id,teacher_id) and exists(select 1 from public.payroll_runs r where r.id=run_id and r.school_id=payroll_lines.school_id and r.status='approved'));
-- Teachers never receive entire run totals. A helper exposes only approval state.
create function private.is_approved(s uuid,r uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.payroll_runs where school_id=s and id=r and status='approved')
$$;
revoke all on function private.is_approved(uuid,uuid) from public;
grant execute on function private.is_approved(uuid,uuid) to authenticated;
drop policy own_approved_lines on public.payroll_lines;
create policy own_approved_lines on public.payroll_lines for select to authenticated using(private.owns_teacher(school_id,teacher_id) and private.is_approved(school_id,run_id));
create policy own_approved_adjustments on public.payroll_adjustments for select to authenticated using(private.owns_teacher(school_id,teacher_id) and private.is_approved(school_id,run_id));
create policy own_payments on public.payment_records for select to authenticated using(private.owns_teacher(school_id,teacher_id) and private.is_approved(school_id,run_id));
commit;
