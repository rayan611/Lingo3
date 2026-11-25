-- Scheduling v2:
--  1. a student may suggest up to three alternative times with one request (the teacher confirms one);
--  2. a teacher or admin can fix lessons for a student: several weekdays/times per week, for up to 12 weeks;
--  3. an admin can assign a student to a course and teacher directly (creates the enrollment and learning space).
alter table public.academy_bookings
  add column if not exists alternative_starts timestamptz[] not null default '{}'
  check (cardinality(alternative_starts) <= 3);

create function public.academy_admin_assign_student(p_student uuid, p_course uuid, p_teacher uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare eid uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=p_student) then raise exception 'Student not found'; end if;
 select id into eid from public.academy_enrollments
  where student_id=p_student and course_id=p_course and removed_at is null order by created_at limit 1;
 if eid is null then
  insert into public.academy_enrollments(student_id,course_id,teacher_id,status)
  values(p_student,p_course,p_teacher,'interested')
  on conflict(student_id,course_id,teacher_id) do update set removed_at=null
  returning id into eid;
 end if;
 return public.academy_activate_enrollment(eid,p_teacher);
end;$$;
revoke all on function public.academy_admin_assign_student(uuid,uuid,uuid) from public,anon;
grant execute on function public.academy_admin_assign_student(uuid,uuid,uuid) to authenticated;

create function public.academy_teacher_schedule_student(p_space uuid, p_from date, p_timezone text, p_minutes integer, p_slots jsonb, p_weeks integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.academy_learning_spaces; slot jsonb; wd integer; tm time; w integer; d date; st timestamptz;
 created integer:=0; skipped jsonb:='[]'::jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into s from public.academy_learning_spaces where id=p_space;
 if not found or s.teacher_id is null or not (public.is_admin() or public.academy_active_teacher(s.teacher_id)) then
  raise exception 'Teacher permission required' using errcode='42501'; end if;
 if p_from is null or p_minutes is null or p_minutes not between 15 and 240 or p_weeks is null or p_weeks not between 1 and 12
    or p_timezone is null or not exists(select 1 from pg_timezone_names where name=p_timezone) then
  raise exception 'Invalid schedule'; end if;
 if p_slots is null or jsonb_typeof(p_slots)<>'array' or jsonb_array_length(p_slots) not between 1 and 14 then
  raise exception 'Add one to fourteen weekly times'; end if;
 perform pg_advisory_xact_lock(hashtextextended(s.teacher_id::text,1));
 perform pg_advisory_xact_lock(hashtextextended(s.student_id::text,611));
 for w in 0..p_weeks-1 loop
  for slot in select * from jsonb_array_elements(p_slots) loop
   wd:=(slot->>'weekday')::integer; tm:=(slot->>'time')::time;
   if wd not between 1 and 7 then raise exception 'Invalid weekday'; end if;
   d:=p_from + ((wd - extract(isodow from p_from)::integer + 7) % 7) + 7*w;
   st:=(d + tm) at time zone p_timezone;
   if st <= now() then continue; end if;
   if exists(select 1 from public.academy_bookings b
              where b.status in ('confirmed','in_progress') and b.confirmed_start is not null
                and (b.teacher_id=s.teacher_id or b.student_id=s.student_id)
                and b.confirmed_start < st + make_interval(mins=>p_minutes)
                and b.confirmed_start + make_interval(mins=>coalesce(b.duration_minutes,60)) > st) then
    skipped:=skipped||to_jsonb(st); continue; end if;
   insert into public.academy_bookings(student_id,teacher_id,course_id,session_type,preferred_start,confirmed_start,duration_minutes,status)
   values(s.student_id,s.teacher_id,s.course_id,'individual',st,st,p_minutes,'confirmed');
   created:=created+1;
  end loop;
 end loop;
 if created>0 then
  insert into public.academy_notifications(user_id,actor_id,event,body)
  values(s.student_id,auth.uid(),'lessons_scheduled',created||' lesson'||case when created=1 then '' else 's' end||' scheduled by your teacher.');
 end if;
 return jsonb_build_object('created',created,'skipped',skipped);
end;$$;
revoke all on function public.academy_teacher_schedule_student(uuid,date,text,integer,jsonb,integer) from public,anon;
grant execute on function public.academy_teacher_schedule_student(uuid,date,text,integer,jsonb,integer) to authenticated;
