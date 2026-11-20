-- Additive, scoped Academy administration. Existing records are not modified.
alter table public.academy_teachers add column instagram_url text check (instagram_url is null or instagram_url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._/]+/?$');
grant select(instagram_url) on public.academy_teachers to anon, authenticated;

create table public.academy_course_plans (
 learning_space_id uuid primary key references public.academy_learning_spaces(id) on delete cascade,
 suggested_sessions integer check(suggested_sessions between 1 and 1000),
 suggested_start date,
 suggested_schedule text check (char_length(suggested_schedule)<=2000),
 updated_by uuid references auth.users(id),
 updated_at timestamptz not null default now()
);
alter table public.academy_course_plans enable row level security;
revoke all on public.academy_course_plans from public,anon,authenticated;
grant select on public.academy_course_plans to authenticated;
create policy "Academy plan classroom read" on public.academy_course_plans for select to authenticated using (public.academy_space_access(learning_space_id));

create function academy_private.academy_save_course_plan(p_space uuid,p_sessions integer,p_start date,p_schedule text default null) returns void
language plpgsql security definer set search_path='' as $$
declare s public.academy_learning_spaces;
begin
 select * into s from public.academy_learning_spaces where id=p_space for update;
 if auth.uid() is null or s.id is null or not(public.is_admin() or public.academy_active_teacher(s.teacher_id)) then raise exception 'Teacher or admin required' using errcode='42501'; end if;
 if not academy_private.space_writable(p_space) then raise exception 'Active enrollment required'; end if;
 if p_sessions is not null and (p_sessions<1 or p_sessions>1000) then raise exception 'Invalid session count'; end if;
 if char_length(coalesce(p_schedule,''))>2000 then raise exception 'Schedule is too long';end if;
 insert into public.academy_course_plans(learning_space_id,suggested_sessions,suggested_start,suggested_schedule,updated_by) values(p_space,p_sessions,p_start,nullif(trim(p_schedule),''),auth.uid())
 on conflict(learning_space_id) do update set suggested_sessions=excluded.suggested_sessions,suggested_start=excluded.suggested_start,suggested_schedule=excluded.suggested_schedule,updated_by=auth.uid(),updated_at=now();
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),s.student_id,'course_plan',jsonb_build_object('space',p_space,'sessions',p_sessions,'start',p_start));
end;$$;
revoke all on function academy_private.academy_save_course_plan(uuid,integer,date,text) from public,anon,authenticated;
grant execute on function academy_private.academy_save_course_plan(uuid,integer,date,text) to authenticated;

create function academy_private.academy_admin_add_enrollment(p_student uuid,p_teacher uuid,p_course uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare e_id uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501'; end if;
 if not exists(select 1 from auth.users where id=p_student) then raise exception 'Student not found'; end if;
 if not exists(select 1 from public.academy_teachers t join public.academy_teacher_courses tc on tc.teacher_id=t.id join public.academy_courses c on c.id=tc.course_id where t.id=p_teacher and t.status='active' and c.id=p_course and c.status='active') then raise exception 'Choose an active teacher who offers this active course'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_student::text||p_course::text,0));
 if exists(select 1 from public.academy_enrollments where student_id=p_student and teacher_id=p_teacher and course_id=p_course) then raise exception 'Enrollment already exists; restore or manage it instead'; end if;
 select id into e_id from public.academy_enrollments where student_id=p_student and course_id=p_course and teacher_id is null and status='interested' and removed_at is null order by created_at,id limit 1 for update;
 if e_id is null then insert into public.academy_enrollments(student_id,teacher_id,course_id,status) values(p_student,p_teacher,p_course,'interested') returning id into e_id; end if;
 perform public.academy_activate_enrollment(e_id,p_teacher);
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),p_student,'add_enrollment',jsonb_build_object('enrollment',e_id,'teacher',p_teacher,'course',p_course));
 return e_id;
end;$$;
revoke all on function academy_private.academy_admin_add_enrollment(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function academy_private.academy_admin_add_enrollment(uuid,uuid,uuid) to authenticated;

-- Only explicitly published translations are returned, without exposing author account IDs.
create schema academy_profile_private;
revoke all on schema academy_profile_private from public;
grant usage on schema academy_profile_private to anon,authenticated;
create function academy_profile_private.academy_teacher_public_posts(p_teacher uuid,p_locale text) returns table(id uuid,title text,description text)
language sql stable security definer set search_path='' as $$
 select p.id,x.title,x.description from public.academy_teachers t join public.academy_posts p on p.author_id=t.user_id join public.academy_post_translations x on x.post_id=p.id
 where t.id=p_teacher and t.status='active' and x.locale=p_locale and x.status='published' order by x.published_at desc nulls last,p.id limit 100
$$;
revoke all on function academy_profile_private.academy_teacher_public_posts(uuid,text) from public,anon,authenticated;
grant execute on function academy_profile_private.academy_teacher_public_posts(uuid,text) to anon,authenticated;

-- Deletion is only possible after all history/availability has been addressed.
create function academy_private.academy_admin_delete_teacher(p_teacher uuid,p_name text) returns void
language plpgsql security definer set search_path='' as $$
declare t public.academy_teachers; fk record; n bigint; total bigint:=0;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501'; end if;
 select * into t from public.academy_teachers where id=p_teacher for update;
 if t.id is null or p_name is distinct from t.display_name then raise exception 'Teacher name does not match'; end if;
 for fk in select con.conrelid::regclass as tab,att.attname as col from pg_catalog.pg_constraint con join pg_catalog.pg_attribute att on att.attrelid=con.conrelid and att.attnum=con.conkey[1] where con.contype='f' and con.confrelid='public.academy_teachers'::regclass and array_length(con.conkey,1)=1 loop
  execute format('select count(*) from %s where %I=$1',fk.tab,fk.col) into n using p_teacher; total:=total+n;
 end loop;
 if total>0 then raise exception 'Teacher has % linked records; transfer or remove dependencies before deletion',total; end if;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),coalesce(t.user_id,auth.uid()),'delete_teacher',jsonb_build_object('teacher',t.id,'name',t.display_name));
 delete from public.academy_teachers where id=p_teacher;
end;$$;
revoke all on function academy_private.academy_admin_delete_teacher(uuid,text) from public,anon,authenticated;
grant execute on function academy_private.academy_admin_delete_teacher(uuid,text) to authenticated;

create function academy_private.academy_admin_teacher_desk(p_teacher uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare target uuid; result jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501';end if;
 select user_id into target from public.academy_teachers where id=p_teacher;
 if target is null then raise exception 'Teacher has no linked account';end if;
 select to_jsonb(d)-'user_id' into result from public.academy_teacher_desk d where d.user_id=target;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),target,'view_teacher_desk',jsonb_build_object('teacher',p_teacher));
 return coalesce(result,'{}'::jsonb);
end;$$;
revoke all on function academy_private.academy_admin_teacher_desk(uuid) from public,anon,authenticated;
grant execute on function academy_private.academy_admin_teacher_desk(uuid) to authenticated;

-- Preserve atomic teacher and course edits when adding Instagram.
create or replace function public.academy_admin_save_teacher(p_teacher jsonb,p_course_ids uuid[]) returns uuid
language plpgsql set search_path='' as $$
declare r public.academy_teachers%rowtype; tid uuid;
begin
 if not public.is_admin() then raise exception 'Admin permission required' using errcode='42501'; end if;
 r:=jsonb_populate_record(null::public.academy_teachers,p_teacher);
 tid:=coalesce(r.id,gen_random_uuid());
 if exists(select 1 from unnest(coalesce(p_course_ids,'{}')) cid where not exists(select 1 from public.academy_courses c where c.id=cid)) then raise exception 'Unknown course'; end if;
 insert into public.academy_teachers(id,user_id,display_name,display_name_i18n,photo_url,intro_i18n,teaching_languages,spoken_languages,levels,specialties,email,phone,teams_chat_url,teams_call_url,telegram_url,instagram_url,status,created_by)
 values(tid,r.user_id,r.display_name,coalesce(r.display_name_i18n,'{}'),r.photo_url,coalesce(r.intro_i18n,'{}'),coalesce(r.teaching_languages,'{}'),coalesce(r.spoken_languages,'{}'),coalesce(r.levels,'{}'),coalesce(r.specialties,'{}'),r.email,r.phone,r.teams_chat_url,r.teams_call_url,r.telegram_url,r.instagram_url,coalesce(r.status,'draft'),auth.uid())
 on conflict(id) do update set user_id=excluded.user_id,display_name=excluded.display_name,display_name_i18n=excluded.display_name_i18n,photo_url=excluded.photo_url,intro_i18n=excluded.intro_i18n,
 teaching_languages=excluded.teaching_languages,spoken_languages=excluded.spoken_languages,levels=excluded.levels,specialties=excluded.specialties,email=excluded.email,phone=excluded.phone,
 teams_chat_url=excluded.teams_chat_url,teams_call_url=excluded.teams_call_url,telegram_url=excluded.telegram_url,instagram_url=case when p_teacher ? 'instagram_url' then excluded.instagram_url else public.academy_teachers.instagram_url end,status=excluded.status,updated_at=now();
 delete from public.academy_teacher_courses where teacher_id=tid and not(course_id=any(coalesce(p_course_ids,'{}')));
 insert into public.academy_teacher_courses(teacher_id,course_id) select tid,unnest(coalesce(p_course_ids,'{}')) on conflict do nothing;
 return tid;
end;$$;
create function academy_private.academy_admin_save_teacher_desk(p_teacher uuid,p_notes text,p_materials text,p_weekly_plan text) returns void
language plpgsql security definer set search_path='' as $$
declare target uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501';end if;
 select user_id into target from public.academy_teachers where id=p_teacher;
 if target is null then raise exception 'Teacher has no linked account';end if;
 if greatest(length(coalesce(p_notes,'')),length(coalesce(p_materials,'')),length(coalesce(p_weekly_plan,'')))>50000 then raise exception 'Text exceeds 50000 characters';end if;
 insert into public.academy_teacher_desk(user_id,notes,materials,weekly_plan) values(target,coalesce(p_notes,''),coalesce(p_materials,''),coalesce(p_weekly_plan,''))
 on conflict(user_id) do update set notes=excluded.notes,materials=excluded.materials,weekly_plan=excluded.weekly_plan,updated_at=now();
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),target,'edit_teacher_desk',jsonb_build_object('teacher',p_teacher));
end;$$;
revoke all on function academy_private.academy_admin_save_teacher_desk(uuid,text,text,text) from public,anon,authenticated;
grant execute on function academy_private.academy_admin_save_teacher_desk(uuid,text,text,text) to authenticated;

-- Public entry points are invokers; privileged implementations live outside exposed schemas.
create function public.academy_save_course_plan(p_space uuid,p_sessions integer,p_start date,p_schedule text default null) returns void language sql security invoker set search_path='' as $$select academy_private.academy_save_course_plan(p_space,p_sessions,p_start,p_schedule)$$;
create function public.academy_admin_add_enrollment(p_student uuid,p_teacher uuid,p_course uuid) returns uuid language sql security invoker set search_path='' as $$select academy_private.academy_admin_add_enrollment(p_student,p_teacher,p_course)$$;
create function public.academy_admin_delete_teacher(p_teacher uuid,p_name text) returns void language sql security invoker set search_path='' as $$select academy_private.academy_admin_delete_teacher(p_teacher,p_name)$$;
create function public.academy_admin_teacher_desk(p_teacher uuid) returns jsonb language sql security invoker set search_path='' as $$select academy_private.academy_admin_teacher_desk(p_teacher)$$;
create function public.academy_admin_save_teacher_desk(p_teacher uuid,p_notes text,p_materials text,p_weekly_plan text) returns void language sql security invoker set search_path='' as $$select academy_private.academy_admin_save_teacher_desk(p_teacher,p_notes,p_materials,p_weekly_plan)$$;
create function public.academy_teacher_public_posts(p_teacher uuid,p_locale text) returns table(id uuid,title text,description text) language sql stable security invoker set search_path='' as $$select * from academy_profile_private.academy_teacher_public_posts(p_teacher,p_locale)$$;
revoke all on function public.academy_save_course_plan(uuid,integer,date,text),public.academy_admin_add_enrollment(uuid,uuid,uuid),public.academy_admin_delete_teacher(uuid,text),public.academy_admin_teacher_desk(uuid),public.academy_admin_save_teacher_desk(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.academy_save_course_plan(uuid,integer,date,text),public.academy_admin_add_enrollment(uuid,uuid,uuid),public.academy_admin_delete_teacher(uuid,text),public.academy_admin_teacher_desk(uuid),public.academy_admin_save_teacher_desk(uuid,text,text,text) to authenticated;
revoke all on function public.academy_teacher_public_posts(uuid,text) from public,anon,authenticated;
grant execute on function public.academy_teacher_public_posts(uuid,text) to anon,authenticated;
create function academy_private.audit_teacher_instagram() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' or old.instagram_url is distinct from new.instagram_url then
  insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),coalesce(new.user_id,auth.uid()),'teacher_instagram',jsonb_build_object('teacher',new.id));
 end if;
 return new;
end;$$;
revoke all on function academy_private.audit_teacher_instagram() from public,anon,authenticated;
create trigger academy_teacher_instagram_audit after update of instagram_url on public.academy_teachers for each row execute function academy_private.audit_teacher_instagram();
create trigger academy_teacher_instagram_insert_audit after insert on public.academy_teachers for each row when (new.instagram_url is not null) execute function academy_private.audit_teacher_instagram();
create function academy_private.academy_admin_private_notes(p_space uuid,p_page integer) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.academy_learning_spaces;result jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501';end if;
 select * into s from public.academy_learning_spaces where id=p_space;
 if s.id is null then raise exception 'Learning space not found';end if;
 if p_page is null or p_page<0 or p_page>100000 then raise exception 'Invalid page';end if;
 select coalesce(jsonb_agg(to_jsonb(n) order by n.created_at desc,n.id desc),'[]'::jsonb) into result from (select id,body,author_id,created_at from public.academy_notes where learning_space_id=p_space and visibility='private' order by created_at desc,id desc limit 50 offset (p_page*50)) n;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),s.student_id,'view_private_notes',jsonb_build_object('space',p_space));return result;
end;$$;
revoke all on function academy_private.academy_admin_private_notes(uuid,integer) from public,anon,authenticated;
grant execute on function academy_private.academy_admin_private_notes(uuid,integer) to authenticated;
create function public.academy_admin_private_notes(p_space uuid,p_page integer default 0) returns jsonb language sql security invoker set search_path='' as $$select academy_private.academy_admin_private_notes(p_space,p_page)$$;
revoke all on function public.academy_admin_private_notes(uuid,integer) from public,anon,authenticated;
grant execute on function public.academy_admin_private_notes(uuid,integer) to authenticated;

-- Admin edits are explicit, audited, scoped to the selected space and protected against stale writes.
create function academy_private.academy_admin_change_private_note(p_space uuid,p_note uuid,p_expected text,p_body text,p_delete boolean) returns void language plpgsql security definer set search_path='' as $$
declare s public.academy_learning_spaces; n public.academy_notes;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501';end if;
 select * into s from public.academy_learning_spaces where id=p_space;
 if s.id is null then raise exception 'Learning space not found';end if;
 select * into n from public.academy_notes where id=p_note and learning_space_id=p_space and visibility='private' for update;
 if n.id is null then raise exception 'Private note not found';end if;
 if n.body is distinct from p_expected then raise exception 'Note changed; refresh before editing';end if;
 if p_delete is null then raise exception 'Action required';end if;
 if p_delete then delete from public.academy_notes where id=p_note;
 else
  if p_body is null or length(trim(p_body))=0 or length(p_body)>20000 then raise exception 'Invalid note';end if;
  update public.academy_notes set body=p_body,updated_at=now() where id=p_note;
 end if;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),s.student_id,case when p_delete then 'delete_private_note' else 'edit_private_note' end,jsonb_build_object('space',p_space,'note',p_note));
end;$$;
revoke all on function academy_private.academy_admin_change_private_note(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function academy_private.academy_admin_change_private_note(uuid,uuid,text,text,boolean) to authenticated;
create function public.academy_admin_change_private_note(p_space uuid,p_note uuid,p_expected text,p_body text,p_delete boolean) returns void language sql security invoker set search_path='' as $$select academy_private.academy_admin_change_private_note(p_space,p_note,p_expected,p_body,p_delete)$$;
revoke all on function public.academy_admin_change_private_note(uuid,uuid,text,text,boolean) from public,anon,authenticated;
grant execute on function public.academy_admin_change_private_note(uuid,uuid,text,text,boolean) to authenticated;
create function academy_private.academy_admin_student_snapshot(p_student uuid,p_page integer,p_status text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501';end if;
 if not exists(select 1 from auth.users where id=p_student) then raise exception 'User not found';end if;
 if p_page is null or p_page<0 or p_page>100000 or p_status is null or p_status not in ('all','active','interested','paused','completed','cancelled','removed') then raise exception 'Invalid page or status';end if;
 select jsonb_build_object(
 'enrollments',coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc,e.id desc) from (select e.id,e.course_id,e.teacher_id,e.status,e.removed_at,e.created_at,(select s.id from public.academy_learning_spaces s where s.enrollment_id=e.id order by s.created_at desc,s.id desc limit 1) as space_id from public.academy_enrollments e where e.student_id=p_student and (p_status='all' or (p_status='removed' and e.removed_at is not null) or (p_status<>'removed' and e.removed_at is null and e.status=p_status)) order by e.created_at desc,e.id desc limit 50 offset (p_page*50))e),'[]'::jsonb),
 'has_more_enrollments',exists(select 1 from public.academy_enrollments e where e.student_id=p_student and (p_status='all' or (p_status='removed' and e.removed_at is not null) or (p_status<>'removed' and e.removed_at is null and e.status=p_status)) order by e.created_at desc,e.id desc offset ((p_page+1)*50) limit 1),
 'bookings',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc,b.id desc) from (select id,course_id,teacher_id,status,confirmed_start,created_at from public.academy_bookings where student_id=p_student order by created_at desc,id desc limit 50 offset (p_page*50))b),'[]'::jsonb),
 'has_more_bookings',exists(select 1 from public.academy_bookings where student_id=p_student order by created_at desc,id desc offset ((p_page+1)*50) limit 1)) into result;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),p_student,'view_student_snapshot',jsonb_build_object('page',p_page,'status',p_status));return result;
end;$$;
revoke all on function academy_private.academy_admin_student_snapshot(uuid,integer,text) from public,anon,authenticated;
grant execute on function academy_private.academy_admin_student_snapshot(uuid,integer,text) to authenticated;
create function public.academy_admin_student_snapshot(p_student uuid,p_page integer default 0,p_status text default 'all') returns jsonb language sql security invoker set search_path='' as $$select academy_private.academy_admin_student_snapshot(p_student,p_page,p_status)$$;
revoke all on function public.academy_admin_student_snapshot(uuid,integer,text) from public,anon,authenticated;
grant execute on function public.academy_admin_student_snapshot(uuid,integer,text) to authenticated;
