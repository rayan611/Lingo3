create or replace function public.academy_admin_users(p_query text default '',p_role text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501'; end if;
 if p_role not in ('','admin','teacher','student') or p_page < 0 then raise exception 'Invalid filter'; end if;
 with users as (
 select u.id as user_id,coalesce(s.display_name,'') as display_name,u.email,
 coalesce(u.phone,'') as phone,coalesce(u.raw_user_meta_data->>'user_name',u.raw_user_meta_data->>'preferred_username',u.raw_user_meta_data->>'username','') as username,u.last_sign_in_at,coalesce(s.is_admin,false) as is_admin,t.id as teacher_id,t.status as teacher_status,u.created_at
 from auth.users u left join public.user_settings s on s.user_id=u.id
 left join public.academy_teachers t on t.user_id=u.id
 where (p_query='' or position(lower(p_query) in lower(coalesce(s.display_name,'')||' '||coalesce(u.email,'')||' '||coalesce(u.phone,'')||' '||coalesce(u.raw_user_meta_data->>'user_name','')||' '||coalesce(u.raw_user_meta_data->>'preferred_username','')||' '||coalesce(u.raw_user_meta_data->>'username','')||' '||u.id::text))>0)
 and (p_role='' or (p_role='admin' and s.is_admin) or (p_role='teacher' and t.status='active')
 or (p_role='student' and exists(select 1 from public.academy_enrollments e where e.student_id=u.id and e.status='active')))
 ), page as (select * from users order by created_at desc,user_id limit 25 offset p_page*25)
 select jsonb_build_object('total',(select count(*) from users),'users',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]')) into result;
 return result;
end;$$;

alter table public.academy_enrollments add column removed_at timestamptz;
alter table public.academy_enrollments drop constraint academy_enrollments_status_check;
alter table public.academy_enrollments add constraint academy_enrollments_status_check check(status in ('interested','active','paused','completed','cancelled'));
create or replace function public.academy_admin_set_enrollment(p_id uuid,p_teacher_id uuid,p_status text) returns uuid
language plpgsql set search_path='' as $$
declare e public.academy_enrollments; sid uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501'; end if;
 select * into e from public.academy_enrollments where id=p_id for update;
 if e.id is null then raise exception 'Enrollment not found'; end if;
 if p_status='active' then
 update public.academy_enrollments set removed_at=null where id=p_id;
 return public.academy_activate_enrollment(p_id,p_teacher_id);
 end if;
 if p_status not in ('paused','completed','cancelled','removed') then raise exception 'Invalid enrollment status'; end if;
 update public.academy_enrollments set status=case when p_status='removed' then 'cancelled' else p_status end,
 removed_at=case when p_status='removed' then now() else null end,updated_at=now() where id=p_id returning id into sid;
 return sid;
end;$$;
-- Read existing learning history while writes require an active enrollment.
create function academy_private.space_writable(p_space uuid) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.is_admin() or exists(select 1 from public.academy_learning_spaces s join public.academy_enrollments e on e.id=s.enrollment_id where s.id=p_space and e.status='active' and e.removed_at is null and (s.student_id=auth.uid() or public.academy_active_teacher(s.teacher_id))));
$$;
revoke all on function academy_private.space_writable(uuid) from public,anon,authenticated;
grant execute on function academy_private.space_writable(uuid) to authenticated;
do $$declare table_name text;begin
 foreach table_name in array array['academy_notes','academy_resources','academy_messages','academy_session_summaries','academy_test_results'] loop
 execute format('create policy "Active enrollment insert" on public.%I as restrictive for insert to authenticated with check (academy_private.space_writable(learning_space_id))',table_name);
 execute format('create policy "Active enrollment update" on public.%I as restrictive for update to authenticated using (academy_private.space_writable(learning_space_id)) with check (academy_private.space_writable(learning_space_id))',table_name);
 execute format('create policy "Active enrollment delete" on public.%I as restrictive for delete to authenticated using (academy_private.space_writable(learning_space_id))',table_name);
 end loop;
end$$;
