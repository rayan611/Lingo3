-- Keep demo bookings out of real availability conflict calculations.
CREATE OR REPLACE FUNCTION public.academy_guard_booking_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  uid uuid := (select auth.uid());
  is_admin boolean := exists (
    select 1 from public.user_settings s where s.user_id = uid and s.is_admin
  );
  is_teacher boolean := exists (
    select 1 from public.academy_teachers t
    where t.id = old.teacher_id and t.user_id = uid
  );
  booking_end timestamptz;
begin
  if is_admin then
    -- Admin may manage the row, but confirmed sessions still may not overlap.
    if new.status = 'confirmed' and new.confirmed_start is not null then
      perform pg_advisory_xact_lock(hashtextextended(new.teacher_id::text, 1));
      booking_end := new.confirmed_start + make_interval(mins => coalesce(new.duration_minutes, 60));
      if exists (
        select 1 from public.academy_bookings b
        where b.teacher_id = new.teacher_id
 and not exists(select 1 from public.academy_demo_accounts d where d.student_id=b.student_id or d.student_id=new.student_id)
          and b.id <> new.id
          and b.status in ('confirmed','in_progress')
          and b.confirmed_start is not null
          and b.confirmed_start < booking_end
          and (b.confirmed_start + make_interval(mins => coalesce(b.duration_minutes,60))) > new.confirmed_start
      ) then
        raise exception 'Teacher already has a confirmed session at this time';
      end if;
    end if;
    return new;
  end if;

  if uid = old.student_id then
    if old.status = 'requested' then
      if (to_jsonb(new) - array['preferred_start','student_message','status','updated_at']::text[])
         is distinct from
         (to_jsonb(old) - array['preferred_start','student_message','status','updated_at']::text[]) then
        raise exception 'Students may only change their requested time, message or cancel their booking';
      end if;
      if new.status not in ('requested','cancelled_student') then
        raise exception 'Invalid student booking status';
      end if;
      return new;
    end if;

    if old.status = 'confirmed' then
      if (to_jsonb(new) - array['status','updated_at']::text[])
         is distinct from
         (to_jsonb(old) - array['status','updated_at']::text[]) then
        raise exception 'Confirmed bookings may only be cancelled by the student';
      end if;
      if new.status <> 'cancelled_student' then
        raise exception 'Confirmed bookings may only be cancelled by the student';
      end if;
      return new;
    end if;

    raise exception 'This booking can no longer be changed by the student';
  end if;

  if is_teacher then
    if (to_jsonb(new) - array['status','confirmed_start','duration_minutes','meeting_url','meeting_backup_url','teacher_note','updated_at']::text[])
       is distinct from
       (to_jsonb(old) - array['status','confirmed_start','duration_minutes','meeting_url','meeting_backup_url','teacher_note','updated_at']::text[]) then
      raise exception 'Teachers may only update session status, time, duration, meeting link and teacher note';
    end if;
    if new.status not in ('requested','confirmed','in_progress','completed','cancelled_teacher','no_show') then
      raise exception 'Invalid teacher booking status';
    end if;

    if new.status = 'confirmed' then
      if new.confirmed_start is null then
        raise exception 'A confirmed session needs a date and time';
      end if;
      perform pg_advisory_xact_lock(hashtextextended(new.teacher_id::text, 1));
      booking_end := new.confirmed_start + make_interval(mins => coalesce(new.duration_minutes, 60));
      if exists (
        select 1 from public.academy_bookings b
        where b.teacher_id = new.teacher_id
 and not exists(select 1 from public.academy_demo_accounts d where d.student_id=b.student_id or d.student_id=new.student_id)
          and b.id <> new.id
          and b.status in ('confirmed','in_progress')
          and b.confirmed_start is not null
          and b.confirmed_start < booking_end
          and (b.confirmed_start + make_interval(mins => coalesce(b.duration_minutes,60))) > new.confirmed_start
      ) then
        raise exception 'Teacher already has a confirmed session at this time';
      end if;
    end if;

    return new;
  end if;

  raise exception 'Not allowed to update this booking';
end;
$function$
;
CREATE OR REPLACE FUNCTION public.academy_guard_group_overlap()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if exists(select 1 from public.academy_demo_accounts where student_id=new.student_id) then return new;end if;
 if new.status in ('confirmed','in_progress') and new.confirmed_start is not null then
 perform pg_advisory_xact_lock(hashtextextended(new.teacher_id::text,1));
 perform pg_advisory_xact_lock(hashtextextended(new.student_id::text,611));
 if exists(select 1 from public.academy_class_sessions s where s.status='confirmed' and not exists(select 1 from public.academy_demo_accounts d where d.class_id=s.class_id) and s.starts_at<new.confirmed_start+make_interval(mins=>coalesce(new.duration_minutes,60)) and s.ends_at>new.confirmed_start and (s.teacher_id=new.teacher_id or exists(select 1 from public.academy_class_members m where m.class_id=s.class_id and m.student_id=new.student_id and m.status='active'))) then raise exception 'Class session conflict'; end if;
 end if;
 return new;
end;$function$
;
CREATE OR REPLACE FUNCTION public.academy_schedule_class(p_class uuid, p_start timestamp without time zone, p_timezone text, p_minutes integer, p_repeat text, p_count integer)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 or exists(select 1 from public.academy_bookings b where not exists(select 1 from public.academy_demo_accounts d where d.student_id=b.student_id) and b.status in ('confirmed','in_progress') and b.confirmed_start<finish_time and b.confirmed_start+make_interval(mins=>coalesce(b.duration_minutes,60))>start_time and (b.teacher_id=c.teacher_id or exists(select 1 from public.academy_class_members m where m.class_id=p_class and m.student_id=b.student_id and m.status='active')))
 then raise exception 'Schedule conflict at %',start_time; end if;
 insert into public.academy_class_sessions(class_id,teacher_id,series_id,starts_at,ends_at,timezone) values(p_class,c.teacher_id,series,start_time,finish_time,p_timezone);
 end loop;
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) select student_id,auth.uid(),'sessions_scheduled',p_class,c.title from public.academy_class_members where class_id=p_class and status='active';
 return p_count;
end;$function$
;
