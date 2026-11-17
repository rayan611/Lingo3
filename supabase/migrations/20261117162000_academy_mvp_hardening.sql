-- Final Academy MVP hardening after role/workflow tests.

-- Anonymous users only need the public slot fields, not an internal slot note.
revoke select on table public.academy_availability from anon;
grant select (id, teacher_id, starts_at, ends_at, delivery_mode, status)
on table public.academy_availability to anon;

-- Tighten student booking edits: requested bookings can change proposal/message
-- or cancel; confirmed bookings can only be cancelled by the student.
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
begin
  if is_admin then
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
    return new;
  end if;

  raise exception 'Not allowed to update this booking';
end;
$$;

-- Notes are editable by their author, but identity and Learning Space are immutable.
create or replace function public.academy_guard_note_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  ) then
    return new;
  end if;

  if old.author_id <> (select auth.uid()) then
    raise exception 'Only the note author may edit this note';
  end if;

  if (to_jsonb(new) - array['body','visibility','tags','updated_at']::text[])
     is distinct from
     (to_jsonb(old) - array['body','visibility','tags','updated_at']::text[]) then
    raise exception 'A note cannot be moved to another Learning Space or author';
  end if;

  return new;
end;
$$;

drop trigger if exists academy_guard_note_update_trg on public.academy_notes;
create trigger academy_guard_note_update_trg
before update on public.academy_notes
for each row execute function public.academy_guard_note_update();
