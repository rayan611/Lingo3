-- Lingo3 Academy real MVP: secure public catalogue, internal availability,
-- actionable bookings, learning resources/homework, messaging and safer role updates.
-- Additive/backward-compatible except deliberate tightening of overly broad update policies.

-- ---------------------------------------------------------------------------
-- Public catalogue privacy: anonymous visitors need catalogue fields, not
-- internal auth/user identifiers such as created_by or teacher.user_id.
-- ---------------------------------------------------------------------------
revoke select on table public.academy_courses from anon;
grant select (
  id, subject_code, level_code, title_i18n, description_i18n, topics_i18n,
  delivery_modes, price_sek, duration_minutes, telegram_url, status, sort_order,
  created_at, updated_at
) on table public.academy_courses to anon;

revoke select on table public.academy_teachers from anon;
grant select (
  id, display_name, photo_url, intro_i18n, teaching_languages, spoken_languages,
  levels, specialties, email, phone, teams_chat_url, teams_call_url,
  telegram_url, status, created_at, updated_at
) on table public.academy_teachers to anon;

-- Teacher-course mapping contains only public catalogue ids.
grant select on table public.academy_teacher_courses to anon;

-- Teachers may not self-publish or rewrite protected profile fields directly.
drop policy if exists "academy teachers admin or self update" on public.academy_teachers;
drop policy if exists "academy teachers admin update" on public.academy_teachers;
create policy "academy teachers admin update"
on public.academy_teachers for update to authenticated
using (
  exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
)
with check (
  exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
);

-- ---------------------------------------------------------------------------
-- Teacher availability and internal calendar slots.
-- ---------------------------------------------------------------------------
create table if not exists public.academy_availability (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.academy_teachers(id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  delivery_mode text not null default 'online'
    check (delivery_mode in ('online','offline')),
  status text not null default 'available'
    check (status in ('available','booked','blocked','cancelled')),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  unique (teacher_id, starts_at, ends_at)
);

create index if not exists academy_availability_teacher_start_idx
  on public.academy_availability(teacher_id, starts_at);
create index if not exists academy_availability_public_idx
  on public.academy_availability(status, starts_at);

alter table public.academy_availability enable row level security;
grant select on public.academy_availability to anon, authenticated;
grant insert, update, delete on public.academy_availability to authenticated;

drop policy if exists "academy availability public read" on public.academy_availability;
create policy "academy availability public read"
on public.academy_availability for select to anon, authenticated
using (
  (
    status = 'available'
    and ends_at > now()
    and exists (
      select 1 from public.academy_teachers t
      where t.id = teacher_id and t.status = 'active'
    )
  )
  or exists (
    select 1 from public.academy_teachers t
    where t.id = teacher_id and t.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
);

drop policy if exists "academy availability teacher admin insert" on public.academy_availability;
create policy "academy availability teacher admin insert"
on public.academy_availability for insert to authenticated
with check (
  exists (
    select 1 from public.academy_teachers t
    where t.id = teacher_id and t.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
);

drop policy if exists "academy availability teacher admin update" on public.academy_availability;
create policy "academy availability teacher admin update"
on public.academy_availability for update to authenticated
using (
  exists (
    select 1 from public.academy_teachers t
    where t.id = teacher_id and t.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
)
with check (
  exists (
    select 1 from public.academy_teachers t
    where t.id = teacher_id and t.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
);

drop policy if exists "academy availability teacher admin delete" on public.academy_availability;
create policy "academy availability teacher admin delete"
on public.academy_availability for delete to authenticated
using (
  exists (
    select 1 from public.academy_teachers t
    where t.id = teacher_id and t.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
);

-- ---------------------------------------------------------------------------
-- Booking workflow extensions.
-- ---------------------------------------------------------------------------
alter table public.academy_bookings
  add column if not exists availability_id uuid references public.academy_availability(id) on delete set null,
  add column if not exists confirmed_start timestamptz,
  add column if not exists duration_minutes integer check (duration_minutes is null or (duration_minutes between 15 and 240)),
  add column if not exists teacher_note text;

create index if not exists academy_bookings_availability_idx
  on public.academy_bookings(availability_id);
create index if not exists academy_bookings_confirmed_start_idx
  on public.academy_bookings(confirmed_start);

create unique index if not exists academy_bookings_one_live_per_slot
  on public.academy_bookings(availability_id)
  where availability_id is not null
    and status not in ('cancelled_student','cancelled_teacher','cancelled_admin');

drop policy if exists "academy bookings student update" on public.academy_bookings;
create policy "academy bookings student update"
on public.academy_bookings for update to authenticated
using (student_id = (select auth.uid()))
with check (student_id = (select auth.uid()));

create or replace function public.academy_validate_booking_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  slot public.academy_availability%rowtype;
begin
  if not exists (
    select 1 from public.academy_teachers t
    where t.id = new.teacher_id and t.status = 'active'
  ) then
    raise exception 'Teacher is not available for booking';
  end if;

  if new.course_id is not null and not exists (
    select 1 from public.academy_teacher_courses tc
    where tc.teacher_id = new.teacher_id and tc.course_id = new.course_id
  ) then
    raise exception 'Selected teacher is not assigned to this course';
  end if;

  if new.availability_id is not null then
    select * into slot
    from public.academy_availability a
    where a.id = new.availability_id;

    if slot.id is null
       or slot.teacher_id <> new.teacher_id
       or slot.status <> 'available'
       or slot.ends_at <= now() then
      raise exception 'Selected availability slot is no longer available';
    end if;

    new.preferred_start := slot.starts_at;
  end if;

  return new;
end;
$$;

drop trigger if exists academy_validate_booking_insert_trg on public.academy_bookings;
create trigger academy_validate_booking_insert_trg
before insert on public.academy_bookings
for each row execute function public.academy_validate_booking_insert();

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
    if (to_jsonb(new) - array['preferred_start','student_message','status','updated_at']::text[])
       is distinct from
       (to_jsonb(old) - array['preferred_start','student_message','status','updated_at']::text[]) then
      raise exception 'Students may only change their requested time, message or cancel their booking';
    end if;
    if new.status not in ('requested','cancelled_student') then
      raise exception 'Invalid student booking status';
    end if;
    if old.status not in ('requested','confirmed') then
      raise exception 'This booking can no longer be changed by the student';
    end if;
    return new;
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

drop trigger if exists academy_guard_booking_update_trg on public.academy_bookings;
create trigger academy_guard_booking_update_trg
before update on public.academy_bookings
for each row execute function public.academy_guard_booking_update();

create or replace function public.academy_sync_slot_status()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.availability_id is null then
    return new;
  end if;

  if new.status in ('confirmed','in_progress','completed','no_show') then
    update public.academy_availability
      set status = 'booked', updated_at = now()
      where id = new.availability_id;
  elsif new.status in ('cancelled_student','cancelled_teacher','cancelled_admin') then
    update public.academy_availability
      set status = 'available', updated_at = now()
      where id = new.availability_id and ends_at > now();
  end if;

  return new;
end;
$$;

drop trigger if exists academy_sync_slot_status_trg on public.academy_bookings;
create trigger academy_sync_slot_status_trg
after update of status on public.academy_bookings
for each row execute function public.academy_sync_slot_status();

-- ---------------------------------------------------------------------------
-- Learning Space update safety + atomic activation.
-- ---------------------------------------------------------------------------
create or replace function public.academy_guard_learning_space_update()
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
    if (to_jsonb(new) - array['goal','updated_at']::text[])
       is distinct from
       (to_jsonb(old) - array['goal','updated_at']::text[]) then
      raise exception 'Students may only update their learning goal';
    end if;
    return new;
  end if;

  if is_teacher then
    if (to_jsonb(new) - array['goal','progress','current_level','target_level','next_session_topics','updated_at']::text[])
       is distinct from
       (to_jsonb(old) - array['goal','progress','current_level','target_level','next_session_topics','updated_at']::text[]) then
      raise exception 'Teachers may only update learning progress and plan fields';
    end if;
    return new;
  end if;

  raise exception 'Not allowed to update this Learning Space';
end;
$$;

drop trigger if exists academy_guard_learning_space_update_trg on public.academy_learning_spaces;
create trigger academy_guard_learning_space_update_trg
before update on public.academy_learning_spaces
for each row execute function public.academy_guard_learning_space_update();

create or replace function public.academy_activate_enrollment(
  p_enrollment_id uuid,
  p_teacher_id uuid
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  e public.academy_enrollments%rowtype;
  space_id uuid;
begin
  if not exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  ) then
    raise exception 'Admin permission required';
  end if;

  select * into e
  from public.academy_enrollments
  where id = p_enrollment_id
  for update;

  if e.id is null then
    raise exception 'Enrollment not found';
  end if;

  if not exists (
    select 1
    from public.academy_teacher_courses tc
    join public.academy_teachers t on t.id = tc.teacher_id
    where tc.teacher_id = p_teacher_id
      and tc.course_id = e.course_id
      and t.status = 'active'
  ) then
    raise exception 'Teacher is not active for this course';
  end if;

  update public.academy_enrollments
    set teacher_id = p_teacher_id,
        status = 'active',
        updated_at = now()
    where id = e.id;

  insert into public.academy_learning_spaces (
    enrollment_id, student_id, teacher_id, course_id,
    current_level, target_level, progress, updated_at
  )
  select
    e.id, e.student_id, p_teacher_id, e.course_id,
    c.level_code, c.level_code, 0, now()
  from public.academy_courses c
  where c.id = e.course_id
  on conflict (enrollment_id) do update
    set teacher_id = excluded.teacher_id,
        course_id = excluded.course_id,
        current_level = coalesce(public.academy_learning_spaces.current_level, excluded.current_level),
        target_level = coalesce(public.academy_learning_spaces.target_level, excluded.target_level),
        updated_at = now()
  returning id into space_id;

  return space_id;
end;
$$;

revoke all on function public.academy_activate_enrollment(uuid, uuid) from public;
revoke all on function public.academy_activate_enrollment(uuid, uuid) from anon;
grant execute on function public.academy_activate_enrollment(uuid, uuid) to authenticated;

-- Notes become manageable by their author without exposing other notes.
drop policy if exists "academy notes author update" on public.academy_notes;
create policy "academy notes author update"
on public.academy_notes for update to authenticated
using (
  author_id = (select auth.uid())
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
)
with check (
  author_id = (select auth.uid())
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
);

drop policy if exists "academy notes author delete" on public.academy_notes;
create policy "academy notes author delete"
on public.academy_notes for delete to authenticated
using (
  author_id = (select auth.uid())
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
);

grant update, delete on public.academy_notes to authenticated;

-- ---------------------------------------------------------------------------
-- Materials + homework. One per-student Learning Space keeps the data model
-- lean: no separate submission table is required for the MVP.
-- ---------------------------------------------------------------------------
create table if not exists public.academy_resources (
  id uuid primary key default gen_random_uuid(),
  learning_space_id uuid not null references public.academy_learning_spaces(id) on delete cascade,
  teacher_id uuid not null references public.academy_teachers(id) on delete restrict,
  kind text not null check (kind in ('material','homework')),
  title text not null check (char_length(title) between 1 and 240),
  description text,
  url text,
  due_at timestamptz,
  student_status text not null default 'assigned'
    check (student_status in ('assigned','submitted','completed')),
  student_response text,
  teacher_feedback text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_resources_space_created_idx
  on public.academy_resources(learning_space_id, created_at desc);
create index if not exists academy_resources_teacher_idx
  on public.academy_resources(teacher_id);

alter table public.academy_resources enable row level security;
grant select, insert, update, delete on public.academy_resources to authenticated;

drop policy if exists "academy resources members read" on public.academy_resources;
create policy "academy resources members read"
on public.academy_resources for select to authenticated
using (
  exists (
    select 1 from public.academy_learning_spaces ls
    where ls.id = learning_space_id
      and (
        ls.student_id = (select auth.uid())
        or exists (
          select 1 from public.academy_teachers t
          where t.id = ls.teacher_id and t.user_id = (select auth.uid())
        )
        or exists (
          select 1 from public.user_settings s
          where s.user_id = (select auth.uid()) and s.is_admin
        )
      )
  )
);

drop policy if exists "academy resources teacher admin insert" on public.academy_resources;
create policy "academy resources teacher admin insert"
on public.academy_resources for insert to authenticated
with check (
  exists (
    select 1 from public.academy_learning_spaces ls
    where ls.id = learning_space_id
      and ls.teacher_id = teacher_id
      and (
        exists (
          select 1 from public.academy_teachers t
          where t.id = ls.teacher_id and t.user_id = (select auth.uid())
        )
        or exists (
          select 1 from public.user_settings s
          where s.user_id = (select auth.uid()) and s.is_admin
        )
      )
  )
);

drop policy if exists "academy resources members update" on public.academy_resources;
create policy "academy resources members update"
on public.academy_resources for update to authenticated
using (
  exists (
    select 1 from public.academy_learning_spaces ls
    where ls.id = learning_space_id
      and (
        ls.student_id = (select auth.uid())
        or exists (
          select 1 from public.academy_teachers t
          where t.id = ls.teacher_id and t.user_id = (select auth.uid())
        )
        or exists (
          select 1 from public.user_settings s
          where s.user_id = (select auth.uid()) and s.is_admin
        )
      )
  )
)
with check (
  exists (
    select 1 from public.academy_learning_spaces ls
    where ls.id = learning_space_id
      and (
        ls.student_id = (select auth.uid())
        or exists (
          select 1 from public.academy_teachers t
          where t.id = ls.teacher_id and t.user_id = (select auth.uid())
        )
        or exists (
          select 1 from public.user_settings s
          where s.user_id = (select auth.uid()) and s.is_admin
        )
      )
  )
);

drop policy if exists "academy resources teacher admin delete" on public.academy_resources;
create policy "academy resources teacher admin delete"
on public.academy_resources for delete to authenticated
using (
  exists (
    select 1 from public.academy_learning_spaces ls
    where ls.id = learning_space_id
      and (
        exists (
          select 1 from public.academy_teachers t
          where t.id = ls.teacher_id and t.user_id = (select auth.uid())
        )
        or exists (
          select 1 from public.user_settings s
          where s.user_id = (select auth.uid()) and s.is_admin
        )
      )
  )
);

create or replace function public.academy_guard_resource_update()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  student_uid uuid;
  teacher_uid uuid;
  is_admin boolean := exists (
    select 1 from public.user_settings s where s.user_id = uid and s.is_admin
  );
begin
  select ls.student_id, t.user_id
  into student_uid, teacher_uid
  from public.academy_learning_spaces ls
  left join public.academy_teachers t on t.id = ls.teacher_id
  where ls.id = old.learning_space_id;

  if is_admin or uid = teacher_uid then
    return new;
  end if;

  if uid = student_uid then
    if (to_jsonb(new) - array['student_status','student_response','updated_at']::text[])
       is distinct from
       (to_jsonb(old) - array['student_status','student_response','updated_at']::text[]) then
      raise exception 'Students may only update their submission status and response';
    end if;
    if new.student_status not in ('assigned','submitted') then
      raise exception 'Only the teacher may mark homework completed';
    end if;
    return new;
  end if;

  raise exception 'Not allowed to update this resource';
end;
$$;

drop trigger if exists academy_guard_resource_update_trg on public.academy_resources;
create trigger academy_guard_resource_update_trg
before update on public.academy_resources
for each row execute function public.academy_guard_resource_update();

-- ---------------------------------------------------------------------------
-- Private student <-> teacher messaging inside a Learning Space.
-- ---------------------------------------------------------------------------
create table if not exists public.academy_messages (
  id uuid primary key default gen_random_uuid(),
  learning_space_id uuid not null references public.academy_learning_spaces(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 5000),
  read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index if not exists academy_messages_space_created_idx
  on public.academy_messages(learning_space_id, created_at desc);
create index if not exists academy_messages_recipient_unread_idx
  on public.academy_messages(recipient_id, read_at);

alter table public.academy_messages enable row level security;
grant select, insert, update on public.academy_messages to authenticated;

drop policy if exists "academy messages members read" on public.academy_messages;
create policy "academy messages members read"
on public.academy_messages for select to authenticated
using (
  sender_id = (select auth.uid())
  or recipient_id = (select auth.uid())
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
);

drop policy if exists "academy messages member insert" on public.academy_messages;
create policy "academy messages member insert"
on public.academy_messages for insert to authenticated
with check (
  sender_id = (select auth.uid())
  and exists (
    select 1
    from public.academy_learning_spaces ls
    left join public.academy_teachers t on t.id = ls.teacher_id
    where ls.id = learning_space_id
      and (
        (
          ls.student_id = sender_id
          and t.user_id = recipient_id
        )
        or (
          t.user_id = sender_id
          and ls.student_id = recipient_id
        )
      )
  )
);

drop policy if exists "academy messages recipient read update" on public.academy_messages;
create policy "academy messages recipient read update"
on public.academy_messages for update to authenticated
using (
  recipient_id = (select auth.uid())
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
)
with check (
  recipient_id = (select auth.uid())
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
);

create or replace function public.academy_guard_message_update()
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

  if old.recipient_id <> (select auth.uid()) then
    raise exception 'Only the recipient may mark a message read';
  end if;

  if (to_jsonb(new) - array['read_at','updated_at']::text[])
     is distinct from
     (to_jsonb(old) - array['read_at','updated_at']::text[]) then
    raise exception 'Messages are immutable after sending';
  end if;

  return new;
end;
$$;

drop trigger if exists academy_guard_message_update_trg on public.academy_messages;
create trigger academy_guard_message_update_trg
before update on public.academy_messages
for each row execute function public.academy_guard_message_update();
