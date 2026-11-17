-- Lingo3 Academy role dashboards, structured learning history, and Control Center connector.
-- Repository-staged migration only. Do NOT apply to production until the coordinated Academy release is approved.
-- This file is intentionally additive except for expanding the existing academy_resources.kind check.

-- ---------------------------------------------------------------------------
-- Managed Academy language catalogue
-- ---------------------------------------------------------------------------
create table if not exists public.academy_languages (
  code text primary key check (code ~ '^[a-z][a-z0-9_-]{1,15}$'),
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

-- Preserve any pre-existing course subject codes that are not in the starter catalogue.
insert into public.academy_languages(code,name_i18n,sort_order)
select distinct c.subject_code, jsonb_build_object('en',upper(c.subject_code)), 100
from public.academy_courses c
where c.subject_code ~ '^[a-z][a-z0-9_-]{1,15}$'
on conflict (code) do nothing;

alter table public.academy_languages enable row level security;
grant select on public.academy_languages to anon, authenticated;
grant insert, update, delete on public.academy_languages to authenticated;

drop policy if exists "academy languages public active" on public.academy_languages;
create policy "academy languages public active"
on public.academy_languages for select to anon, authenticated
using (
  status='active'
  or exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
);

drop policy if exists "academy languages admin write" on public.academy_languages;
create policy "academy languages admin write"
on public.academy_languages for all to authenticated
using (
  exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
)
with check (
  exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
);

-- ---------------------------------------------------------------------------
-- Teacher-authored Learning Space content types
-- ---------------------------------------------------------------------------
alter table public.academy_resources
  drop constraint if exists academy_resources_kind_check;
alter table public.academy_resources
  add constraint academy_resources_kind_check
  check (kind in ('material','homework','lesson','grammar','link'));

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
  on public.academy_session_summaries(learning_space_id,created_at desc);
create unique index if not exists academy_session_summaries_booking_uidx
  on public.academy_session_summaries(booking_id)
  where booking_id is not null;

alter table public.academy_session_summaries enable row level security;
grant select,insert,update,delete on public.academy_session_summaries to authenticated;

drop policy if exists "academy summaries members read" on public.academy_session_summaries;
create policy "academy summaries members read"
on public.academy_session_summaries for select to authenticated
using (
  student_id=(select auth.uid())
  or exists (
    select 1 from public.academy_teachers t
    where t.id=teacher_id and t.user_id=(select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
);

drop policy if exists "academy summaries teacher admin write" on public.academy_session_summaries;
create policy "academy summaries teacher admin write"
on public.academy_session_summaries for all to authenticated
using (
  exists (
    select 1 from public.academy_teachers t
    where t.id=teacher_id and t.user_id=(select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
)
with check (
  exists (
    select 1 from public.academy_learning_spaces ls
    where ls.id=learning_space_id
      and ls.student_id=student_id
      and ls.teacher_id=teacher_id
  )
  and (
    exists (
      select 1 from public.academy_teachers t
      where t.id=teacher_id and t.user_id=(select auth.uid())
    )
    or exists (
      select 1 from public.user_settings s
      where s.user_id=(select auth.uid()) and s.is_admin
    )
  )
);

-- ---------------------------------------------------------------------------
-- Test / quiz result history
-- ---------------------------------------------------------------------------
create table if not exists public.academy_test_results (
  id uuid primary key default gen_random_uuid(),
  learning_space_id uuid not null references public.academy_learning_spaces(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid not null references public.academy_teachers(id) on delete restrict,
  title text not null check (char_length(title) between 1 and 240),
  kind text not null default 'test' check (kind in ('quiz','test','placement','other')),
  score numeric(10,2) check (score is null or score >= 0),
  max_score numeric(10,2) check (max_score is null or max_score > 0),
  percent numeric(6,2) generated always as (
    case when score is null or max_score is null or max_score=0 then null
         else round((score/max_score)*100,2) end
  ) stored,
  teacher_summary text,
  taken_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.academy_test_results
  add constraint academy_test_results_score_bounds_check
  check (score is null or max_score is null or score<=max_score);

create index if not exists academy_test_results_space_taken_idx
  on public.academy_test_results(learning_space_id,taken_at desc);
create index if not exists academy_test_results_student_taken_idx
  on public.academy_test_results(student_id,taken_at desc);

alter table public.academy_test_results enable row level security;
grant select,insert,update,delete on public.academy_test_results to authenticated;

drop policy if exists "academy test results members read" on public.academy_test_results;
create policy "academy test results members read"
on public.academy_test_results for select to authenticated
using (
  student_id=(select auth.uid())
  or exists (
    select 1 from public.academy_teachers t
    where t.id=teacher_id and t.user_id=(select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
);

drop policy if exists "academy test results teacher admin write" on public.academy_test_results;
create policy "academy test results teacher admin write"
on public.academy_test_results for all to authenticated
using (
  exists (
    select 1 from public.academy_teachers t
    where t.id=teacher_id and t.user_id=(select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id=(select auth.uid()) and s.is_admin
  )
)
with check (
  exists (
    select 1 from public.academy_learning_spaces ls
    where ls.id=learning_space_id
      and ls.student_id=student_id
      and ls.teacher_id=teacher_id
  )
  and (
    exists (
      select 1 from public.academy_teachers t
      where t.id=teacher_id and t.user_id=(select auth.uid())
    )
    or exists (
      select 1 from public.user_settings s
      where s.user_id=(select auth.uid()) and s.is_admin
    )
  )
);

-- ---------------------------------------------------------------------------
-- Privacy-safe teacher calendar for enrolled students.
-- It returns only Free/Busy, never another student's identity.
-- ---------------------------------------------------------------------------
create or replace function public.academy_teacher_calendar(
  p_teacher_id uuid,
  p_from timestamptz default now(),
  p_to timestamptz default now()+interval '60 days'
)
returns table(
  id uuid,
  teacher_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  delivery_mode text,
  status text
)
language sql
stable
security definer
set search_path=''
as $$
  select
    a.id,
    a.teacher_id,
    a.starts_at,
    a.ends_at,
    a.delivery_mode,
    case when a.status='available' then 'free' else 'busy' end::text
  from public.academy_availability a
  where a.teacher_id=p_teacher_id
    and a.status<>'cancelled'
    and a.ends_at>=greatest(coalesce(p_from,now()),now())
    and a.starts_at<=least(coalesce(p_to,now()+interval '60 days'),now()+interval '120 days')
    and (
      exists (
        select 1 from public.academy_learning_spaces ls
        where ls.teacher_id=p_teacher_id
          and ls.student_id=(select auth.uid())
      )
      or exists (
        select 1 from public.academy_teachers t
        where t.id=p_teacher_id and t.user_id=(select auth.uid())
      )
      or exists (
        select 1 from public.user_settings s
        where s.user_id=(select auth.uid()) and s.is_admin
      )
    )
  order by a.starts_at
  limit 200
$$;

revoke all on function public.academy_teacher_calendar(uuid,timestamptz,timestamptz) from public,anon;
grant execute on function public.academy_teacher_calendar(uuid,timestamptz,timestamptz) to authenticated;

-- ---------------------------------------------------------------------------
-- Admin-only user lookup for assigning Teacher role.
-- auth.users is never exposed as a table to the browser.
-- ---------------------------------------------------------------------------
create or replace function public.academy_admin_search_users(
  p_query text,
  p_limit integer default 12
)
returns table(
  user_id uuid,
  email text,
  display_name text,
  teacher_id uuid
)
language plpgsql
stable
security definer
set search_path=''
as $$
declare
  v_query text:=nullif(trim(coalesce(p_query,'')),'');
  v_limit integer:=least(greatest(coalesce(p_limit,12),1),25);
begin
  if (select auth.uid()) is null
     or not exists (
       select 1 from public.user_settings s
       where s.user_id=(select auth.uid()) and s.is_admin
     ) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  if v_query is null or char_length(v_query)<2 then
    return;
  end if;

  return query
  select
    u.id,
    u.email::text,
    s.display_name::text,
    t.id
  from auth.users u
  left join public.user_settings s on s.user_id=u.id
  left join public.academy_teachers t
    on t.user_id=u.id and t.status<>'archived'
  where coalesce(u.email,'') ilike '%'||v_query||'%'
     or coalesce(s.display_name,'') ilike '%'||v_query||'%'
  order by coalesce(s.display_name,u.email,'')
  limit v_limit;
end
$$;

revoke all on function public.academy_admin_search_users(text,integer) from public,anon;
grant execute on function public.academy_admin_search_users(text,integer) to authenticated;

-- ---------------------------------------------------------------------------
-- Rayan Control Center read connector.
-- The hub token is checked inside SECURITY DEFINER before auth/users data is read.
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
set search_path=''
as $$
declare
  ok boolean;
  q text:=nullif(trim(coalesce(p_args->>'q','')),'');
  lim integer:=least(greatest(coalesce(nullif(p_args->>'limit','')::integer,100),1),500);
  r jsonb;
begin
  select encode(pg_catalog.sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex')=h.token_hash
  into ok
  from public.hub_access h
  where h.id=1;

  if not coalesce(ok,false) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  if p_op='academy-overview' then
    return jsonb_build_object(
      'users',(select count(*) from auth.users),
      'teachers',(select count(*) from public.academy_teachers t where t.user_id is not null and t.status<>'archived'),
      'students',(select count(distinct e.student_id) from public.academy_enrollments e where e.status in ('interested','active','completed')),
      'active_enrollments',(select count(*) from public.academy_enrollments e where e.status='active'),
      'courses',(select count(*) from public.academy_courses c where c.status='active'),
      'languages',(select count(*) from public.academy_languages l where l.status='active')
    );

  elsif p_op='academy-users' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.created_at desc),'[]'::jsonb))
    into r
    from (
      select
        u.id as user_id,
        u.email,
        s.display_name,
        u.created_at,
        u.last_sign_in_at as last_active,
        case when t.id is null then 'student' else 'teacher' end as academy_role,
        t.id as teacher_id,
        t.status as teacher_status
      from auth.users u
      left join public.user_settings s on s.user_id=u.id
      left join public.academy_teachers t
        on t.user_id=u.id and t.status<>'archived'
      where q is null
         or coalesce(u.email,'') ilike '%'||q||'%'
         or coalesce(s.display_name,'') ilike '%'||q||'%'
      order by u.created_at desc
      limit lim
    ) x;
    return r;

  elsif p_op='academy-students' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.last_enrollment desc nulls last),'[]'::jsonb))
    into r
    from (
      select
        u.id as user_id,
        u.email,
        s.display_name,
        count(*) filter(where e.status='active')::integer as active_courses,
        array_remove(array_agg(distinct c.subject_code),null) as languages,
        max(e.created_at) as last_enrollment
      from public.academy_enrollments e
      join auth.users u on u.id=e.student_id
      left join public.user_settings s on s.user_id=u.id
      left join public.academy_courses c on c.id=e.course_id
      where e.status in ('interested','active','completed')
      group by u.id,u.email,s.display_name
    ) x;
    return r;

  elsif p_op='academy-teachers' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.display_name),'[]'::jsonb))
    into r
    from (
      select
        t.id,
        t.user_id,
        t.display_name,
        t.email,
        t.phone,
        t.teaching_languages,
        t.levels,
        t.status,
        (select count(*) from public.academy_learning_spaces ls where ls.teacher_id=t.id)::integer as students,
        (select count(*) from public.academy_teacher_courses tc where tc.teacher_id=t.id)::integer as courses,
        coalesce(
          (select jsonb_agg(tc.course_id order by tc.course_id) from public.academy_teacher_courses tc where tc.teacher_id=t.id),
          '[]'::jsonb
        ) as course_ids
      from public.academy_teachers t
      where t.user_id is not null or t.status<>'archived'
    ) x;
    return r;

  elsif p_op='academy-courses' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.sort_order,x.subject_code,x.level_code),'[]'::jsonb))
    into r
    from (
      select
        c.id,
        c.subject_code,
        c.level_code,
        c.title_i18n,
        c.status,
        c.sort_order,
        c.price_sek,
        c.duration_minutes,
        (select count(*) from public.academy_enrollments e where e.course_id=c.id and e.status='active')::integer as students
      from public.academy_courses c
      where c.status<>'archived'
    ) x;
    return r;

  elsif p_op='academy-languages' then
    select jsonb_build_object('items',coalesce(jsonb_agg(x order by x.sort_order,x.code),'[]'::jsonb))
    into r
    from (
      select
        l.code,
        l.name_i18n,
        l.status,
        l.sort_order,
        (select count(*) from public.academy_courses c where c.subject_code=l.code and c.status<>'archived')::integer as courses,
        (select count(*) from public.academy_courses c where c.subject_code=l.code and c.status='active')::integer as active_courses
      from public.academy_languages l
    ) x;
    return r;

  else
    raise exception 'unknown academy op %',p_op;
  end if;
end
$$;

revoke all on function public.hub_academy_call(text,text,jsonb) from public,authenticated;
grant execute on function public.hub_academy_call(text,text,jsonb) to anon;

-- ---------------------------------------------------------------------------
-- Rayan Control Center write connector.
-- New auth users are Students by default. Teacher access exists only while a
-- non-archived academy_teachers row is linked to that auth user.
-- ---------------------------------------------------------------------------
create or replace function public.hub_academy_manage(
  p_token text,
  p_action text,
  p_user_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  ok boolean;
  v_email text;
  v_name text;
  v_teacher_id uuid;
  v_course_id uuid;
  v_code text;
begin
  select encode(pg_catalog.sha256(convert_to(coalesce(p_token,''),'UTF8')),'hex')=h.token_hash
  into ok
  from public.hub_access h
  where h.id=1;

  if not coalesce(ok,false) then
    raise exception 'forbidden' using errcode='42501';
  end if;

  if p_action in ('make_teacher','make_student') then
    if p_user_id is null then
      raise exception 'user_required';
    end if;

    select u.email,s.display_name
    into v_email,v_name
    from auth.users u
    left join public.user_settings s on s.user_id=u.id
    where u.id=p_user_id;

    if v_email is null then
      raise exception 'user_not_found';
    end if;
  end if;

  if p_action='make_teacher' then
    select t.id
    into v_teacher_id
    from public.academy_teachers t
    where t.user_id=p_user_id
    limit 1;

    if v_teacher_id is null then
      insert into public.academy_teachers(
        user_id,display_name,email,status,teaching_languages,levels
      )
      values(
        p_user_id,
        coalesce(nullif(trim(p_payload->>'display_name'),''),v_name,split_part(v_email,'@',1),'Teacher'),
        v_email,
        'draft',
        coalesce(
          array(select jsonb_array_elements_text(coalesce(p_payload->'teaching_languages','[]'::jsonb))),
          '{}'::text[]
        ),
        coalesce(
          array(select jsonb_array_elements_text(coalesce(p_payload->'levels','[]'::jsonb))),
          '{}'::text[]
        )
      )
      returning id into v_teacher_id;
    else
      update public.academy_teachers
      set status=case when status='archived' then 'draft' else status end,
          updated_at=now()
      where id=v_teacher_id;
    end if;

    insert into public.hub_audit(action,target,detail)
    values('academy.make_teacher',p_user_id,jsonb_build_object('teacher_id',v_teacher_id,'email',v_email));

    return jsonb_build_object('ok',true,'role','teacher','teacher_id',v_teacher_id,'status','draft');

  elsif p_action='make_student' then
    update public.academy_teachers
    set user_id=null,status='archived',updated_at=now()
    where user_id=p_user_id
    returning id into v_teacher_id;

    insert into public.hub_audit(action,target,detail)
    values('academy.make_student',p_user_id,jsonb_build_object('teacher_id',v_teacher_id,'email',v_email));

    return jsonb_build_object('ok',true,'role','student');

  elsif p_action='set_teacher_status' then
    v_teacher_id:=nullif(p_payload->>'teacher_id','')::uuid;
    if coalesce(p_payload->>'status','') not in ('draft','active','archived') then
      raise exception 'bad_status';
    end if;

    update public.academy_teachers
    set status=p_payload->>'status',updated_at=now()
    where id=v_teacher_id;
    if not found then raise exception 'teacher_not_found'; end if;
    return jsonb_build_object('ok',true);

  elsif p_action='assign_teacher_course' then
    v_teacher_id:=nullif(p_payload->>'teacher_id','')::uuid;
    v_course_id:=nullif(p_payload->>'course_id','')::uuid;
    insert into public.academy_teacher_courses(teacher_id,course_id)
    values(v_teacher_id,v_course_id)
    on conflict do nothing;
    return jsonb_build_object('ok',true);

  elsif p_action='remove_teacher_course' then
    v_teacher_id:=nullif(p_payload->>'teacher_id','')::uuid;
    v_course_id:=nullif(p_payload->>'course_id','')::uuid;
    delete from public.academy_teacher_courses
    where teacher_id=v_teacher_id and course_id=v_course_id;
    return jsonb_build_object('ok',true);

  elsif p_action='upsert_language' then
    v_code:=lower(trim(coalesce(p_payload->>'code','')));
    if v_code !~ '^[a-z][a-z0-9_-]{1,15}$' then
      raise exception 'bad_language_code';
    end if;
    if coalesce(p_payload->>'status','active') not in ('active','archived') then
      raise exception 'bad_status';
    end if;

    insert into public.academy_languages(code,name_i18n,status,sort_order)
    values(
      v_code,
      coalesce(p_payload->'name_i18n','{}'::jsonb),
      coalesce(p_payload->>'status','active'),
      coalesce(nullif(p_payload->>'sort_order','')::integer,0)
    )
    on conflict(code) do update set
      name_i18n=public.academy_languages.name_i18n || excluded.name_i18n,
      status=excluded.status,
      sort_order=excluded.sort_order,
      updated_at=now();

    return jsonb_build_object('ok',true,'code',v_code);

  elsif p_action='upsert_course' then
    v_code:=lower(trim(coalesce(p_payload->>'subject_code','')));
    if not exists(select 1 from public.academy_languages l where l.code=v_code) then
      raise exception 'unknown_language';
    end if;
    if coalesce(p_payload->>'status','draft') not in ('draft','active','archived') then
      raise exception 'bad_status';
    end if;

    if nullif(p_payload->>'course_id','') is null then
      insert into public.academy_courses(
        subject_code,level_code,title_i18n,description_i18n,topics_i18n,
        delivery_modes,price_sek,duration_minutes,status,sort_order
      )
      values(
        v_code,
        upper(coalesce(nullif(trim(p_payload->>'level_code'),''),'A1')),
        coalesce(p_payload->'title_i18n','{}'::jsonb),
        coalesce(p_payload->'description_i18n','{}'::jsonb),
        coalesce(p_payload->'topics_i18n','{}'::jsonb),
        coalesce(
          array(select jsonb_array_elements_text(coalesce(p_payload->'delivery_modes','["individual_online"]'::jsonb))),
          array['individual_online']::text[]
        ),
        nullif(p_payload->>'price_sek','')::numeric,
        coalesce(nullif(p_payload->>'duration_minutes','')::integer,60),
        coalesce(p_payload->>'status','draft'),
        coalesce(nullif(p_payload->>'sort_order','')::integer,0)
      )
      returning id into v_course_id;
    else
      v_course_id:=(p_payload->>'course_id')::uuid;
      update public.academy_courses
      set subject_code=v_code,
          level_code=upper(coalesce(nullif(trim(p_payload->>'level_code'),''),level_code)),
          title_i18n=case when p_payload ? 'title_i18n' then title_i18n || (p_payload->'title_i18n') else title_i18n end,
          description_i18n=case when p_payload ? 'description_i18n' then description_i18n || (p_payload->'description_i18n') else description_i18n end,
          topics_i18n=case when p_payload ? 'topics_i18n' then topics_i18n || (p_payload->'topics_i18n') else topics_i18n end,
          delivery_modes=case
            when p_payload ? 'delivery_modes'
            then array(select jsonb_array_elements_text(p_payload->'delivery_modes'))
            else delivery_modes
          end,
          price_sek=case when p_payload ? 'price_sek' then nullif(p_payload->>'price_sek','')::numeric else price_sek end,
          duration_minutes=coalesce(nullif(p_payload->>'duration_minutes','')::integer,duration_minutes),
          status=coalesce(p_payload->>'status',status),
          sort_order=coalesce(nullif(p_payload->>'sort_order','')::integer,sort_order),
          updated_at=now()
      where id=v_course_id;
      if not found then raise exception 'course_not_found'; end if;
    end if;

    return jsonb_build_object('ok',true,'course_id',v_course_id);

  else
    raise exception 'unsupported_action';
  end if;
end
$$;

revoke all on function public.hub_academy_manage(text,text,uuid,jsonb) from public,authenticated;
grant execute on function public.hub_academy_manage(text,text,uuid,jsonb) to anon;

notify pgrst,'reload schema';
