begin;
create function public.check_in(p_assignment_id uuid,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare a public.teacher_assignments; t public.teachers; s public.teaching_sessions; prior public.idempotency_records; stamp timestamptz; fingerprint jsonb;
begin
 if auth.uid() is null or p_idempotency_key is null then raise exception 'ACCESS_DENIED'; end if;
 select * into a from public.teacher_assignments where id=p_assignment_id;
 if not found or not private.owns_teacher(a.school_id,a.teacher_id) then raise exception 'ACCESS_DENIED'; end if;
 -- Shared parent locking protocol for all future session/rate/approval writers.
 select * into t from public.teachers where id=a.teacher_id and school_id=a.school_id for update;
 if not private.owns_teacher(a.school_id,a.teacher_id) then raise exception 'ACCESS_DENIED'; end if;
 fingerprint:=jsonb_build_object('assignment_id',p_assignment_id);
 select * into prior from public.idempotency_records where school_id=a.school_id and actor_id=auth.uid() and operation='check_in' and key=p_idempotency_key;
 if found then
  if prior.fingerprint<>fingerprint then raise exception 'VERSION_CONFLICT'; end if;
  return prior.result;
 end if;
 stamp:=clock_timestamp();
 if not t.active or a.starts_at>stamp or (a.ends_at is not null and a.ends_at<=stamp) or not exists(select 1 from public.classes where id=a.class_id and school_id=a.school_id and active) then raise exception 'ACCESS_DENIED'; end if;
 if exists(select 1 from public.teaching_sessions where school_id=a.school_id and teacher_id=a.teacher_id and capture_status='in_progress') then raise exception 'OPEN_SESSION_EXISTS'; end if;
 insert into public.teaching_sessions(school_id,teacher_id,class_id,original_start,effective_start,source,actor_id)
 values(a.school_id,a.teacher_id,a.class_id,stamp,stamp,'teacher',auth.uid()) returning * into s;
 insert into public.audit_events(school_id,actor_id,action,entity_id,after_snapshot) values(s.school_id,auth.uid(),'check_in',s.id,to_jsonb(s));
 insert into public.idempotency_records(school_id,actor_id,operation,key,fingerprint,result) values(a.school_id,auth.uid(),'check_in',p_idempotency_key,fingerprint,to_jsonb(s));
 return to_jsonb(s);
end $$;
create function public.check_out(p_session_id uuid,p_expected_version integer,p_idempotency_key uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare s public.teaching_sessions; old_snapshot jsonb; prior public.idempotency_records; fingerprint jsonb; stamp timestamptz;
begin
 if auth.uid() is null or p_idempotency_key is null or p_expected_version is null then raise exception 'ACCESS_DENIED'; end if;
 select * into s from public.teaching_sessions where id=p_session_id;
 if not found or not private.owns_teacher(s.school_id,s.teacher_id) then raise exception 'ACCESS_DENIED'; end if;
 perform 1 from public.teachers where id=s.teacher_id and school_id=s.school_id for update;
 if not private.owns_teacher(s.school_id,s.teacher_id) then raise exception 'ACCESS_DENIED'; end if;
 select * into s from public.teaching_sessions where id=p_session_id for update;
 fingerprint:=jsonb_build_object('session_id',p_session_id,'expected_version',p_expected_version);
 select * into prior from public.idempotency_records where school_id=s.school_id and actor_id=auth.uid() and operation='check_out' and key=p_idempotency_key;
 if found then
  if prior.fingerprint<>fingerprint then raise exception 'VERSION_CONFLICT'; end if;
  return prior.result;
 end if;
 if s.version<>p_expected_version then raise exception 'VERSION_CONFLICT'; end if;
 if s.capture_status<>'in_progress' then raise exception 'VERSION_CONFLICT'; end if;
 old_snapshot:=to_jsonb(s); stamp:=clock_timestamp();
 update public.teaching_sessions set original_end=stamp,effective_end=stamp,capture_status='completed',verification='pending',version=version+1 where id=s.id returning * into s;
 insert into public.audit_events(school_id,actor_id,action,entity_id,before_snapshot,after_snapshot) values(s.school_id,auth.uid(),'check_out',s.id,old_snapshot,to_jsonb(s));
 insert into public.idempotency_records(school_id,actor_id,operation,key,fingerprint,result) values(s.school_id,auth.uid(),'check_out',p_idempotency_key,fingerprint,to_jsonb(s));
 return to_jsonb(s);
end $$;
revoke all on function public.check_in(uuid,uuid),public.check_out(uuid,integer,uuid) from public, anon;
grant execute on function public.check_in(uuid,uuid),public.check_out(uuid,integer,uuid) to authenticated;
commit;
