alter table public.academy_class_sessions add column meeting_url text,
 add column meeting_backup_url text,
 add column summary text;
alter table public.academy_class_sessions add constraint class_meeting_urls check(
 (meeting_url is null or meeting_url ~* '^https://(teams[.](microsoft[.]com|live[.]com|cloud[.]microsoft)/|([a-z0-9-]+[.])*zoom[.]us/(j|my)/)[^[:space:]]+$') and
 (meeting_backup_url is null or (meeting_url is not null and meeting_backup_url<>meeting_url and meeting_backup_url ~* '^https://(teams[.](microsoft[.]com|live[.]com|cloud[.]microsoft)/|([a-z0-9-]+[.])*zoom[.]us/(j|my)/)[^[:space:]]+$')));
create table public.academy_session_requests(
 id uuid primary key default gen_random_uuid(),
 session_id uuid not null references public.academy_class_sessions(id),
 student_id uuid not null references auth.users(id),
 reason text not null check(length(reason) between 1 and 2000),
 status text not null default 'pending' check(status in ('pending','approved','rejected','withdrawn')),
 created_at timestamptz not null default now()
);
create unique index academy_one_pending_request on public.academy_session_requests(session_id,student_id) where status='pending';
alter table public.academy_session_requests enable row level security;
revoke all on public.academy_session_requests from anon,authenticated;
grant select on public.academy_session_requests to authenticated;
create policy "Participant cancellation requests" on public.academy_session_requests for select to authenticated using(student_id=auth.uid() or exists(select 1 from public.academy_class_sessions s where s.id=session_id and (public.is_admin() or public.academy_active_teacher(s.teacher_id))));
create function public.academy_session_action(p_session uuid,p_action text,p_data jsonb default '{}') returns void
language plpgsql security definer set search_path='' as $$
declare s public.academy_class_sessions; c public.academy_classes; manager boolean; recipient uuid; r public.academy_session_requests; message text;
begin
 select * into s from public.academy_class_sessions where id=p_session for update;
 select * into c from public.academy_classes where id=s.class_id;
 if auth.uid() is null or s.id is null or not academy_private.class_access(s.class_id) then raise exception 'Class access required' using errcode='42501'; end if;
 manager:=public.is_admin() or public.academy_active_teacher(s.teacher_id);
 if p_action='request_cancel' then
 if not exists(select 1 from public.academy_class_members where class_id=s.class_id and student_id=auth.uid() and status='active') or s.status<>'confirmed' or s.starts_at<=now() then raise exception 'Upcoming membership required'; end if;
 insert into public.academy_session_requests(session_id,student_id,reason) values(s.id,auth.uid(),trim(p_data->>'reason'));
 select user_id into recipient from public.academy_teachers where id=s.teacher_id;
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) values(recipient,auth.uid(),'cancellation_requested',s.class_id,c.title||' · '||s.starts_at::text);
 return;
 end if;
 if not manager then raise exception 'Teacher permission required' using errcode='42501'; end if;
 if p_action='cancel' then
 if s.status='cancelled' then return; end if;
 if s.status<>'confirmed' or s.starts_at<=now() or coalesce(length(trim(p_data->>'reason')),0)=0 then raise exception 'Upcoming session and reason required'; end if;
 update public.academy_class_sessions set status='cancelled',reason=trim(p_data->>'reason') where id=s.id;
 message:='session_cancelled';
 elsif p_action='meeting' then
 if s.status<>'confirmed' then raise exception 'Session is not confirmed'; end if;
 update public.academy_class_sessions set meeting_url=nullif(trim(p_data->>'url'),''),meeting_backup_url=nullif(trim(p_data->>'backup'),'') where id=s.id;
 message:='meeting_updated';
 elsif p_action='attendance' then
 if s.status='cancelled' or s.starts_at>now() then raise exception 'Session has not taken place'; end if;
 if not exists(select 1 from public.academy_class_members where class_id=s.class_id and student_id=(p_data->>'student_id')::uuid and status='active') then raise exception 'Student is not a class member'; end if;
 insert into public.academy_class_attendance(session_id,student_id,status) values(s.id,(p_data->>'student_id')::uuid,p_data->>'status') on conflict(session_id,student_id) do update set status=excluded.status;
 return;
 elsif p_action='complete' then
 if s.status='cancelled' or s.ends_at>now() then raise exception 'Session has not ended'; end if;
 update public.academy_class_sessions set status='completed',summary=left(p_data->>'summary',20000) where id=s.id;
 message:='session_completed';
 elsif p_action in ('approve_cancel','reject_cancel') then
 select * into r from public.academy_session_requests where id=(p_data->>'request_id')::uuid and session_id=s.id for update;
 if r.id is null or r.status<>'pending' then raise exception 'Pending request required'; end if;
 update public.academy_session_requests set status=case p_action when 'approve_cancel' then 'approved' else 'rejected' end where id=r.id;
 if p_action='approve_cancel' then
 insert into public.academy_class_attendance(session_id,student_id,status) values(s.id,r.student_id,'excused') on conflict(session_id,student_id) do update set status='excused';
 end if;
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) values(r.student_id,auth.uid(),p_action,s.class_id,c.title||' · '||s.starts_at::text);
 return;
 else raise exception 'Unknown action';
 end if;
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) select student_id,auth.uid(),message,c.id,c.title||' · '||s.starts_at::text from public.academy_class_members where class_id=c.id and status='active';
end;$$;
revoke all on function public.academy_session_action(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.academy_session_action(uuid,text,jsonb) to authenticated;
