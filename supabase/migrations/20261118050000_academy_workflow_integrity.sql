alter table public.academy_teachers add column if not exists display_name_i18n jsonb not null default '{}'::jsonb;
-- Correct classroom ownership and make archived teachers inactive without deleting history.
create or replace function public.academy_active_teacher(p_teacher uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.academy_teachers t where t.id=p_teacher and t.user_id=(select auth.uid()) and t.status='active');
$$;
create or replace function public.academy_space_access(p_space uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.academy_learning_spaces ls left join public.academy_enrollments e on e.id=ls.enrollment_id
 where ls.id=p_space and (public.is_admin() or ls.student_id=(select auth.uid()) or
 (public.academy_active_teacher(ls.teacher_id) and coalesce(e.status,'active')<>'cancelled')));
$$;
revoke all on function public.academy_active_teacher(uuid),public.academy_space_access(uuid) from public,anon;
grant execute on function public.academy_active_teacher(uuid),public.academy_space_access(uuid) to authenticated;

drop policy if exists "academy active member boundary" on public.academy_learning_spaces;
create policy "academy active member boundary" on public.academy_learning_spaces as restrictive for all to authenticated using (public.is_admin() or student_id=(select auth.uid()) or public.academy_active_teacher(teacher_id)) with check (public.is_admin() or student_id=(select auth.uid()) or public.academy_active_teacher(teacher_id));

drop policy if exists "academy active member boundary" on public.academy_enrollments;
create policy "academy active member boundary" on public.academy_enrollments as restrictive for all to authenticated using (public.is_admin() or student_id=(select auth.uid()) or public.academy_active_teacher(teacher_id)) with check (public.is_admin() or student_id=(select auth.uid()) or public.academy_active_teacher(teacher_id));

drop policy if exists "academy active member boundary" on public.academy_bookings;
create policy "academy active member boundary" on public.academy_bookings as restrictive for all to authenticated using (public.is_admin() or student_id=(select auth.uid()) or public.academy_active_teacher(teacher_id)) with check (public.is_admin() or student_id=(select auth.uid()) or public.academy_active_teacher(teacher_id));

drop policy if exists "academy active member boundary" on public.academy_notes;
create policy "academy active member boundary" on public.academy_notes as restrictive for all to authenticated using (public.academy_space_access(learning_space_id)) with check (public.academy_space_access(learning_space_id));

drop policy if exists "academy active member boundary" on public.academy_resources;
create policy "academy active member boundary" on public.academy_resources as restrictive for all to authenticated using (public.academy_space_access(learning_space_id)) with check (public.academy_space_access(learning_space_id));

drop policy if exists "academy active member boundary" on public.academy_messages;
create policy "academy active member boundary" on public.academy_messages as restrictive for all to authenticated using (public.academy_space_access(learning_space_id)) with check (public.academy_space_access(learning_space_id));

drop policy if exists "academy active member boundary" on public.academy_session_summaries;
create policy "academy active member boundary" on public.academy_session_summaries as restrictive for all to authenticated using (public.academy_space_access(learning_space_id)) with check (public.academy_space_access(learning_space_id));

drop policy if exists "academy active member boundary" on public.academy_test_results;
create policy "academy active member boundary" on public.academy_test_results as restrictive for all to authenticated using (public.academy_space_access(learning_space_id)) with check (public.academy_space_access(learning_space_id));

drop policy if exists "academy active slot insert" on public.academy_availability;
create policy "academy active slot insert" on public.academy_availability as restrictive for insert to authenticated with check (public.is_admin() or public.academy_active_teacher(teacher_id));

drop policy if exists "academy active slot update" on public.academy_availability;
create policy "academy active slot update" on public.academy_availability as restrictive for update to authenticated using (public.is_admin() or public.academy_active_teacher(teacher_id)) with check (public.is_admin() or public.academy_active_teacher(teacher_id));

drop policy if exists "academy active slot delete" on public.academy_availability;
create policy "academy active slot delete" on public.academy_availability as restrictive for delete to authenticated using (public.is_admin() or public.academy_active_teacher(teacher_id)) ;

drop policy if exists "academy summaries teacher admin write" on public.academy_session_summaries;
create policy "academy summaries teacher admin write" on public.academy_session_summaries for all to authenticated
using (public.is_admin() or (public.academy_active_teacher(teacher_id) and public.academy_space_access(learning_space_id)))
with check (exists(select 1 from public.academy_learning_spaces ls where ls.id=academy_session_summaries.learning_space_id
and ls.student_id=academy_session_summaries.student_id and ls.teacher_id=academy_session_summaries.teacher_id)
and (public.is_admin() or public.academy_active_teacher(teacher_id)));

drop policy if exists "academy classroom history read" on public.academy_session_summaries;
create policy "academy classroom history read" on public.academy_session_summaries for select to authenticated using (public.academy_space_access(learning_space_id));

drop policy if exists "academy test results teacher admin write" on public.academy_test_results;
create policy "academy test results teacher admin write" on public.academy_test_results for all to authenticated
using (public.is_admin() or (public.academy_active_teacher(teacher_id) and public.academy_space_access(learning_space_id)))
with check (exists(select 1 from public.academy_learning_spaces ls where ls.id=academy_test_results.learning_space_id
and ls.student_id=academy_test_results.student_id and ls.teacher_id=academy_test_results.teacher_id)
and (public.is_admin() or public.academy_active_teacher(teacher_id)));

drop policy if exists "academy classroom history read" on public.academy_test_results;
create policy "academy classroom history read" on public.academy_test_results for select to authenticated using (public.academy_space_access(learning_space_id));

drop policy if exists "academy resources teacher admin insert" on public.academy_resources;
create policy "academy resources teacher admin insert" on public.academy_resources for insert to authenticated
with check (exists(select 1 from public.academy_learning_spaces ls where ls.id=academy_resources.learning_space_id
 and ls.teacher_id=academy_resources.teacher_id) and (public.is_admin() or public.academy_active_teacher(teacher_id)));

-- Preserve authorship/space identity; validate optional session references.
create or replace function public.academy_guard_content_identity() returns trigger language plpgsql set search_path='' as $$
declare v jsonb:=to_jsonb(new); oldv jsonb; ls public.academy_learning_spaces%rowtype;
begin
 select * into ls from public.academy_learning_spaces where id=new.learning_space_id;
 if ls.id is null then raise exception 'Classroom not accessible' using errcode='42501'; end if;
 if tg_op='UPDATE' then
  oldv:=to_jsonb(old);
  if v->>'learning_space_id' is distinct from oldv->>'learning_space_id' or v->>'teacher_id' is distinct from oldv->>'teacher_id'
   or v->>'student_id' is distinct from oldv->>'student_id' then raise exception 'Content authorship and classroom cannot be changed'; end if;
 else
  if (v->>'teacher_id')::uuid is distinct from ls.teacher_id or
    (v ? 'student_id' and (v->>'student_id')::uuid is distinct from ls.student_id) then raise exception 'Content must match the classroom members'; end if;
 end if;
 if tg_table_name='academy_session_summaries' and v->>'booking_id' is not null then
  if not exists(select 1 from public.academy_bookings b where b.id=(v->>'booking_id')::uuid
   and b.student_id=ls.student_id and b.teacher_id=(v->>'teacher_id')::uuid and b.course_id=ls.course_id) then raise exception 'Session does not belong to this classroom'; end if;
 end if;
 return new;
end;$$;
drop trigger if exists academy_content_identity on public.academy_resources;
create trigger academy_content_identity before insert or update on public.academy_resources for each row execute function public.academy_guard_content_identity();
drop trigger if exists academy_content_identity on public.academy_session_summaries;
create trigger academy_content_identity before insert or update on public.academy_session_summaries for each row execute function public.academy_guard_content_identity();
drop trigger if exists academy_content_identity on public.academy_test_results;
create trigger academy_content_identity before insert or update on public.academy_test_results for each row execute function public.academy_guard_content_identity();

create or replace function public.academy_guard_urls() returns trigger language plpgsql set search_path='' as $$
declare v jsonb:=to_jsonb(new); k text; u text;
begin
 foreach k in array array['url','photo_url','telegram_url','teams_chat_url','teams_call_url','meeting_url'] loop
  u:=nullif(trim(v->>k),'');
  if u is not null and u !~* '^https://[^[:space:]]+$' then raise exception 'Links must be valid HTTPS URLs'; end if;
 end loop; return new;
end;$$;
drop trigger if exists academy_https_urls on public.academy_resources;
create trigger academy_https_urls before insert or update on public.academy_resources for each row execute function public.academy_guard_urls();
drop trigger if exists academy_https_urls on public.academy_courses;
create trigger academy_https_urls before insert or update on public.academy_courses for each row execute function public.academy_guard_urls();
drop trigger if exists academy_https_urls on public.academy_teachers;
create trigger academy_https_urls before insert or update on public.academy_teachers for each row execute function public.academy_guard_urls();
drop trigger if exists academy_https_urls on public.academy_bookings;
create trigger academy_https_urls before insert or update on public.academy_bookings for each row execute function public.academy_guard_urls();

-- One transaction for the teacher profile and course assignments. No partial success.
create or replace function public.academy_admin_save_teacher(p_teacher jsonb,p_course_ids uuid[]) returns uuid
language plpgsql set search_path='' as $$
declare r public.academy_teachers%rowtype; tid uuid;
begin
 if not public.is_admin() then raise exception 'Admin permission required' using errcode='42501'; end if;
 r:=jsonb_populate_record(null::public.academy_teachers,p_teacher);
 tid:=coalesce(r.id,gen_random_uuid());
 if exists(select 1 from unnest(coalesce(p_course_ids,'{}')) cid where not exists(select 1 from public.academy_courses c where c.id=cid)) then raise exception 'Unknown course'; end if;
 insert into public.academy_teachers(id,user_id,display_name,display_name_i18n,photo_url,intro_i18n,teaching_languages,spoken_languages,levels,specialties,email,phone,teams_chat_url,teams_call_url,telegram_url,status,created_by)
 values(tid,r.user_id,r.display_name,coalesce(r.display_name_i18n,'{}'),r.photo_url,coalesce(r.intro_i18n,'{}'),coalesce(r.teaching_languages,'{}'),coalesce(r.spoken_languages,'{}'),coalesce(r.levels,'{}'),coalesce(r.specialties,'{}'),r.email,r.phone,r.teams_chat_url,r.teams_call_url,r.telegram_url,coalesce(r.status,'draft'),auth.uid())
 on conflict(id) do update set user_id=excluded.user_id,display_name=excluded.display_name,display_name_i18n=excluded.display_name_i18n,photo_url=excluded.photo_url,intro_i18n=excluded.intro_i18n,
 teaching_languages=excluded.teaching_languages,spoken_languages=excluded.spoken_languages,levels=excluded.levels,specialties=excluded.specialties,email=excluded.email,phone=excluded.phone,
 teams_chat_url=excluded.teams_chat_url,teams_call_url=excluded.teams_call_url,telegram_url=excluded.telegram_url,status=excluded.status,updated_at=now();
 delete from public.academy_teacher_courses where teacher_id=tid and not(course_id=any(coalesce(p_course_ids,'{}')));
 insert into public.academy_teacher_courses(teacher_id,course_id) select tid,unnest(coalesce(p_course_ids,'{}')) on conflict do nothing;
 return tid;
end;$$;
create or replace function public.academy_admin_enrollments() returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Admin permission required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(q)) from (select e.*,coalesce(s.display_name,u.email,'Student') as student_name,u.email as student_email,ls.id as space_id
 from public.academy_enrollments e left join public.user_settings s on s.user_id=e.student_id left join auth.users u on u.id=e.student_id
 left join public.academy_learning_spaces ls on ls.enrollment_id=e.id order by e.created_at desc limit 1000)q),'[]');
end;$$;
create or replace function public.academy_admin_set_enrollment(p_id uuid,p_teacher_id uuid,p_status text) returns uuid
language plpgsql set search_path='' as $$
declare sid uuid;
begin
 if not public.is_admin() then raise exception 'Admin permission required' using errcode='42501'; end if;
 if p_status='active' then return public.academy_activate_enrollment(p_id,p_teacher_id); end if;
 if p_status not in ('completed','cancelled') then raise exception 'Invalid enrollment status'; end if;
 update public.academy_enrollments set status=p_status,updated_at=now() where id=p_id returning id into sid;
 if sid is null then raise exception 'Enrollment not found'; end if;
 return sid;
end;$$;
revoke all on function public.academy_admin_save_teacher(jsonb,uuid[]) from public,anon;
grant execute on function public.academy_admin_save_teacher(jsonb,uuid[]) to authenticated;
revoke all on function public.academy_admin_enrollments() from public,anon;
grant execute on function public.academy_admin_enrollments() to authenticated;
revoke all on function public.academy_admin_set_enrollment(uuid,uuid,text) from public,anon;
grant execute on function public.academy_admin_set_enrollment(uuid,uuid,text) to authenticated;

-- Interface preferences are distinct from native/learning languages and App sync payloads.
create table if not exists public.academy_preferences(
 user_id uuid primary key references auth.users(id) on delete cascade,
 locale text not null default 'en' check(locale in ('en','sv','de','fa')),
 theme text not null default 'light' check(theme in ('light','dark')),
 updated_at timestamptz not null default now()
);
alter table public.academy_preferences enable row level security;
grant select,insert,update on public.academy_preferences to authenticated;
drop policy if exists "own academy preferences" on public.academy_preferences;
create policy "own academy preferences" on public.academy_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
grant select(display_name_i18n) on public.academy_teachers to anon,authenticated;

drop policy if exists "academy courses enrolled history" on public.academy_courses;
create policy "academy courses enrolled history" on public.academy_courses for select to authenticated
using(exists(select 1 from public.academy_enrollments e where e.course_id=academy_courses.id and (e.student_id=(select auth.uid()) or public.academy_active_teacher(e.teacher_id))));

-- Cancellation revokes teacher classroom access while the student keeps their history.
drop policy if exists "academy active member boundary" on public.academy_learning_spaces;
create policy "academy active member boundary" on public.academy_learning_spaces as restrictive for all to authenticated using(public.academy_space_access(id)) with check(public.academy_space_access(id));
-- INSERT cannot consult a row that has not been created yet; only the existing admin INSERT policy permits it.
drop policy if exists "academy active member boundary" on public.academy_learning_spaces;
create policy "academy active classroom read" on public.academy_learning_spaces as restrictive for select to authenticated using(public.academy_space_access(id));
create policy "academy active classroom update" on public.academy_learning_spaces as restrictive for update to authenticated using(public.academy_space_access(id)) with check(public.is_admin() or student_id=(select auth.uid()) or public.academy_active_teacher(teacher_id));
create policy "academy active slot read" on public.academy_availability as restrictive for select to authenticated using(status='available' or public.is_admin() or public.academy_active_teacher(teacher_id));
