-- Human-readable student labels for teacher workflows.
alter table public.academy_bookings
  add column if not exists student_display_name text;
alter table public.academy_learning_spaces
  add column if not exists student_display_name text;

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

  new.student_display_name := coalesce(
    (
      select nullif(trim(s.display_name), '')
      from public.user_settings s
      where s.user_id = new.student_id
    ),
    'Student'
  );

  return new;
end;
$$;

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
  student_name text;
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

  select coalesce(nullif(trim(s.display_name), ''), 'Student')
  into student_name
  from public.user_settings s
  where s.user_id = e.student_id;

  student_name := coalesce(student_name, 'Student');

  update public.academy_enrollments
    set teacher_id = p_teacher_id,
        status = 'active',
        updated_at = now()
    where id = e.id;

  insert into public.academy_learning_spaces (
    enrollment_id, student_id, student_display_name, teacher_id, course_id,
    current_level, target_level, progress, updated_at
  )
  select
    e.id, e.student_id, student_name, p_teacher_id, e.course_id,
    c.level_code, c.level_code, 0, now()
  from public.academy_courses c
  where c.id = e.course_id
  on conflict (enrollment_id) do update
    set student_display_name = excluded.student_display_name,
        teacher_id = excluded.teacher_id,
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
