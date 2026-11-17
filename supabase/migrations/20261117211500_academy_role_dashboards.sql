-- Academy role dashboards, test-result history, secure admin lookup and Control Center connector.
-- Prepared for a future database release. Do not apply automatically with the UI branch.

alter table public.academy_resources drop constraint if exists academy_resources_kind_check;
alter table public.academy_resources add constraint academy_resources_kind_check
  check (kind in ('material','homework','lesson_note','grammar','link'));

-- Extend teacher-authored Learning Space content without creating parallel tables.
-- Homework keeps the existing submission/feedback workflow; lesson/grammar/link are read-only course resources.
alter table public.academy_resources
  drop constraint if exists academy_resources_kind_check;
alter table public.academy_resources
  add constraint academy_resources_kind_check
  check (kind in ('material','homework','lesson','grammar','link'));

-- Managed language catalogue. Courses keep subject_code for backwards compatibility.
create table if not exists public.academy_languages (
  code text primary key check (code ~ '^[a-z][a-z0-9_-]{1,15}
  id uuid primary key default gen_random_uuid(),
  learning_space_id uuid not null references public.academy_learning_spaces(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid references public.academy_teachers(id) on delete set null,
  title text not null check (char_length(title) between 1 and 240),
  score numeric,
  max_score numeric,
  percent numeric generated always as (
    case when max_score is not null and max_score > 0 and score is not null
      then round((score * 100.0 / max_score)::numeric, 2)
      else null end
  ) stored,
  teacher_summary text,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists academy_test_results_space_taken_idx
  on public.academy_test_results(learning_space_id, taken_at desc);
create index if not exists academy_test_results_student_idx
  on public.academy_test_results(student_id, taken_at desc);
alter table public.academy_test_results enable row level security;
grant select on public.academy_test_results to authenticated;
grant insert, update, delete on public.academy_test_results to authenticated;

drop policy if exists "academy test results members read" on public.academy_test_results;
create policy "academy test results members read" on public.academy_test_results
for select to authenticated using (
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

drop policy if exists "academy test results teacher admin write" on public.academy_test_results;
create policy "academy test results teacher admin write" on public.academy_test_results
for all to authenticated
using (
  exists (
    select 1
    from public.academy_learning_spaces ls
    join public.academy_teachers t on t.id=ls.teacher_id
    where ls.id=learning_space_id and ls.student_id=student_id and ls.teacher_id=teacher_id
      and t.user_id=(select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
)
with check (
  exists (
    select 1
    from public.academy_learning_spaces ls
    join public.academy_teachers t on t.id=ls.teacher_id
    where ls.id=learning_space_id and ls.student_id=student_id and ls.teacher_id=teacher_id
      and t.user_id=(select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
);

create or replace function public.academy_admin_search_users(p_query text, p_limit integer default 12)
returns table(user_id uuid, email text, display_name text, teacher_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(trim(coalesce(p_query,'')), '');
  v_limit integer := least(greatest(coalesce(p_limit,12),1),25);
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  ) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if v_query is null or char_length(v_query) < 2 then return; end if;

  return query
  select u.id, u.email::text, s.display_name::text, t.id
  from auth.users u
  left join public.user_settings s on s.user_id=u.id
  left join public.academy_teachers t on t.user_id=u.id and t.status <> 'archived'
  where u.email ilike '%'||v_query||'%'
     or coalesce(s.display_name,'') ilike '%'||v_query||'%'
  order by coalesce(s.display_name,u.email,'')
  limit v_limit;
end
$$;
revoke all on function public.academy_admin_search_users(text,integer) from public, anon;
grant execute on function public.academy_admin_search_users(text,integer) to authenticated;

-- Separate hub RPC keeps the generic hub_call contract stable.
create or replace function public.hub_academy_call(p_token text, p_op text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ok boolean;
  q text := nullif(trim(coalesce(p_args->>'q','')), '');
  lim int := least(greatest(coalesce((p_args->>'limit')::int,100),1),500);
  r jsonb;
begin
  select encode(pg_catalog.sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex')=h.token_hash
    into ok from public.hub_access h where h.id=1;
  if not coalesce(ok,false) then raise exception 'forbidden' using errcode='42501'; end if;

  if p_op='academy-overview' then
    return jsonb_build_object(
      'users',(select count(*) from auth.users),
      'teachers',(select count(*) from public.academy_teachers where status<>'archived' and user_id is not null),
      'students',(select count(distinct student_id) from public.academy_enrollments where status in ('interested','active')),
      'active_enrollments',(select count(*) from public.academy_enrollments where status='active'),
      'courses',(select count(*) from public.academy_courses where status='active'),
      'languages',(select count(distinct subject_code) from public.academy_courses where status='active')
    );
  elsif p_op='academy-users' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb)) into r
    from (
      select u.id as user_id,u.email,s.display_name,u.created_at,
             case when t.id is not null then 'teacher' else 'student' end as academy_role,
             t.id as teacher_id,t.status as teacher_status
      from auth.users u
      left join public.user_settings s on s.user_id=u.id
      left join public.academy_teachers t on t.user_id=u.id and t.status<>'archived'
      where q is null or u.email ilike '%'||q||'%' or coalesce(s.display_name,'') ilike '%'||q||'%'
      order by u.created_at desc limit lim
    ) x;
    return r;
  elsif p_op='academy-teachers' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.display_name),'[]'::jsonb)) into r
    from (
      select t.id,t.user_id,t.display_name,t.email,t.phone,t.teaching_languages,t.levels,t.status,
             (select count(*) from public.academy_learning_spaces ls where ls.teacher_id=t.id) as students,
             (select count(*) from public.academy_teacher_courses tc where tc.teacher_id=t.id) as courses,
             coalesce((select jsonb_agg(tc.course_id) from public.academy_teacher_courses tc where tc.teacher_id=t.id),'[]'::jsonb) as course_ids
      from public.academy_teachers t where t.status<>'archived'
    ) x; return r;
  elsif p_op='academy-courses' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.sort_order,x.subject_code,x.level_code),'[]'::jsonb)) into r
    from (
      select c.id,c.subject_code,c.level_code,c.title_i18n,c.status,c.sort_order,c.price_sek,c.duration_minutes,
             (select count(*) from public.academy_enrollments e where e.course_id=c.id and e.status='active') as students
      from public.academy_courses c where c.status<>'archived'
    ) x; return r;
  elsif p_op='academy-languages' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.sort_order,x.code),'[]'::jsonb)) into r
    from (
      select l.code,l.name_i18n,l.status,l.sort_order,
             (select count(*) from public.academy_courses c where c.subject_code=l.code and c.status<>'archived') as courses
      from public.academy_languages l
    ) x; return r;
  else
    raise exception 'unknown academy op %',p_op;
  end if;
end
$$;
revoke all on function public.hub_academy_call(text,text,jsonb) from public, authenticated;
grant execute on function public.hub_academy_call(text,text,jsonb) to anon;

create or replace function public.hub_academy_manage(
  p_token text, p_action text, p_user_id uuid, p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ok boolean;
  u_email text;
  u_name text;
  tid uuid;
begin
  select encode(pg_catalog.sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex')=h.token_hash
    into ok from public.hub_access h where h.id=1;
  if not coalesce(ok,false) then raise exception 'forbidden' using errcode='42501'; end if;

  select u.email,s.display_name into u_email,u_name
  from auth.users u left join public.user_settings s on s.user_id=u.id
  where u.id=p_user_id;
  if u_email is null then raise exception 'user_not_found'; end if;

  if p_action='make_teacher' then
    select id into tid from public.academy_teachers where user_id=p_user_id;
    if tid is null then
      insert into public.academy_teachers(user_id,display_name,email,status,teaching_languages,levels)
      values(
        p_user_id,
        coalesce(nullif(trim(p_payload->>'display_name'),''),u_name,split_part(u_email,'@',1)),
        u_email,
        'draft',
        coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'teaching_languages','[]'::jsonb))),'{}'::text[]),
        coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'levels','[]'::jsonb))),'{}'::text[])
      ) returning id into tid;
    else
      update public.academy_teachers set status=case when status='archived' then 'draft' else status end,updated_at=now() where id=tid;
    end if;
    insert into public.hub_audit(action,target,detail) values('academy.make_teacher',p_user_id,jsonb_build_object('teacher_id',tid,'email',u_email));
    return jsonb_build_object('ok',true,'role','teacher','teacher_id',tid);
  elsif p_action='make_student' then
    update public.academy_teachers set user_id=null,status='archived',updated_at=now() where user_id=p_user_id returning id into tid;
    insert into public.hub_audit(action,target,detail) values('academy.make_student',p_user_id,jsonb_build_object('teacher_id',tid,'email',u_email));
    return jsonb_build_object('ok',true,'role','student');
  elsif p_action='set_teacher_status' then
    tid := nullif(p_payload->>'teacher_id','')::uuid;
    if coalesce(p_payload->>'status','') not in ('draft','active','archived') then raise exception 'bad_status'; end if;
    update public.academy_teachers set status=p_payload->>'status',updated_at=now() where id=tid;
    if not found then raise exception 'teacher_not_found'; end if;
    return jsonb_build_object('ok',true);

  elsif p_action='assign_teacher_course' then
    tid := nullif(p_payload->>'teacher_id','')::uuid;
    insert into public.academy_teacher_courses(teacher_id,course_id)
      values(tid,(p_payload->>'course_id')::uuid) on conflict do nothing;
    return jsonb_build_object('ok',true);

  elsif p_action='remove_teacher_course' then
    tid := nullif(p_payload->>'teacher_id','')::uuid;
    delete from public.academy_teacher_courses where teacher_id=tid and course_id=(p_payload->>'course_id')::uuid;
    return jsonb_build_object('ok',true);

  elsif p_action='upsert_language' then
    if coalesce(p_payload->>'code','') !~ '^[a-z][a-z0-9_-]{1,15}
revoke all on function public.hub_academy_manage(text,text,uuid,jsonb) from public, authenticated;
grant execute on function public.hub_academy_manage(text,text,uuid,jsonb) to anon;

notify pgrst,'reload schema';
),
  name_i18n jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.academy_languages(code,name_i18n,sort_order) values
 ('sv','{"en":"Swedish","sv":"Svenska","de":"Schwedisch","fa":"سوئدی"}'::jsonb,10),
 ('en','{"en":"English","sv":"Engelska","de":"Englisch","fa":"انگلیسی"}'::jsonb,20),
 ('de','{"en":"German","sv":"Tyska","de":"Deutsch","fa":"آلمانی"}'::jsonb,30),
 ('fa','{"en":"Persian","sv":"Persiska","de":"Persisch","fa":"فارسی"}'::jsonb,40)
on conflict (code) do nothing;
alter table public.academy_languages enable row level security;
grant select on public.academy_languages to anon, authenticated;
grant insert, update, delete on public.academy_languages to authenticated;
create policy "academy languages public active" on public.academy_languages
for select to anon, authenticated using (
 status='active' or exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin)
);
create policy "academy languages admin write" on public.academy_languages
for all to authenticated
using (exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin))
with check (exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin));

-- Structured teacher session summaries shown to the student and teacher.
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
create index if not exists academy_session_summaries_space_created_idx on public.academy_session_summaries(learning_space_id,created_at desc);
alter table public.academy_session_summaries enable row level security;
grant select,insert,update,delete on public.academy_session_summaries to authenticated;
create policy "academy summaries members read" on public.academy_session_summaries
for select to authenticated using (
 student_id=(select auth.uid())
 or exists(select 1 from public.academy_teachers t where t.id=teacher_id and t.user_id=(select auth.uid()))
 or exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin)
);
create policy "academy summaries teacher admin write" on public.academy_session_summaries
for all to authenticated
using (
 exists(select 1 from public.academy_teachers t where t.id=teacher_id and t.user_id=(select auth.uid()))
 or exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin)
)
with check (
 exists(select 1 from public.academy_learning_spaces ls where ls.id=learning_space_id and ls.student_id=student_id and ls.teacher_id=teacher_id)
 and (
  exists(select 1 from public.academy_teachers t where t.id=teacher_id and t.user_id=(select auth.uid()))
  or exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin)
 )
);

create table if not exists public.academy_test_results (
  id uuid primary key default gen_random_uuid(),
  learning_space_id uuid not null references public.academy_learning_spaces(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid references public.academy_teachers(id) on delete set null,
  title text not null check (char_length(title) between 1 and 240),
  score numeric,
  max_score numeric,
  percent numeric generated always as (
    case when max_score is not null and max_score > 0 and score is not null
      then round((score * 100.0 / max_score)::numeric, 2)
      else null end
  ) stored,
  teacher_summary text,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists academy_test_results_space_taken_idx
  on public.academy_test_results(learning_space_id, taken_at desc);
create index if not exists academy_test_results_student_idx
  on public.academy_test_results(student_id, taken_at desc);
alter table public.academy_test_results enable row level security;
grant select on public.academy_test_results to authenticated;
grant insert, update, delete on public.academy_test_results to authenticated;

drop policy if exists "academy test results members read" on public.academy_test_results;
create policy "academy test results members read" on public.academy_test_results
for select to authenticated using (
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

drop policy if exists "academy test results teacher admin write" on public.academy_test_results;
create policy "academy test results teacher admin write" on public.academy_test_results
for all to authenticated
using (
  exists (
    select 1
    from public.academy_learning_spaces ls
    join public.academy_teachers t on t.id=ls.teacher_id
    where ls.id=learning_space_id and ls.student_id=student_id and ls.teacher_id=teacher_id
      and t.user_id=(select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
)
with check (
  exists (
    select 1
    from public.academy_learning_spaces ls
    join public.academy_teachers t on t.id=ls.teacher_id
    where ls.id=learning_space_id and ls.student_id=student_id and ls.teacher_id=teacher_id
      and t.user_id=(select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
);

create or replace function public.academy_admin_search_users(p_query text, p_limit integer default 12)
returns table(user_id uuid, email text, display_name text, teacher_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(trim(coalesce(p_query,'')), '');
  v_limit integer := least(greatest(coalesce(p_limit,12),1),25);
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  ) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if v_query is null or char_length(v_query) < 2 then return; end if;

  return query
  select u.id, u.email::text, s.display_name::text, t.id
  from auth.users u
  left join public.user_settings s on s.user_id=u.id
  left join public.academy_teachers t on t.user_id=u.id and t.status <> 'archived'
  where u.email ilike '%'||v_query||'%'
     or coalesce(s.display_name,'') ilike '%'||v_query||'%'
  order by coalesce(s.display_name,u.email,'')
  limit v_limit;
end
$$;
revoke all on function public.academy_admin_search_users(text,integer) from public, anon;
grant execute on function public.academy_admin_search_users(text,integer) to authenticated;

-- Separate hub RPC keeps the generic hub_call contract stable.
create or replace function public.hub_academy_call(p_token text, p_op text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ok boolean;
  q text := nullif(trim(coalesce(p_args->>'q','')), '');
  lim int := least(greatest(coalesce((p_args->>'limit')::int,100),1),500);
  r jsonb;
begin
  select encode(pg_catalog.sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex')=h.token_hash
    into ok from public.hub_access h where h.id=1;
  if not coalesce(ok,false) then raise exception 'forbidden' using errcode='42501'; end if;

  if p_op='academy-overview' then
    return jsonb_build_object(
      'users',(select count(*) from auth.users),
      'teachers',(select count(*) from public.academy_teachers where status<>'archived' and user_id is not null),
      'students',(select count(distinct student_id) from public.academy_enrollments where status in ('interested','active')),
      'active_enrollments',(select count(*) from public.academy_enrollments where status='active'),
      'courses',(select count(*) from public.academy_courses where status='active'),
      'languages',(select count(distinct subject_code) from public.academy_courses where status='active')
    );
  elsif p_op='academy-users' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb)) into r
    from (
      select u.id as user_id,u.email,s.display_name,u.created_at,
             case when t.id is not null then 'teacher' else 'student' end as academy_role,
             t.id as teacher_id,t.status as teacher_status
      from auth.users u
      left join public.user_settings s on s.user_id=u.id
      left join public.academy_teachers t on t.user_id=u.id and t.status<>'archived'
      where q is null or u.email ilike '%'||q||'%' or coalesce(s.display_name,'') ilike '%'||q||'%'
      order by u.created_at desc limit lim
    ) x;
    return r;
  elsif p_op='academy-teachers' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.display_name),'[]'::jsonb)) into r
    from (
      select t.id,t.user_id,t.display_name,t.email,t.phone,t.teaching_languages,t.levels,t.status,
             (select count(*) from public.academy_learning_spaces ls where ls.teacher_id=t.id) as students,
             (select count(*) from public.academy_teacher_courses tc where tc.teacher_id=t.id) as courses
      from public.academy_teachers t where t.status<>'archived'
    ) x; return r;
  elsif p_op='academy-courses' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.sort_order,x.subject_code,x.level_code),'[]'::jsonb)) into r
    from (
      select c.id,c.subject_code,c.level_code,c.title_i18n,c.status,c.sort_order,
             (select count(*) from public.academy_enrollments e where e.course_id=c.id and e.status='active') as students
      from public.academy_courses c where c.status<>'archived'
    ) x; return r;
  elsif p_op='academy-languages' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.subject_code),'[]'::jsonb)) into r
    from (
      select c.subject_code,count(*) as courses,
             count(*) filter(where c.status='active') as active_courses
      from public.academy_courses c group by c.subject_code
    ) x; return r;
  else
    raise exception 'unknown academy op %',p_op;
  end if;
end
$$;
revoke all on function public.hub_academy_call(text,text,jsonb) from public, authenticated;
grant execute on function public.hub_academy_call(text,text,jsonb) to anon;

create or replace function public.hub_academy_manage(
  p_token text, p_action text, p_user_id uuid, p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ok boolean;
  u_email text;
  u_name text;
  tid uuid;
begin
  select encode(pg_catalog.sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex')=h.token_hash
    into ok from public.hub_access h where h.id=1;
  if not coalesce(ok,false) then raise exception 'forbidden' using errcode='42501'; end if;

  select u.email,s.display_name into u_email,u_name
  from auth.users u left join public.user_settings s on s.user_id=u.id
  where u.id=p_user_id;
  if u_email is null then raise exception 'user_not_found'; end if;

  if p_action='make_teacher' then
    select id into tid from public.academy_teachers where user_id=p_user_id;
    if tid is null then
      insert into public.academy_teachers(user_id,display_name,email,status,teaching_languages,levels)
      values(
        p_user_id,
        coalesce(nullif(trim(p_payload->>'display_name'),''),u_name,split_part(u_email,'@',1)),
        u_email,
        'draft',
        coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'teaching_languages','[]'::jsonb))),'{}'::text[]),
        coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'levels','[]'::jsonb))),'{}'::text[])
      ) returning id into tid;
    else
      update public.academy_teachers set status=case when status='archived' then 'draft' else status end,updated_at=now() where id=tid;
    end if;
    insert into public.hub_audit(action,target,detail) values('academy.make_teacher',p_user_id,jsonb_build_object('teacher_id',tid,'email',u_email));
    return jsonb_build_object('ok',true,'role','teacher','teacher_id',tid);
  elsif p_action='make_student' then
    update public.academy_teachers set user_id=null,status='archived',updated_at=now() where user_id=p_user_id returning id into tid;
    insert into public.hub_audit(action,target,detail) values('academy.make_student',p_user_id,jsonb_build_object('teacher_id',tid,'email',u_email));
    return jsonb_build_object('ok',true,'role','student');
  else
    raise exception 'unsupported_action';
  end if;
end
$$;
revoke all on function public.hub_academy_manage(text,text,uuid,jsonb) from public, authenticated;
grant execute on function public.hub_academy_manage(text,text,uuid,jsonb) to anon;

notify pgrst,'reload schema';
 then raise exception 'bad_language_code'; end if;
    if coalesce(p_payload->>'status','active') not in ('active','archived') then raise exception 'bad_status'; end if;
    insert into public.academy_languages(code,name_i18n,status,sort_order,updated_at)
    values(
      p_payload->>'code',coalesce(p_payload->'name_i18n','{}'::jsonb),coalesce(p_payload->>'status','active'),
      coalesce((p_payload->>'sort_order')::integer,0),now()
    )
    on conflict(code) do update set name_i18n=excluded.name_i18n,status=excluded.status,sort_order=excluded.sort_order,updated_at=now();
    return jsonb_build_object('ok',true);

  elsif p_action='upsert_course' then
    if not exists(select 1 from public.academy_languages l where l.code=p_payload->>'subject_code') then raise exception 'unknown_language'; end if;
    if coalesce(p_payload->>'status','draft') not in ('draft','active','archived') then raise exception 'bad_status'; end if;
    if nullif(p_payload->>'course_id','') is null then
      insert into public.academy_courses(subject_code,level_code,title_i18n,delivery_modes,price_sek,duration_minutes,status,sort_order)
      values(
        p_payload->>'subject_code',upper(coalesce(p_payload->>'level_code','A1')),coalesce(p_payload->'title_i18n','{}'::jsonb),
        array['individual_online']::text[],nullif(p_payload->>'price_sek','')::numeric,
        coalesce((p_payload->>'duration_minutes')::integer,60),coalesce(p_payload->>'status','draft'),coalesce((p_payload->>'sort_order')::integer,0)
      ) returning id into tid;
    else
      update public.academy_courses set
        subject_code=p_payload->>'subject_code',level_code=upper(coalesce(p_payload->>'level_code',level_code)),
        title_i18n=coalesce(p_payload->'title_i18n',title_i18n),
        price_sek=case when p_payload ? 'price_sek' then nullif(p_payload->>'price_sek','')::numeric else price_sek end,
        duration_minutes=coalesce((p_payload->>'duration_minutes')::integer,duration_minutes),
        status=coalesce(p_payload->>'status',status),sort_order=coalesce((p_payload->>'sort_order')::integer,sort_order),updated_at=now()
      where id=(p_payload->>'course_id')::uuid;
      if not found then raise exception 'course_not_found'; end if;
      tid := (p_payload->>'course_id')::uuid;
    end if;
    return jsonb_build_object('ok',true,'course_id',tid);

  else
    raise exception 'unsupported_action';
  end if;
end
$;
revoke all on function public.hub_academy_manage(text,text,uuid,jsonb) from public, authenticated;
grant execute on function public.hub_academy_manage(text,text,uuid,jsonb) to anon;

notify pgrst,'reload schema';
),
  name_i18n jsonb not null default '{}'::jsonb,
  status text not null default 'active' check (status in ('active','archived')),
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
insert into public.academy_languages(code,name_i18n,sort_order) values
 ('sv','{"en":"Swedish","sv":"Svenska","de":"Schwedisch","fa":"سوئدی"}'::jsonb,10),
 ('en','{"en":"English","sv":"Engelska","de":"Englisch","fa":"انگلیسی"}'::jsonb,20),
 ('de','{"en":"German","sv":"Tyska","de":"Deutsch","fa":"آلمانی"}'::jsonb,30),
 ('fa','{"en":"Persian","sv":"Persiska","de":"Persisch","fa":"فارسی"}'::jsonb,40)
on conflict (code) do nothing;
alter table public.academy_languages enable row level security;
grant select on public.academy_languages to anon, authenticated;
grant insert, update, delete on public.academy_languages to authenticated;
create policy "academy languages public active" on public.academy_languages
for select to anon, authenticated using (
 status='active' or exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin)
);
create policy "academy languages admin write" on public.academy_languages
for all to authenticated
using (exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin))
with check (exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin));

-- Structured teacher session summaries shown to the student and teacher.
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
create index if not exists academy_session_summaries_space_created_idx on public.academy_session_summaries(learning_space_id,created_at desc);
create unique index if not exists academy_session_summaries_booking_uidx on public.academy_session_summaries(booking_id) where booking_id is not null;
alter table public.academy_session_summaries enable row level security;
grant select,insert,update,delete on public.academy_session_summaries to authenticated;
create policy "academy summaries members read" on public.academy_session_summaries
for select to authenticated using (
 student_id=(select auth.uid())
 or exists(select 1 from public.academy_teachers t where t.id=teacher_id and t.user_id=(select auth.uid()))
 or exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin)
);
create policy "academy summaries teacher admin write" on public.academy_session_summaries
for all to authenticated
using (
 exists(select 1 from public.academy_teachers t where t.id=teacher_id and t.user_id=(select auth.uid()))
 or exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin)
)
with check (
 exists(select 1 from public.academy_learning_spaces ls where ls.id=learning_space_id and ls.student_id=student_id and ls.teacher_id=teacher_id)
 and (
  exists(select 1 from public.academy_teachers t where t.id=teacher_id and t.user_id=(select auth.uid()))
  or exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin)
 )
);

create table if not exists public.academy_test_results (
  id uuid primary key default gen_random_uuid(),
  learning_space_id uuid not null references public.academy_learning_spaces(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid references public.academy_teachers(id) on delete set null,
  title text not null check (char_length(title) between 1 and 240),
  score numeric,
  max_score numeric,
  percent numeric generated always as (
    case when max_score is not null and max_score > 0 and score is not null
      then round((score * 100.0 / max_score)::numeric, 2)
      else null end
  ) stored,
  teacher_summary text,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists academy_test_results_space_taken_idx
  on public.academy_test_results(learning_space_id, taken_at desc);
create index if not exists academy_test_results_student_idx
  on public.academy_test_results(student_id, taken_at desc);
alter table public.academy_test_results enable row level security;
grant select on public.academy_test_results to authenticated;
grant insert, update, delete on public.academy_test_results to authenticated;

drop policy if exists "academy test results members read" on public.academy_test_results;
create policy "academy test results members read" on public.academy_test_results
for select to authenticated using (
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

drop policy if exists "academy test results teacher admin write" on public.academy_test_results;
create policy "academy test results teacher admin write" on public.academy_test_results
for all to authenticated
using (
  exists (
    select 1
    from public.academy_learning_spaces ls
    join public.academy_teachers t on t.id=ls.teacher_id
    where ls.id=learning_space_id and ls.student_id=student_id and ls.teacher_id=teacher_id
      and t.user_id=(select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
)
with check (
  exists (
    select 1
    from public.academy_learning_spaces ls
    join public.academy_teachers t on t.id=ls.teacher_id
    where ls.id=learning_space_id and ls.student_id=student_id and ls.teacher_id=teacher_id
      and t.user_id=(select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
);

create or replace function public.academy_admin_search_users(p_query text, p_limit integer default 12)
returns table(user_id uuid, email text, display_name text, teacher_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_query text := nullif(trim(coalesce(p_query,'')), '');
  v_limit integer := least(greatest(coalesce(p_limit,12),1),25);
begin
  if (select auth.uid()) is null or not exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  ) then
    raise exception 'forbidden' using errcode='42501';
  end if;
  if v_query is null or char_length(v_query) < 2 then return; end if;

  return query
  select u.id, u.email::text, s.display_name::text, t.id
  from auth.users u
  left join public.user_settings s on s.user_id=u.id
  left join public.academy_teachers t on t.user_id=u.id and t.status <> 'archived'
  where u.email ilike '%'||v_query||'%'
     or coalesce(s.display_name,'') ilike '%'||v_query||'%'
  order by coalesce(s.display_name,u.email,'')
  limit v_limit;
end
$$;
revoke all on function public.academy_admin_search_users(text,integer) from public, anon;
grant execute on function public.academy_admin_search_users(text,integer) to authenticated;

-- Separate hub RPC keeps the generic hub_call contract stable.
create or replace function public.hub_academy_call(p_token text, p_op text, p_args jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ok boolean;
  q text := nullif(trim(coalesce(p_args->>'q','')), '');
  lim int := least(greatest(coalesce((p_args->>'limit')::int,100),1),500);
  r jsonb;
begin
  select encode(pg_catalog.sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex')=h.token_hash
    into ok from public.hub_access h where h.id=1;
  if not coalesce(ok,false) then raise exception 'forbidden' using errcode='42501'; end if;

  if p_op='academy-overview' then
    return jsonb_build_object(
      'users',(select count(*) from auth.users),
      'teachers',(select count(*) from public.academy_teachers where status<>'archived' and user_id is not null),
      'students',(select count(distinct student_id) from public.academy_enrollments where status in ('interested','active')),
      'active_enrollments',(select count(*) from public.academy_enrollments where status='active'),
      'courses',(select count(*) from public.academy_courses where status='active'),
      'languages',(select count(distinct subject_code) from public.academy_courses where status='active')
    );
  elsif p_op='academy-users' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb)) into r
    from (
      select u.id as user_id,u.email,s.display_name,u.created_at,
             case when t.id is not null then 'teacher' else 'student' end as academy_role,
             t.id as teacher_id,t.status as teacher_status
      from auth.users u
      left join public.user_settings s on s.user_id=u.id
      left join public.academy_teachers t on t.user_id=u.id and t.status<>'archived'
      where q is null or u.email ilike '%'||q||'%' or coalesce(s.display_name,'') ilike '%'||q||'%'
      order by u.created_at desc limit lim
    ) x;
    return r;
  elsif p_op='academy-teachers' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.display_name),'[]'::jsonb)) into r
    from (
      select t.id,t.user_id,t.display_name,t.email,t.phone,t.teaching_languages,t.levels,t.status,
             (select count(*) from public.academy_learning_spaces ls where ls.teacher_id=t.id) as students,
             (select count(*) from public.academy_teacher_courses tc where tc.teacher_id=t.id) as courses
      from public.academy_teachers t where t.status<>'archived'
    ) x; return r;
  elsif p_op='academy-courses' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.sort_order,x.subject_code,x.level_code),'[]'::jsonb)) into r
    from (
      select c.id,c.subject_code,c.level_code,c.title_i18n,c.status,c.sort_order,
             (select count(*) from public.academy_enrollments e where e.course_id=c.id and e.status='active') as students
      from public.academy_courses c where c.status<>'archived'
    ) x; return r;
  elsif p_op='academy-languages' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.subject_code),'[]'::jsonb)) into r
    from (
      select c.subject_code,count(*) as courses,
             count(*) filter(where c.status='active') as active_courses
      from public.academy_courses c group by c.subject_code
    ) x; return r;
  else
    raise exception 'unknown academy op %',p_op;
  end if;
end
$$;
revoke all on function public.hub_academy_call(text,text,jsonb) from public, authenticated;
grant execute on function public.hub_academy_call(text,text,jsonb) to anon;

create or replace function public.hub_academy_manage(
  p_token text, p_action text, p_user_id uuid, p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ok boolean;
  u_email text;
  u_name text;
  tid uuid;
begin
  select encode(pg_catalog.sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex')=h.token_hash
    into ok from public.hub_access h where h.id=1;
  if not coalesce(ok,false) then raise exception 'forbidden' using errcode='42501'; end if;

  select u.email,s.display_name into u_email,u_name
  from auth.users u left join public.user_settings s on s.user_id=u.id
  where u.id=p_user_id;
  if u_email is null then raise exception 'user_not_found'; end if;

  if p_action='make_teacher' then
    select id into tid from public.academy_teachers where user_id=p_user_id;
    if tid is null then
      insert into public.academy_teachers(user_id,display_name,email,status,teaching_languages,levels)
      values(
        p_user_id,
        coalesce(nullif(trim(p_payload->>'display_name'),''),u_name,split_part(u_email,'@',1)),
        u_email,
        'draft',
        coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'teaching_languages','[]'::jsonb))),'{}'::text[]),
        coalesce(array(select jsonb_array_elements_text(coalesce(p_payload->'levels','[]'::jsonb))),'{}'::text[])
      ) returning id into tid;
    else
      update public.academy_teachers set status=case when status='archived' then 'draft' else status end,updated_at=now() where id=tid;
    end if;
    insert into public.hub_audit(action,target,detail) values('academy.make_teacher',p_user_id,jsonb_build_object('teacher_id',tid,'email',u_email));
    return jsonb_build_object('ok',true,'role','teacher','teacher_id',tid);
  elsif p_action='make_student' then
    update public.academy_teachers set user_id=null,status='archived',updated_at=now() where user_id=p_user_id returning id into tid;
    insert into public.hub_audit(action,target,detail) values('academy.make_student',p_user_id,jsonb_build_object('teacher_id',tid,'email',u_email));
    return jsonb_build_object('ok',true,'role','student');
  else
    raise exception 'unsupported_action';
  end if;
end
$$;
revoke all on function public.hub_academy_manage(text,text,uuid,jsonb) from public, authenticated;
grant execute on function public.hub_academy_manage(text,text,uuid,jsonb) to anon;

notify pgrst,'reload schema';
