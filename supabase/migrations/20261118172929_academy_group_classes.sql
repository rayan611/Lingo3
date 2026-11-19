create table public.academy_classes (
 id uuid primary key default gen_random_uuid(),
 teacher_id uuid not null references public.academy_teachers(id),
 course_id uuid not null references public.academy_courses(id),
 title text not null check(length(title) between 1 and 160),
 capacity integer not null default 1 check(capacity between 1 and 100),
 status text not null default 'active' check(status in ('active','completed','cancelled')),
 created_at timestamptz not null default now()
);
create table public.academy_class_members (
 class_id uuid not null references public.academy_classes(id),
 student_id uuid not null references auth.users(id),
 status text not null default 'active' check(status in ('active','completed','cancelled')),
 joined_at timestamptz not null default now(),
 primary key(class_id,student_id)
);
create table public.academy_class_sessions (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.academy_classes(id),
 teacher_id uuid not null references public.academy_teachers(id),
 series_id uuid not null,
 starts_at timestamptz not null,
 ends_at timestamptz not null check(ends_at>starts_at),
 timezone text not null,
 status text not null default 'confirmed' check(status in ('confirmed','completed','cancelled')),
 reason text,
 created_at timestamptz not null default now()
);
create index on public.academy_class_sessions(teacher_id,starts_at);
create table public.academy_class_attendance (
 session_id uuid not null references public.academy_class_sessions(id),
 student_id uuid not null references auth.users(id),
 status text not null check(status in ('present','absent','excused')),
 primary key(session_id,student_id)
);
create table public.academy_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id),
 actor_id uuid references auth.users(id),
 event text not null,
 class_id uuid references public.academy_classes(id),
 body text not null,
 read_at timestamptz,
 created_at timestamptz not null default now()
);
create index on public.academy_notifications(user_id,created_at desc);
create schema if not exists academy_private;
revoke all on schema academy_private from public,anon,authenticated;
create function academy_private.class_access(p_class uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(select 1 from public.academy_classes c where c.id=p_class and
 (public.is_admin() or public.academy_active_teacher(c.teacher_id) or exists(select 1 from public.academy_class_members m where m.class_id=c.id and m.student_id=auth.uid() and m.status='active')));
$$;
grant usage on schema academy_private to authenticated;
grant execute on function academy_private.class_access(uuid) to authenticated;
alter table public.academy_classes enable row level security;
alter table public.academy_class_members enable row level security;
alter table public.academy_class_sessions enable row level security;
alter table public.academy_class_attendance enable row level security;
alter table public.academy_notifications enable row level security;
revoke all on public.academy_classes,public.academy_class_members,public.academy_class_sessions,public.academy_class_attendance,public.academy_notifications from anon,authenticated;
grant select on public.academy_classes,public.academy_class_members,public.academy_class_sessions,public.academy_class_attendance,public.academy_notifications to authenticated;
create policy "Class members read" on public.academy_classes for select to authenticated using(academy_private.class_access(id));
create policy "Own membership or class teacher" on public.academy_class_members for select to authenticated using(student_id=auth.uid() or exists(select 1 from public.academy_classes c where c.id=class_id and (public.is_admin() or public.academy_active_teacher(c.teacher_id))));
create policy "Class sessions read" on public.academy_class_sessions for select to authenticated using(academy_private.class_access(class_id));
create policy "Own attendance or teacher" on public.academy_class_attendance for select to authenticated using(student_id=auth.uid() or exists(select 1 from public.academy_class_sessions s where s.id=session_id and (public.is_admin() or public.academy_active_teacher(s.teacher_id))));
create policy "Own notifications" on public.academy_notifications for select to authenticated using(user_id=auth.uid());

create function public.academy_teacher_find_students(p_query text) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not (public.is_admin() or exists(select 1 from public.academy_teachers where user_id=auth.uid() and status='active')) then raise exception 'Teacher permission required' using errcode='42501'; end if;
 if length(trim(p_query))<3 then return '[]'; end if;
 return coalesce((select jsonb_agg(to_jsonb(q)) from (
 select u.id as user_id,coalesce(s.display_name,'Student') as display_name
 from auth.users u left join public.user_settings s on s.user_id=u.id
 where u.id::text=p_query or position(lower(p_query) in lower(coalesce(s.display_name,'')))>0
 order by s.display_name,u.id limit 12) q),'[]');
end;$$;
create function public.academy_create_class(p_teacher uuid,p_course uuid,p_title text,p_capacity integer) returns uuid
language plpgsql security definer set search_path='' as $$
declare cid uuid;
begin
 if auth.uid() is null or not (public.is_admin() or public.academy_active_teacher(p_teacher)) then raise exception 'Teacher permission required' using errcode='42501'; end if;
 if not exists(select 1 from public.academy_teacher_courses tc join public.academy_courses c on c.id=tc.course_id where tc.teacher_id=p_teacher and tc.course_id=p_course and c.status='active') then raise exception 'Course must be assigned to teacher'; end if;
 insert into public.academy_classes(teacher_id,course_id,title,capacity) values(p_teacher,p_course,trim(p_title),p_capacity) returning id into cid;
 return cid;
end;$$;
create function public.academy_add_class_member(p_class uuid,p_student uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.academy_classes;
begin
 select * into c from public.academy_classes where id=p_class for update;
 if auth.uid() is null or c.id is null or not (public.is_admin() or public.academy_active_teacher(c.teacher_id)) then raise exception 'Teacher permission required' using errcode='42501'; end if;
 if c.status<>'active' then raise exception 'Class is not active'; end if;
 if exists(select 1 from public.academy_class_members where class_id=p_class and student_id=p_student and status='active') then return; end if;
 if (select count(*) from public.academy_class_members where class_id=p_class and status='active')>=c.capacity then raise exception 'Class is full'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_student::text,611));
 if exists(select 1 from public.academy_class_sessions s join public.academy_class_sessions other on other.id<>s.id and other.status='confirmed' and other.starts_at<s.ends_at and other.ends_at>s.starts_at
 join public.academy_class_members m on m.class_id=other.class_id and m.student_id=p_student and m.status='active'
 where s.class_id=p_class and s.status='confirmed' and s.ends_at>now()) then raise exception 'Student has an overlapping class'; end if;
 insert into public.academy_class_members(class_id,student_id) values(p_class,p_student) on conflict(class_id,student_id) do update set status='active';
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) values(p_student,auth.uid(),'class_joined',p_class,c.title);
end;$$;
create function public.academy_schedule_class(p_class uuid,p_start timestamp,p_timezone text,p_minutes integer,p_repeat text,p_count integer) returns integer
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
 if exists(select 1 from public.academy_class_sessions s where s.status='confirmed' and s.starts_at<finish_time and s.ends_at>start_time and
 (s.teacher_id=c.teacher_id or exists(select 1 from public.academy_class_members own_m join public.academy_class_members other_m on other_m.student_id=own_m.student_id where own_m.class_id=p_class and other_m.class_id=s.class_id and own_m.status='active' and other_m.status='active')))
 or exists(select 1 from public.academy_bookings b where b.status in ('confirmed','in_progress') and b.confirmed_start<finish_time and b.confirmed_start+make_interval(mins=>coalesce(b.duration_minutes,60))>start_time and (b.teacher_id=c.teacher_id or exists(select 1 from public.academy_class_members m where m.class_id=p_class and m.student_id=b.student_id and m.status='active')))
 then raise exception 'Schedule conflict at %',start_time; end if;
 insert into public.academy_class_sessions(class_id,teacher_id,series_id,starts_at,ends_at,timezone) values(p_class,c.teacher_id,series,start_time,finish_time,p_timezone);
 end loop;
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) select student_id,auth.uid(),'sessions_scheduled',p_class,c.title from public.academy_class_members where class_id=p_class and status='active';
 return p_count;
end;$$;
create function public.academy_read_notification(p_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 update public.academy_notifications set read_at=coalesce(read_at,now()) where id=p_id and user_id=auth.uid();
end;$$;
revoke all on function public.academy_teacher_find_students(text),public.academy_create_class(uuid,uuid,text,integer),public.academy_add_class_member(uuid,uuid),public.academy_schedule_class(uuid,timestamp,text,integer,text,integer),public.academy_read_notification(uuid) from public,anon,authenticated;
grant execute on function public.academy_teacher_find_students(text),public.academy_create_class(uuid,uuid,text,integer),public.academy_add_class_member(uuid,uuid),public.academy_schedule_class(uuid,timestamp,text,integer,text,integer),public.academy_read_notification(uuid) to authenticated;
-- Existing booking callers participate in the same teacher scheduling lock.
create function public.academy_guard_group_overlap() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status in ('confirmed','in_progress') and new.confirmed_start is not null then
 perform pg_advisory_xact_lock(hashtextextended(new.teacher_id::text,1));
 perform pg_advisory_xact_lock(hashtextextended(new.student_id::text,611));
 if exists(select 1 from public.academy_class_sessions s where s.status='confirmed' and s.starts_at<new.confirmed_start+make_interval(mins=>coalesce(new.duration_minutes,60)) and s.ends_at>new.confirmed_start and (s.teacher_id=new.teacher_id or exists(select 1 from public.academy_class_members m where m.class_id=s.class_id and m.student_id=new.student_id and m.status='active'))) then raise exception 'Class session conflict'; end if;
 end if;
 return new;
end;$$;
revoke all on function public.academy_guard_group_overlap() from public,anon,authenticated;
create trigger academy_group_overlap before insert or update on public.academy_bookings for each row execute function public.academy_guard_group_overlap();
