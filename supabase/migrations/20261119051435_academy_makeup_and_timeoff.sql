create table public.academy_makeup_proposals(
 id uuid primary key default gen_random_uuid(),session_id uuid not null references public.academy_class_sessions(id),class_id uuid not null references public.academy_classes(id),teacher_id uuid not null references public.academy_teachers(id),
 starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),timezone text not null,reason text not null check(length(reason) between 1 and 2000),
 expires_at timestamptz not null,status text not null default 'pending' check(status in('pending','accepted','rejected','expired','superseded')),created_at timestamptz not null default now()
);
create table public.academy_makeup_votes(
 proposal_id uuid not null references public.academy_makeup_proposals(id),student_id uuid not null references auth.users(id),response text not null default 'pending' check(response in('pending','accepted','rejected')),responded_at timestamptz,primary key(proposal_id,student_id)
);
alter table public.academy_makeup_proposals enable row level security;alter table public.academy_makeup_votes enable row level security;
revoke all on public.academy_makeup_proposals,public.academy_makeup_votes from public,anon,authenticated;
grant select on public.academy_makeup_proposals,public.academy_makeup_votes to authenticated;
create policy "Makeup participants" on public.academy_makeup_proposals for select to authenticated using(academy_private.class_access(class_id));
create policy "Own vote or teacher" on public.academy_makeup_votes for select to authenticated using(student_id=auth.uid() or exists(select 1 from public.academy_makeup_proposals p where p.id=proposal_id and (public.is_admin() or public.academy_active_teacher(p.teacher_id))));
create function public.academy_propose_makeup(p_session uuid,p_start timestamp,p_timezone text,p_reason text) returns uuid language plpgsql security definer set search_path='' as $$
declare s public.academy_class_sessions; pid uuid; proposed timestamptz;
begin
 select * into s from public.academy_class_sessions where id=p_session for update;
 if auth.uid() is null or s.id is null or not(public.is_admin() or public.academy_active_teacher(s.teacher_id)) then raise exception 'Teacher required' using errcode='42501';end if;
 if s.status='completed' or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid makeup session';end if;
 proposed:=p_start at time zone p_timezone;
 if proposed<=now()+interval '1 hour' or proposed at time zone p_timezone<>p_start then raise exception 'Invalid proposed time';end if;
 if not exists(select 1 from public.academy_class_members where class_id=s.class_id and status='active') then raise exception 'No active students';end if;
 update public.academy_makeup_proposals set status='superseded' where session_id=s.id and status='pending';
 insert into public.academy_makeup_proposals(session_id,class_id,teacher_id,starts_at,ends_at,timezone,reason,expires_at) values(s.id,s.class_id,s.teacher_id,proposed,proposed+(s.ends_at-s.starts_at),p_timezone,trim(p_reason),least(proposed-interval '1 hour',now()+interval '7 days')) returning id into pid;
 insert into public.academy_makeup_votes(proposal_id,student_id) select pid,student_id from public.academy_class_members where class_id=s.class_id and status='active';
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) select student_id,auth.uid(),'makeup_proposed',s.class_id,proposed::text from public.academy_class_members where class_id=s.class_id and status='active';
 return pid;
end;$$;
create function public.academy_answer_makeup(p_proposal uuid,p_accept boolean) returns text language plpgsql security definer set search_path='' as $$
declare p public.academy_makeup_proposals; s public.academy_class_sessions; member uuid; serial uuid;
begin
 select * into p from public.academy_makeup_proposals where id=p_proposal for update;
 if auth.uid() is null or not exists(select 1 from public.academy_makeup_votes where proposal_id=p.id and student_id=auth.uid()) then raise exception 'Invited student required' using errcode='42501';end if;
 if p.status<>'pending' then raise exception 'Proposal closed';end if;
 if p.expires_at<=now() then update public.academy_makeup_proposals set status='expired' where id=p.id;return 'expired';end if;
 -- Membership changes invalidate the invitation instead of silently omitting students.
 if exists((select student_id from public.academy_class_members where class_id=p.class_id and status='active') except (select student_id from public.academy_makeup_votes where proposal_id=p.id)) or exists((select student_id from public.academy_makeup_votes where proposal_id=p.id) except (select student_id from public.academy_class_members where class_id=p.class_id and status='active')) then update public.academy_makeup_proposals set status='superseded' where id=p.id;return 'superseded';end if;
 update public.academy_makeup_votes set response=case when p_accept then 'accepted' else 'rejected' end,responded_at=now() where proposal_id=p.id and student_id=auth.uid();
 if not p_accept then update public.academy_makeup_proposals set status='rejected' where id=p.id;return 'rejected';end if;
 if exists(select 1 from public.academy_makeup_votes where proposal_id=p.id and response<>'accepted') then return 'pending';end if;
 perform pg_advisory_xact_lock(hashtextextended(p.teacher_id::text,1));
 perform 1 from public.academy_classes where id=p.class_id and status='active' for update;
 if not found then raise exception 'Class is not active';end if;
 select * into s from public.academy_class_sessions where id=p.session_id for update;
 if s.status='completed' then raise exception 'Lesson already completed';end if;
 for member in select student_id from public.academy_makeup_votes where proposal_id=p.id order by student_id loop perform pg_advisory_xact_lock(hashtextextended(member::text,611));end loop;
 if exists(select 1 from public.academy_class_sessions x where x.id<>s.id and x.status='confirmed' and x.starts_at<p.ends_at and x.ends_at>p.starts_at and not exists(select 1 from public.academy_demo_accounts d where d.class_id=x.class_id) and (x.teacher_id=p.teacher_id or exists(select 1 from public.academy_class_members m join public.academy_makeup_votes v on v.student_id=m.student_id where m.class_id=x.class_id and m.status='active' and v.proposal_id=p.id))) or exists(select 1 from public.academy_bookings b where b.status in ('confirmed','in_progress') and b.confirmed_start<p.ends_at and b.confirmed_start+make_interval(mins=>coalesce(b.duration_minutes,60))>p.starts_at and (b.teacher_id=p.teacher_id or exists(select 1 from public.academy_makeup_votes v where v.proposal_id=p.id and v.student_id=b.student_id))) then raise exception 'Proposed time is no longer available';end if;
 update public.academy_class_sessions set status='cancelled',reason=p.reason where id=s.id;
 insert into public.academy_class_sessions(class_id,teacher_id,series_id,starts_at,ends_at,timezone,meeting_url,meeting_backup_url) values(p.class_id,p.teacher_id,gen_random_uuid(),p.starts_at,p.ends_at,p.timezone,s.meeting_url,s.meeting_backup_url);
 update public.academy_makeup_proposals set status='accepted' where id=p.id;
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) select student_id,auth.uid(),'makeup_confirmed',p.class_id,p.starts_at::text from public.academy_makeup_votes where proposal_id=p.id;
 return 'accepted';
end;$$;
revoke all on function public.academy_propose_makeup(uuid,timestamp,text,text),public.academy_answer_makeup(uuid,boolean) from public,anon;
grant execute on function public.academy_propose_makeup(uuid,timestamp,text,text),public.academy_answer_makeup(uuid,boolean) to authenticated;

create table public.academy_time_off(id uuid primary key default gen_random_uuid(),teacher_id uuid not null references public.academy_teachers(id),starts_at timestamptz not null,ends_at timestamptz not null check(ends_at>starts_at),reason text not null,created_at timestamptz not null default now());
alter table public.academy_time_off enable row level security;revoke all on public.academy_time_off from public,anon,authenticated;grant select on public.academy_time_off to authenticated;
create policy "Own time off" on public.academy_time_off for select to authenticated using(public.is_admin() or public.academy_active_teacher(teacher_id));
create function public.academy_cancel_range(p_teacher uuid,p_from timestamptz,p_to timestamptz,p_reason text,p_expected jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare impact jsonb; item record;
begin
 if auth.uid() is null or not(public.is_admin() or public.academy_active_teacher(p_teacher)) then raise exception 'Teacher required' using errcode='42501';end if;
 if p_from<now()-interval '1 minute' or p_to<=p_from or p_to>p_from+interval '366 days' or length(trim(p_reason)) not between 1 and 2000 then raise exception 'Invalid cancellation range';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_teacher::text,1));
 select coalesce(jsonb_agg(to_jsonb(q) order by kind,id),'[]') into impact from (
 select 'class' as kind,s.id,s.starts_at from public.academy_class_sessions s where s.teacher_id=p_teacher and s.status='confirmed' and s.starts_at<p_to and s.ends_at>p_from and s.starts_at>now() and not exists(select 1 from public.academy_demo_accounts d where d.class_id=s.class_id)
 union all select 'booking',b.id,coalesce(b.confirmed_start,b.preferred_start) from public.academy_bookings b where b.teacher_id=p_teacher and b.status in('requested','confirmed') and coalesce(b.confirmed_start,b.preferred_start)<p_to and coalesce(b.confirmed_start,b.preferred_start)+make_interval(mins=>coalesce(b.duration_minutes,60))>p_from and coalesce(b.confirmed_start,b.preferred_start)>now() and not exists(select 1 from public.academy_demo_accounts d where d.student_id=b.student_id)
 )q;
 if p_expected is null then return impact;end if;
 if p_expected<>impact then raise exception 'Schedule changed. Refresh the impact preview.';end if;
 for item in select * from jsonb_to_recordset(impact) as x(kind text,id uuid,starts_at timestamptz) loop
 if item.kind='class' then perform public.academy_session_action(item.id,'cancel',jsonb_build_object('reason',p_reason));
 else update public.academy_bookings set status='cancelled_teacher',teacher_note=p_reason where id=item.id;end if;
 end loop;
 insert into public.academy_time_off(teacher_id,starts_at,ends_at,reason) values(p_teacher,p_from,p_to,p_reason);
 update public.academy_availability set status='blocked' where teacher_id=p_teacher and status='available' and starts_at<p_to and ends_at>p_from;
 return impact;
end;$$;
revoke all on function public.academy_cancel_range(uuid,timestamptz,timestamptz,text,jsonb) from public,anon;
grant execute on function public.academy_cancel_range(uuid,timestamptz,timestamptz,text,jsonb) to authenticated;
create function academy_private.guard_time_off() returns trigger language plpgsql security definer set search_path='' as $$
declare start_time timestamptz;end_time timestamptz;
begin
 if tg_table_name='academy_class_sessions' then
 if new.status<>'confirmed' or exists(select 1 from public.academy_demo_accounts where class_id=new.class_id) then return new;end if;
 start_time:=new.starts_at;end_time:=new.ends_at;
 elsif tg_table_name='academy_bookings' then
 if new.status not in('confirmed','requested','in_progress') or exists(select 1 from public.academy_demo_accounts where student_id=new.student_id) then return new;end if;
 start_time:=coalesce(new.confirmed_start,new.preferred_start);end_time:=start_time+make_interval(mins=>coalesce(new.duration_minutes,60));
 else
 if new.status<>'available' then return new;end if;start_time:=new.starts_at;end_time:=new.ends_at;
 end if;
 perform pg_advisory_xact_lock(hashtextextended(new.teacher_id::text,1));
 if exists(select 1 from public.academy_time_off o where o.teacher_id=new.teacher_id and o.starts_at<end_time and o.ends_at>start_time) then raise exception 'Teacher has scheduled time off';end if;return new;
end;$$;
revoke all on function academy_private.guard_time_off() from public,anon,authenticated;
create trigger academy_time_off before insert or update on public.academy_class_sessions for each row execute function academy_private.guard_time_off();
create trigger academy_time_off before insert or update on public.academy_bookings for each row execute function academy_private.guard_time_off();
create trigger academy_time_off before insert or update on public.academy_availability for each row execute function academy_private.guard_time_off();

create or replace function public.academy_session_action(p_session uuid,p_action text,p_data jsonb default '{}') returns void
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
 update public.academy_session_requests set status='withdrawn' where session_id=s.id and status='pending';
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
 if s.status<>'confirmed' or s.starts_at<=now() then raise exception 'Upcoming confirmed session required';end if;
 if r.id is null or r.status<>'pending' then raise exception 'Pending request required'; end if;
 update public.academy_session_requests set status=case p_action when 'approve_cancel' then 'approved' else 'rejected' end where id=r.id;
 if p_action='approve_cancel' then
 insert into public.academy_class_attendance(session_id,student_id,status) values(s.id,r.student_id,'excused') on conflict(session_id,student_id) do update set status='excused';
 if c.capacity=1 then update public.academy_class_sessions set status='cancelled',reason=r.reason where id=s.id;end if;
 end if;
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) values(r.student_id,auth.uid(),p_action,s.class_id,c.title||' · '||s.starts_at::text);
 return;
 else raise exception 'Unknown action';
 end if;
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) select student_id,auth.uid(),message,c.id,c.title||' · '||s.starts_at::text from public.academy_class_members where class_id=c.id and status='active';
end;$$;

create or replace function public.academy_prepare_demo(p_reset boolean default false) returns uuid
language plpgsql security definer set search_path='' as $$
declare tid uuid; uid uuid; cid uuid; eid uuid; sid uuid; classid uuid; pastid uuid; futureid uuid; d public.academy_demo_accounts;
begin
 select id into tid from public.academy_teachers where user_id=auth.uid() and status='active';
 if tid is null then raise exception 'Linked teacher required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(tid::text,19611));
 select * into d from public.academy_demo_accounts where teacher_id=tid;
 if d.teacher_id is not null and not p_reset then return d.space_id;end if;
 if d.teacher_id is null then
 uid:=gen_random_uuid();cid:=gen_random_uuid();eid:=gen_random_uuid();sid:=gen_random_uuid();classid:=gen_random_uuid();
 insert into auth.users(id,banned_until,raw_app_meta_data,raw_user_meta_data) values(uid,'infinity','{"academy_demo":true}','{"full_name":"Demo student · آزمایشی"}');
 insert into public.user_settings(user_id,display_name) values(uid,'Demo student · آزمایشی') on conflict(user_id) do update set display_name=excluded.display_name;
 insert into public.academy_courses(id,subject_code,level_code,title_i18n,description_i18n,status) values(cid,'sv','A1','{"en":"Demo Swedish · Test only","fa":"سوئدی آزمایشی","sv":"Svenska · Testkurs","de":"Schwedisch · Testkurs"}','{"en":"Isolated teacher/student practice"}','draft');
 insert into public.academy_teacher_courses(teacher_id,course_id) values(tid,cid);
 insert into public.academy_enrollments(id,student_id,teacher_id,course_id,status) values(eid,uid,tid,cid,'active');
 insert into public.academy_learning_spaces(id,enrollment_id,student_id,teacher_id,course_id,student_display_name,progress,goal,next_session_topics) values(sid,eid,uid,tid,cid,'Demo student · آزمایشی',25,'Practice everyday Swedish',array['Word order','Daily conversation']);
 insert into public.academy_classes(id,teacher_id,course_id,title,capacity) values(classid,tid,cid,'Demo class · آزمایشی',1);
 insert into public.academy_class_members(class_id,student_id) values(classid,uid);
 insert into public.academy_demo_accounts values(tid,uid,cid,classid,sid);
 else
 uid:=d.student_id;cid:=d.course_id;classid:=d.class_id;sid:=d.space_id;
 -- Never touch a real member or content outside this exact demo mapping.
 if exists(select 1 from public.academy_class_members where class_id=classid and student_id<>uid) then raise exception 'Demo has non-demo members; reset refused';end if;
 delete from public.academy_makeup_votes where proposal_id in(select id from public.academy_makeup_proposals where class_id=classid);
 delete from public.academy_makeup_proposals where class_id=classid;
 delete from public.academy_class_attendance where session_id in(select id from public.academy_class_sessions where class_id=classid);
 delete from public.academy_session_requests where session_id in(select id from public.academy_class_sessions where class_id=classid);
 delete from public.academy_class_posts where class_id=classid;
 delete from public.academy_notifications where class_id=classid;
 delete from public.academy_class_sessions where class_id=classid;
 delete from public.academy_session_summaries where learning_space_id=sid;
 delete from public.academy_test_results where learning_space_id=sid;
 delete from public.academy_resources where learning_space_id=sid;
 delete from public.academy_notes where learning_space_id=sid;
 delete from public.academy_messages where learning_space_id=sid;
 delete from public.academy_bookings where student_id=uid and teacher_id=tid and course_id=cid;
 end if;
 insert into public.academy_resources(learning_space_id,teacher_id,kind,title,description,student_status,student_response,due_at) values
 (sid,tid,'homework','Demo: submitted writing','Write three sentences','submitted','Jag bor i Sverige.',now()-interval '1 day'),
 (sid,tid,'homework','Demo: next homework','Describe your day','assigned',null,now()+interval '5 days');
 insert into public.academy_notes(learning_space_id,author_id,body,visibility) values(sid,auth.uid(),'Demo shared lesson note','shared'),(sid,auth.uid(),'DEMO_TEACHER_PRIVATE: hidden from student','private');
 insert into public.academy_messages(learning_space_id,sender_id,recipient_id,body) values(sid,auth.uid(),uid,'Welcome to the demo classroom');
 insert into public.academy_test_results(learning_space_id,teacher_id,student_id,title,score,max_score,teacher_summary) values(sid,tid,uid,'Demo vocabulary',8,10,'Good start');
 insert into public.academy_class_sessions(class_id,teacher_id,series_id,starts_at,ends_at,timezone,status,summary) values(classid,tid,gen_random_uuid(),now()-interval '3 days',now()-interval '3 days'+interval '1 hour','Europe/Stockholm','completed','Demo past lesson') returning id into pastid;
 insert into public.academy_class_attendance values(pastid,uid,'present');
 insert into public.academy_class_sessions(class_id,teacher_id,series_id,starts_at,ends_at,timezone,status) values(classid,tid,gen_random_uuid(),now()+interval '3 days',now()+interval '3 days 1 hour','Europe/Stockholm','confirmed') returning id into futureid;
 insert into public.academy_session_requests(session_id,student_id,reason) values(futureid,uid,'Demo cancellation request');
 insert into public.academy_bookings(student_id,teacher_id,course_id,session_type,preferred_start,status,student_message) values(uid,tid,cid,'trial',now()+interval '5 days','requested','Demo booking request');
 return sid;
end;$$;
