create table public.academy_class_requests (
 id uuid primary key default gen_random_uuid(),
 class_id uuid not null references public.academy_classes(id),
 student_id uuid not null references auth.users(id),
 message text not null default '' check(length(message)<=2000),
 status text not null default 'pending' check(status in ('pending','accepted','rejected','withdrawn','expired')),
 expires_at timestamptz not null default now()+interval '24 hours',
 created_at timestamptz not null default now()
);
create unique index academy_pending_class_request on public.academy_class_requests(class_id,student_id) where status='pending';
alter table public.academy_class_requests enable row level security;
revoke all on public.academy_class_requests from anon,authenticated;
grant select on public.academy_class_requests to authenticated;
create policy "Membership request participants" on public.academy_class_requests for select to authenticated using(student_id=auth.uid() or exists(select 1 from public.academy_classes c where c.id=class_id and (public.is_admin() or public.academy_active_teacher(c.teacher_id))));
create function public.academy_open_classes() returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(q)),'[]') from (
 select c.id,c.title,c.course_id,t.display_name as teacher_name,c.capacity,
 greatest(0,c.capacity-(select count(*) from public.academy_class_members m where m.class_id=c.id and m.status='active')-(select count(*) from public.academy_class_requests r where r.class_id=c.id and r.status='pending' and r.expires_at>now())) as places,
 (select jsonb_agg(jsonb_build_object('starts_at',s.starts_at,'ends_at',s.ends_at) order by s.starts_at) from public.academy_class_sessions s where s.class_id=c.id and s.status='confirmed' and s.starts_at>now()) as sessions
 from public.academy_classes c join public.academy_teachers t on t.id=c.teacher_id
 where c.status='active' and c.capacity>1 and t.status='active'
 and exists(select 1 from public.academy_class_sessions s where s.class_id=c.id and s.status='confirmed' and s.starts_at>now())
 order by c.created_at desc limit 100)q;
$$;
create function public.academy_request_class(p_class uuid,p_message text default '') returns void language plpgsql security definer set search_path='' as $$
declare c public.academy_classes; teacher_user uuid;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into c from public.academy_classes where id=p_class for update;
 if c.id is null or c.status<>'active' or c.capacity<2 or not exists(select 1 from public.academy_teachers where id=c.teacher_id and status='active') then raise exception 'Class is not open'; end if;
 update public.academy_class_requests set status='expired' where class_id=p_class and status='pending' and expires_at<=now();
 if exists(select 1 from public.academy_class_requests where class_id=p_class and student_id=auth.uid() and status='pending') then return; end if;
 if exists(select 1 from public.academy_class_members where class_id=p_class and student_id=auth.uid() and status='active') then raise exception 'Already a member'; end if;
 if (select count(*) from public.academy_class_members where class_id=p_class and status='active')+(select count(*) from public.academy_class_requests where class_id=p_class and status='pending')>=c.capacity then raise exception 'Class is full'; end if;
 insert into public.academy_class_requests(class_id,student_id,message) values(p_class,auth.uid(),coalesce(p_message,''));
 select user_id into teacher_user from public.academy_teachers where id=c.teacher_id;
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) values(teacher_user,auth.uid(),'membership_requested',p_class,c.title);
end;$$;
create function public.academy_resolve_class_request(p_request uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare r public.academy_class_requests; c public.academy_classes;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into r from public.academy_class_requests where id=p_request;
 select * into c from public.academy_classes where id=r.class_id for update;
 select * into r from public.academy_class_requests where id=p_request for update;
 if r.id is null or r.status<>'pending' then raise exception 'Pending request required'; end if;
 if p_status='withdrawn' then
 if r.student_id<>auth.uid() then raise exception 'Own request required' using errcode='42501'; end if;
 elsif p_status in ('accepted','rejected') then
 if not (public.is_admin() or public.academy_active_teacher(c.teacher_id)) then raise exception 'Teacher permission required' using errcode='42501'; end if;
 else raise exception 'Invalid action'; end if;
 if r.expires_at<=now() then update public.academy_class_requests set status='expired' where id=r.id;return;end if;
 update public.academy_class_requests set status=p_status where id=r.id;
 if p_status='accepted' then perform public.academy_add_class_member(c.id,r.student_id);end if;
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) values(r.student_id,auth.uid(),'membership_'||p_status,c.id,c.title);
end;$$;
revoke all on function public.academy_open_classes(),public.academy_request_class(uuid,text),public.academy_resolve_class_request(uuid,text) from public,anon,authenticated;
grant execute on function public.academy_open_classes() to anon,authenticated;
grant execute on function public.academy_request_class(uuid,text),public.academy_resolve_class_request(uuid,text) to authenticated;
create or replace function public.academy_add_class_member(p_class uuid,p_student uuid) returns void
language plpgsql security definer set search_path='' as $$
declare c public.academy_classes;
begin
 select * into c from public.academy_classes where id=p_class for update;
 if auth.uid() is null or c.id is null or not (public.is_admin() or public.academy_active_teacher(c.teacher_id)) then raise exception 'Teacher permission required' using errcode='42501'; end if;
 if c.status<>'active' then raise exception 'Class is not active'; end if;
 if exists(select 1 from public.academy_class_members where class_id=p_class and student_id=p_student and status='active') then return; end if;
 if (select count(*) from public.academy_class_members where class_id=p_class and status='active')+(select count(*) from public.academy_class_requests where class_id=p_class and status='pending' and expires_at>now())>=c.capacity then raise exception 'Class is full'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_student::text,611));
 if exists(select 1 from public.academy_class_sessions s join public.academy_class_sessions other on other.id<>s.id and other.status='confirmed' and other.starts_at<s.ends_at and other.ends_at>s.starts_at
 join public.academy_class_members m on m.class_id=other.class_id and m.student_id=p_student and m.status='active'
 where s.class_id=p_class and s.status='confirmed' and s.ends_at>now()) or exists(select 1 from public.academy_class_sessions s join public.academy_bookings b on b.student_id=p_student and b.status in ('confirmed','in_progress') and b.confirmed_start<s.ends_at and b.confirmed_start+make_interval(mins=>coalesce(b.duration_minutes,60))>s.starts_at where s.class_id=p_class and s.status='confirmed' and s.ends_at>now()) then raise exception 'Student has an overlapping class'; end if;
 insert into public.academy_class_members(class_id,student_id) values(p_class,p_student) on conflict(class_id,student_id) do update set status='active';
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) values(p_student,auth.uid(),'class_joined',p_class,c.title);
end;$$;
