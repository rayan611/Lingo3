-- Demo identity is non-login, owns no real email and is bound to one real teacher.
create table public.academy_demo_accounts(
 teacher_id uuid primary key references public.academy_teachers(id),student_id uuid unique not null references auth.users(id),
 course_id uuid unique not null references public.academy_courses(id),class_id uuid unique not null references public.academy_classes(id),space_id uuid unique not null references public.academy_learning_spaces(id)
);
alter table public.academy_demo_accounts enable row level security;
revoke all on public.academy_demo_accounts from public,anon,authenticated;
grant select on public.academy_demo_accounts to authenticated;
create policy "Own demo mapping" on public.academy_demo_accounts for select to authenticated using(public.academy_active_teacher(teacher_id));
create function public.academy_prepare_demo(p_reset boolean default false) returns uuid
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
revoke all on function public.academy_prepare_demo(boolean) from public,anon;
grant execute on function public.academy_prepare_demo(boolean) to authenticated;

-- This endpoint never returns teacher-private notes, arbitrary user records,
-- admin settings or teacher write operations, even when its caller is an admin.
create function public.academy_demo_student(p_action text default 'read',p_id uuid default null,p_body text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare d public.academy_demo_accounts; teacher_user uuid;
begin
 select a.* into d from public.academy_demo_accounts a join public.academy_teachers t on t.id=a.teacher_id where t.user_id=auth.uid() and t.status='active' for update of a;
 if d.teacher_id is null then raise exception 'Own demo required' using errcode='42501';end if;
 select user_id into teacher_user from public.academy_teachers where id=d.teacher_id;
 if p_action='submit' then
 if length(trim(p_body)) not between 1 and 20000 then raise exception 'Response required';end if;
 update public.academy_resources set student_response=p_body,student_status='submitted',updated_at=now() where id=p_id and learning_space_id=d.space_id and kind='homework' and student_status<>'completed';
 if not found then raise exception 'Demo assignment not accessible' using errcode='42501';end if;
 elsif p_action='message' then insert into public.academy_messages(learning_space_id,sender_id,recipient_id,body) values(d.space_id,d.student_id,teacher_user,p_body);
 elsif p_action='note' then insert into public.academy_notes(learning_space_id,author_id,body,visibility) values(d.space_id,d.student_id,p_body,'private');
 elsif p_action='cancel' then
 if not exists(select 1 from public.academy_class_sessions where id=p_id and class_id=d.class_id and status='confirmed' and starts_at>now()) then raise exception 'Demo upcoming session required' using errcode='42501';end if;
 insert into public.academy_session_requests(session_id,student_id,reason) values(p_id,d.student_id,p_body);
 elsif p_action<>'read' then raise exception 'Student action not permitted' using errcode='42501';end if;
 return jsonb_build_object('space',(select to_jsonb(s) from public.academy_learning_spaces s where id=d.space_id),
 'resources',coalesce((select jsonb_agg(to_jsonb(r)) from public.academy_resources r where learning_space_id=d.space_id),'[]'),
 'notes',coalesce((select jsonb_agg(to_jsonb(n)) from public.academy_notes n where learning_space_id=d.space_id and (visibility='shared' or author_id=d.student_id)),'[]'),
 'messages',coalesce((select jsonb_agg(to_jsonb(m) order by created_at) from public.academy_messages m where learning_space_id=d.space_id and d.student_id in(sender_id,recipient_id)),'[]'),
 'tests',coalesce((select jsonb_agg(to_jsonb(t)) from public.academy_test_results t where learning_space_id=d.space_id),'[]'),
 'sessions',coalesce((select jsonb_agg(to_jsonb(s) order by starts_at) from public.academy_class_sessions s where class_id=d.class_id),'[]'),
 'attendance',coalesce((select jsonb_agg(to_jsonb(a)) from public.academy_class_attendance a where student_id=d.student_id),'[]'));
end;$$;
revoke all on function public.academy_demo_student(text,uuid,text) from public,anon;
grant execute on function public.academy_demo_student(text,uuid,text) to authenticated;

-- Public calendar deliberately projects only anonymous free/busy times.
create or replace function public.academy_teacher_calendar(p_teacher_id uuid,p_from timestamptz default now(),p_to timestamptz default now()+interval '60 days')
returns table(id uuid,teacher_id uuid,starts_at timestamptz,ends_at timestamptz,delivery_mode text,status text)
language sql stable security definer set search_path='' as $$
 with occupied as (
 select s.id,s.teacher_id,s.starts_at,s.ends_at,'online'::text as mode from public.academy_class_sessions s where s.teacher_id=p_teacher_id and s.status='confirmed' and not exists(select 1 from public.academy_demo_accounts d where d.class_id=s.class_id)
 union all
 select b.id,b.teacher_id,b.confirmed_start,b.confirmed_start+make_interval(mins=>b.duration_minutes),'online'::text from public.academy_bookings b where b.teacher_id=p_teacher_id and b.status in ('confirmed','in_progress') and not exists(select 1 from public.academy_demo_accounts d where d.student_id=b.student_id)
 ), calendar as (
 select a.id,a.teacher_id,a.starts_at,a.ends_at,a.delivery_mode,
 case when a.status='available' and not exists(select 1 from occupied o where o.starts_at<a.ends_at and o.ends_at>a.starts_at) then 'free' else 'busy' end::text as status
 from public.academy_availability a where a.teacher_id=p_teacher_id and a.status<>'cancelled'
 union all
 select o.id,o.teacher_id,o.starts_at,o.ends_at,o.mode,'busy'::text from occupied o
 where not exists(select 1 from public.academy_availability a where a.teacher_id=o.teacher_id and a.status<>'cancelled' and a.starts_at=o.starts_at and a.ends_at=o.ends_at)
 ) select c.* from calendar c where
 exists(select 1 from public.academy_teachers t where t.id=p_teacher_id and t.status='active')
 and c.ends_at>=greatest(coalesce(p_from,now()),now())
 and c.starts_at<=least(coalesce(p_to,now()+interval '60 days'),now()+interval '120 days')
 order by c.starts_at limit 500
$$;
revoke all on function public.academy_teacher_calendar(uuid,timestamptz,timestamptz) from public;
grant execute on function public.academy_teacher_calendar(uuid,timestamptz,timestamptz) to anon,authenticated;

create or replace function public.academy_schedule_class(p_class uuid,p_start timestamp,p_timezone text,p_minutes integer,p_repeat text,p_count integer) returns integer
language plpgsql security definer set search_path='' as $$
declare c public.academy_classes; start_time timestamptz; finish_time timestamptz; series uuid:=gen_random_uuid(); day_step integer; member_id uuid;
begin
 select * into c from public.academy_classes where id=p_class for update;
 if auth.uid() is null or c.id is null or not (public.is_admin() or public.academy_active_teacher(c.teacher_id)) then raise exception 'Teacher permission required' using errcode='42501'; end if;
 if p_start is null or p_timezone is null or p_minutes is null or p_repeat is null or p_count is null or c.status<>'active' or p_count not between 1 and 100 or p_minutes not between 15 and 240 or p_repeat not in ('once','daily','weekly') or (p_repeat='once' and p_count<>1) or not exists(select 1 from pg_timezone_names where name=p_timezone) then raise exception 'Invalid schedule'; end if;
 perform pg_advisory_xact_lock(hashtextextended(c.teacher_id::text,1));
 for member_id in select student_id from public.academy_class_members where class_id=p_class and status='active' order by student_id loop
 perform pg_advisory_xact_lock(hashtextextended(member_id::text,611));
 end loop;
 day_step:=case p_repeat when 'daily' then 1 when 'weekly' then 7 else 0 end;
 for occurrence in 0..p_count-1 loop
 start_time:=(p_start+make_interval(days=>day_step*occurrence)) at time zone p_timezone;
 finish_time:=start_time+make_interval(mins=>p_minutes);
 if start_time<=now() then raise exception 'Sessions must be in the future'; end if;
 if (start_time at time zone p_timezone)<>p_start+make_interval(days=>day_step*occurrence) then raise exception 'Time does not exist because of daylight saving'; end if;
 if exists(select 1 from public.academy_class_sessions s where s.status='confirmed' and not exists(select 1 from public.academy_demo_accounts d where d.class_id=s.class_id) and s.starts_at<finish_time and s.ends_at>start_time and
 (s.teacher_id=c.teacher_id or exists(select 1 from public.academy_class_members own_m join public.academy_class_members other_m on other_m.student_id=own_m.student_id where own_m.class_id=p_class and other_m.class_id=s.class_id and own_m.status='active' and other_m.status='active')))
 or exists(select 1 from public.academy_bookings b where b.status in ('confirmed','in_progress') and b.confirmed_start<finish_time and b.confirmed_start+make_interval(mins=>coalesce(b.duration_minutes,60))>start_time and (b.teacher_id=c.teacher_id or exists(select 1 from public.academy_class_members m where m.class_id=p_class and m.student_id=b.student_id and m.status='active')))
 then raise exception 'Schedule conflict at %',start_time; end if;
 insert into public.academy_class_sessions(class_id,teacher_id,series_id,starts_at,ends_at,timezone) values(p_class,c.teacher_id,series,start_time,finish_time,p_timezone);
 end loop;
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) select student_id,auth.uid(),'sessions_scheduled',p_class,c.title from public.academy_class_members where class_id=p_class and status='active';
 return p_count;
end;$$;

create or replace function public.academy_guard_group_overlap() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('confirmed','in_progress') and new.confirmed_start is not null then
 perform pg_advisory_xact_lock(hashtextextended(new.teacher_id::text,1));
 perform pg_advisory_xact_lock(hashtextextended(new.student_id::text,611));
 if exists(select 1 from public.academy_class_sessions s where s.status='confirmed' and not exists(select 1 from public.academy_demo_accounts d where d.class_id=s.class_id) and s.starts_at<new.confirmed_start+make_interval(mins=>coalesce(new.duration_minutes,60)) and s.ends_at>new.confirmed_start and (s.teacher_id=new.teacher_id or exists(select 1 from public.academy_class_members m where m.class_id=s.class_id and m.student_id=new.student_id and m.status='active'))) then raise exception 'Class session conflict'; end if;
 end if;
 return new;
end;$$;

create function academy_private.no_demo_review() returns trigger language plpgsql security definer set search_path='' as $$begin if exists(select 1 from public.academy_demo_accounts where student_id=new.student_id) then raise exception 'Demo reviews are excluded';end if;return new;end;$$;
revoke all on function academy_private.no_demo_review() from public,anon,authenticated;
create trigger academy_no_demo_review before insert or update on public.academy_reviews for each row execute function academy_private.no_demo_review();
