begin;
alter table public.teaching_sessions add column entry_reason text;
-- Re-evaluate flags whenever payable times/capture change. Keep old resolutions as history.
create function private.flag_session_exceptions() returns trigger language plpgsql security definer set search_path='' as $$
declare other public.teaching_sessions;
begin
 if new.capture_status='cancelled' then return new; end if;
 if not exists(select 1 from public.teacher_assignments a where a.school_id=new.school_id and a.teacher_id=new.teacher_id and a.class_id=new.class_id and a.starts_at<=new.effective_start and (a.ends_at is null or a.ends_at>new.effective_start)) then
  if not exists(select 1 from public.session_exceptions where session_id=new.id and flag='assignment_mismatch' and resolved_at is null) then
   insert into public.session_exceptions(school_id,session_id,flag) values(new.school_id,new.id,'assignment_mismatch');
  end if;
 end if;
 for other in select * from public.teaching_sessions s where s.school_id=new.school_id and s.teacher_id=new.teacher_id and s.id<>new.id and s.capture_status<>'cancelled' and tstzrange(s.effective_start,s.effective_end,'[)') && tstzrange(new.effective_start,new.effective_end,'[)') order by s.id for update loop
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
revoke all on function private.flag_session_exceptions() from public,anon,authenticated;
create trigger refresh_session_exceptions after insert or update of effective_start,effective_end,capture_status on public.teaching_sessions for each row execute function private.flag_session_exceptions();
-- Protect approved source records even if future RPCs accidentally omit a guard.
create function private.protect_allocated_session() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from public.session_allocations where school_id=old.school_id and session_id=old.id and active) then raise exception 'PAYROLL_LOCKED'; end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end $$;
revoke all on function private.protect_allocated_session() from public,anon,authenticated;
create trigger allocated_session_lock before update or delete on public.teaching_sessions for each row execute function private.protect_allocated_session();
create function public.create_admin_session(p_teacher_id uuid,p_class_id uuid,p_start timestamptz,p_end timestamptz,p_reason text,p_idempotency_key uuid) returns jsonb
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
 insert into public.teaching_sessions(school_id,teacher_id,class_id,original_start,original_end,effective_start,effective_end,capture_status,verification,source,actor_id,entry_reason)
  values(t.school_id,t.id,p_class_id,p_start,p_end,p_start,p_end,'completed','pending','admin',auth.uid(),trim(p_reason)) returning * into s;
 insert into public.audit_events(school_id,actor_id,action,entity_id,after_snapshot) values(t.school_id,auth.uid(),'create_admin_session',s.id,to_jsonb(s));
 insert into public.idempotency_records(school_id,actor_id,operation,key,fingerprint,result) values(t.school_id,auth.uid(),'create_admin_session',p_idempotency_key,fingerprint,to_jsonb(s));
 return to_jsonb(s);
end $$;
revoke all on function public.create_admin_session(uuid,uuid,timestamptz,timestamptz,text,uuid) from public,anon;
grant execute on function public.create_admin_session(uuid,uuid,timestamptz,timestamptz,text,uuid) to authenticated;
commit;
