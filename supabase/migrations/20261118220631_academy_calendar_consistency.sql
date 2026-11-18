-- Public calendar deliberately projects only anonymous free/busy times.
create or replace function public.academy_teacher_calendar(p_teacher_id uuid,p_from timestamptz default now(),p_to timestamptz default now()+interval '60 days')
returns table(id uuid,teacher_id uuid,starts_at timestamptz,ends_at timestamptz,delivery_mode text,status text)
language sql stable security definer set search_path='' as $$
 with occupied as (
 select s.id,s.teacher_id,s.starts_at,s.ends_at,'online'::text as mode from public.academy_class_sessions s where s.teacher_id=p_teacher_id and s.status='confirmed'
 union all
 select b.id,b.teacher_id,b.confirmed_start,b.confirmed_start+make_interval(mins=>b.duration_minutes),'online'::text from public.academy_bookings b where b.teacher_id=p_teacher_id and b.status in ('confirmed','in_progress')
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
