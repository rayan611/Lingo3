-- Academy role dashboards, teacher summaries/tests, and Control Center management.
-- Prepared in repository only. Do not apply to production without explicit release approval.

-- ---------------------------------------------------------------------------
-- Structured teacher session summaries
-- ---------------------------------------------------------------------------
create table if not exists public.academy_session_summaries (
  id uuid primary key default gen_random_uuid(),
  learning_space_id uuid not null references public.academy_learning_spaces(id) on delete cascade,
  booking_id uuid references public.academy_bookings(id) on delete set null,
  teacher_id uuid not null references public.academy_teachers(id) on delete restrict,
  student_id uuid not null references auth.users(id) on delete cascade,
  covered text,
  grammar_focus text,
  strengths text,
  improve_next text,
  next_focus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_session_summaries_space_created_idx
  on public.academy_session_summaries(learning_space_id, created_at desc);
create unique index if not exists academy_session_summaries_booking_uidx
  on public.academy_session_summaries(booking_id) where booking_id is not null;

alter table public.academy_session_summaries enable row level security;
grant select, insert, update, delete on public.academy_session_summaries to authenticated;

drop policy if exists "academy summaries members read" on public.academy_session_summaries;
create policy "academy summaries members read"
on public.academy_session_summaries for select to authenticated
using (
  student_id = (select auth.uid())
  or exists (
    select 1 from public.academy_teachers t
    where t.id = teacher_id and t.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
);

drop policy if exists "academy summaries teacher admin insert" on public.academy_session_summaries;
create policy "academy summaries teacher admin insert"
on public.academy_session_summaries for insert to authenticated
with check (
  exists (
    select 1 from public.academy_learning_spaces ls
    where ls.id = learning_space_id
      and ls.student_id = student_id
      and ls.teacher_id = teacher_id
  )
  and (
    exists (
      select 1 from public.academy_teachers t
      where t.id = teacher_id and t.user_id = (select auth.uid())
    )
    or exists (
      select 1 from public.user_settings s
      where s.user_id = (select auth.uid()) and s.is_admin
    )
  )
);

drop policy if exists "academy summaries teacher admin update" on public.academy_session_summaries;
create policy "academy summaries teacher admin update"
on public.academy_session_summaries for update to authenticated
using (
  exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
)
with check (
  exists (
    select 1 from public.academy_learning_spaces ls
    where ls.id = learning_space_id
      and ls.student_id = student_id
      and ls.teacher_id = teacher_id
  )
  and (
    exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
    or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
  )
);

drop policy if exists "academy summaries teacher admin delete" on public.academy_session_summaries;
create policy "academy summaries teacher admin delete"
on public.academy_session_summaries for delete to authenticated
using (
  exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
);

-- ---------------------------------------------------------------------------
-- Tests/results. Students read; linked teachers/admins author results.
-- ---------------------------------------------------------------------------
create table if not exists public.academy_test_results (
  id uuid primary key default gen_random_uuid(),
  learning_space_id uuid not null references public.academy_learning_spaces(id) on delete cascade,
  teacher_id uuid not null references public.academy_teachers(id) on delete restrict,
  student_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  kind text not null default 'test' check (kind in ('quiz','test','placement','other')),
  score numeric(10,2),
  max_score numeric(10,2),
  percent numeric(6,2) generated always as (
    case when score is null or max_score is null or max_score = 0 then null
         else round((score / max_score) * 100, 2) end
  ) stored,
  teacher_summary text,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (score is null or score >= 0),
  check (max_score is null or max_score > 0)
);

create index if not exists academy_test_results_space_taken_idx
  on public.academy_test_results(learning_space_id, taken_at desc);

alter table public.academy_test_results enable row level security;
grant select, insert, update, delete on public.academy_test_results to authenticated;

drop policy if exists "academy tests members read" on public.academy_test_results;
create policy "academy tests members read"
on public.academy_test_results for select to authenticated
using (
  student_id = (select auth.uid())
  or exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
);

drop policy if exists "academy tests teacher admin insert" on public.academy_test_results;
create policy "academy tests teacher admin insert"
on public.academy_test_results for insert to authenticated
with check (
  exists (
    select 1 from public.academy_learning_spaces ls
    where ls.id = learning_space_id and ls.student_id = student_id and ls.teacher_id = teacher_id
  )
  and (
    exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
    or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
  )
);

drop policy if exists "academy tests teacher admin update" on public.academy_test_results;
create policy "academy tests teacher admin update"
on public.academy_test_results for update to authenticated
using (
  exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
)
with check (
  exists (
    select 1 from public.academy_learning_spaces ls
    where ls.id = learning_space_id and ls.student_id = student_id and ls.teacher_id = teacher_id
  )
);

drop policy if exists "academy tests teacher admin delete" on public.academy_test_results;
create policy "academy tests teacher admin delete"
on public.academy_test_results for delete to authenticated
using (
  exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
);

-- ---------------------------------------------------------------------------
-- Secure user lookup for Academy Admin Studio. Never expose auth.users broadly.
-- ---------------------------------------------------------------------------
create or replace function public.academy_admin_search_users(p_query text, p_limit integer default 12)
returns table (
  user_id uuid,
  email text,
  display_name text,
  teacher_id uuid,
  teacher_status text
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  ) then
    raise exception 'Admin permission required';
  end if;

  return query
  select u.id, u.email::text, s.display_name, t.id, t.status
  from auth.users u
  left join public.user_settings s on s.user_id = u.id
  left join public.academy_teachers t on t.user_id = u.id
  where length(trim(coalesce(p_query,''))) >= 2
    and (
      u.email ilike '%' || trim(p_query) || '%'
      or s.display_name ilike '%' || trim(p_query) || '%'
    )
  order by coalesce(s.display_name, u.email)
  limit least(greatest(coalesce(p_limit,12),1),25);
end;
$$;
revoke all on function public.academy_admin_search_users(text, integer) from public, anon;
grant execute on function public.academy_admin_search_users(text, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Rayan Control Center: read-only Academy inventory through existing hub token.
-- ---------------------------------------------------------------------------
create or replace function public.hub_academy_call(
  p_token text,
  p_op text,
  p_args jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ok boolean;
  q text := nullif(trim(coalesce(p_args->>'q','')), '');
  lim integer := least(greatest(coalesce((p_args->>'limit')::integer,100),1),500);
  r jsonb;
begin
  select encode(pg_catalog.sha256(convert_to(coalesce(p_token,''),'UTF8')), 'hex') = h.token_hash
    into ok from public.hub_access h where h.id = 1;
  if not coalesce(ok,false) then raise exception 'forbidden' using errcode='42501'; end if;

  if p_op = 'summary' then
    return jsonb_build_object(
      'users', (select count(*) from auth.users),
      'students', (select count(distinct e.student_id) from public.academy_enrollments e where e.status in ('interested','active','completed')),
      'teachers', (select count(*) from public.academy_teachers t where t.user_id is not null and t.status <> 'archived'),
      'courses', (select count(*) from public.academy_courses c where c.status <> 'archived'),
      'languages', (select count(distinct c.subject_code) from public.academy_courses c where c.status <> 'archived')
    );
  elsif p_op = 'users' then
    select jsonb_build_object(
      'items', coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb)
    ) into r
    from (
      select u.id, u.email, s.display_name as name, u.created_at, u.last_sign_in_at as last_active,
             t.id as teacher_id, t.status as teacher_status,
             (select count(*) from public.academy_enrollments e where e.student_id=u.id and e.status='active')::integer as active_courses
      from auth.users u
      left join public.user_settings s on s.user_id=u.id
      left join public.academy_teachers t on t.user_id=u.id
      where q is null or u.email ilike '%'||q||'%' or s.display_name ilike '%'||q||'%'
      order by u.created_at desc limit lim
    ) x;
    return r;
  elsif p_op = 'teachers' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.display_name),'[]'::jsonb)) into r
    from (
      select t.id,t.user_id,t.display_name,t.email,t.phone,t.status,t.teaching_languages,t.levels,
             coalesce((select jsonb_agg(tc.course_id) from public.academy_teacher_courses tc where tc.teacher_id=t.id),'[]'::jsonb) as course_ids,
             (select count(*) from public.academy_learning_spaces ls where ls.teacher_id=t.id)::integer as students
      from public.academy_teachers t
      where t.status <> 'archived'
    ) x;
    return r;
  elsif p_op = 'courses' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.sort_order,x.subject_code,x.level_code),'[]'::jsonb)) into r
    from (
      select c.id,c.subject_code,c.level_code,c.title_i18n,c.status,c.price_sek,c.duration_minutes,c.sort_order
      from public.academy_courses c
      where c.status <> 'archived'
    ) x;
    return r;
  elsif p_op = 'languages' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.code),'[]'::jsonb)) into r
    from (
      select c.subject_code as code,count(*)::integer as courses
      from public.academy_courses c where c.status <> 'archived'
      group by c.subject_code
    ) x;
    return r;
  else
    raise exception 'unknown academy op %', p_op;
  end if;
end;
$$;
revoke all on function public.hub_academy_call(text,text,jsonb) from public, authenticated;
grant execute on function public.hub_academy_call(text,text,jsonb) to anon;

-- ---------------------------------------------------------------------------
-- Rayan Control Center Academy management. Token-guarded and explicit actions.
-- Teacher role is an admin assignment: linking academy_teachers.user_id.
-- Revoking preserves historical teacher rows while removing account access.
-- ---------------------------------------------------------------------------
create or replace function public.hub_academy_manage(
  p_token text,
  p_action text,
  p_args jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ok boolean;
  uid uuid;
  tid uuid;
  cid uuid;
  label text;
begin
  select encode(pg_catalog.sha256(convert_to(coalesce(p_token,''),'UTF8')), 'hex') = h.token_hash
    into ok from public.hub_access h where h.id = 1;
  if not coalesce(ok,false) then raise exception 'forbidden' using errcode='42501'; end if;

  if p_action = 'assign_teacher' then
    uid := nullif(p_args->>'user_id','')::uuid;
    if not exists (select 1 from auth.users u where u.id=uid) then raise exception 'user_not_found'; end if;
    label := nullif(trim(coalesce(p_args->>'display_name','')), '');
    if label is null then
      select coalesce(s.display_name,split_part(u.email,'@',1),'Teacher') into label
      from auth.users u left join public.user_settings s on s.user_id=u.id where u.id=uid;
    end if;
    select t.id into tid from public.academy_teachers t where t.user_id=uid;
    if tid is null then
      insert into public.academy_teachers(user_id,display_name,email,status)
      select u.id,label,u.email,'draft' from auth.users u where u.id=uid
      returning id into tid;
    end if;
    return jsonb_build_object('ok',true,'teacher_id',tid,'status','draft');

  elsif p_action = 'revoke_teacher' then
    tid := nullif(p_args->>'teacher_id','')::uuid;
    update public.academy_teachers
      set user_id=null,status='archived',updated_at=now()
      where id=tid;
    if not found then raise exception 'teacher_not_found'; end if;
    return jsonb_build_object('ok',true);

  elsif p_action = 'set_teacher_status' then
    tid := nullif(p_args->>'teacher_id','')::uuid;
    if coalesce(p_args->>'status','') not in ('draft','active','archived') then raise exception 'bad_status'; end if;
    update public.academy_teachers set status=p_args->>'status',updated_at=now() where id=tid;
    if not found then raise exception 'teacher_not_found'; end if;
    return jsonb_build_object('ok',true);

  elsif p_action = 'assign_teacher_course' then
    tid := nullif(p_args->>'teacher_id','')::uuid;
    cid := nullif(p_args->>'course_id','')::uuid;
    insert into public.academy_teacher_courses(teacher_id,course_id) values(tid,cid)
      on conflict do nothing;
    return jsonb_build_object('ok',true);

  elsif p_action = 'remove_teacher_course' then
    tid := nullif(p_args->>'teacher_id','')::uuid;
    cid := nullif(p_args->>'course_id','')::uuid;
    delete from public.academy_teacher_courses where teacher_id=tid and course_id=cid;
    return jsonb_build_object('ok',true);
  else
    raise exception 'unsupported_academy_action';
  end if;
end;
$$;
revoke all on function public.hub_academy_manage(text,text,jsonb) from public, authenticated;
grant execute on function public.hub_academy_manage(text,text,jsonb) to anon;

notify pgrst, 'reload schema';
