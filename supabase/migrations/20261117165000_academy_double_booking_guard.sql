-- Prevent overlapping teacher availability and confirmed sessions.

create or replace function public.academy_guard_availability_overlap()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Serialize availability edits for one teacher to avoid concurrent overlap races.
  perform pg_advisory_xact_lock(hashtextextended(new.teacher_id::text, 0));

  if new.status in ('available','booked','blocked') and exists (
    select 1
    from public.academy_availability a
    where a.teacher_id = new.teacher_id
      and a.id <> new.id
      and a.status in ('available','booked','blocked')
      and a.starts_at < new.ends_at
      and a.ends_at > new.starts_at
  ) then
    raise exception 'This availability overlaps another teacher time block';
  end if;

  return new;
end;
$$;

drop trigger if exists academy_guard_availability_overlap_trg on public.academy_availability;
create trigger academy_guard_availability_overlap_trg
before insert or update of teacher_id, starts_at, ends_at, status
on public.academy_availability
for each row execute function public.academy_guard_availability_overlap();

create or replace function public.academy_guard_booking_update()
returns trigger
language plpgsql
set search_path = ''
as $$
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
    if (to_jsonb(new) - array['status','confirmed_start','duration_minutes','meeting_url','teacher_note','updated_at']::text[])
       is distinct from
       (to_jsonb(old) - array['status','confirmed_start','duration_minutes','meeting_url','teacher_note','updated_at']::text[]) then
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
$$;
