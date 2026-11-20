alter table public.academy_teachers add column deleted_at timestamptz;
grant select(deleted_at) on public.academy_teachers to authenticated;
create function academy_private.guard_erased_teacher() returns trigger language plpgsql security definer set search_path='' as $$
begin if old.deleted_at is not null then raise exception 'An erased teacher profile cannot be restored';end if;return new;end;$$;
revoke all on function academy_private.guard_erased_teacher() from public,anon,authenticated;
create trigger academy_guard_erased_teacher before update on public.academy_teachers for each row execute function academy_private.guard_erased_teacher();

-- Role-scoped tools: admin actions retain the admin identity and are audited.
create function academy_private.academy_admin_teacher_links(p_teacher uuid,p_write boolean default false,p_teams text default null,p_zoom text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare t public.academy_teachers; result jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501';end if;
 select * into t from public.academy_teachers where id=p_teacher;
 if t.id is null then raise exception 'Teacher not found';end if;
 if p_write is null then raise exception 'Action required';end if;
 if p_write then
  insert into public.academy_teacher_meeting_links(teacher_id,teams_url,zoom_url) values(p_teacher,nullif(trim(p_teams),''),nullif(trim(p_zoom),'')) on conflict(teacher_id) do update set teams_url=excluded.teams_url,zoom_url=excluded.zoom_url;
 end if;
 select jsonb_build_object('teams_url',l.teams_url,'zoom_url',l.zoom_url) into result from public.academy_teacher_meeting_links l where l.teacher_id=p_teacher;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),coalesce(t.user_id,auth.uid()),case when p_write then 'edit_teacher_links' else 'view_teacher_workspace' end,jsonb_build_object('teacher',p_teacher));
 return coalesce(result,'{}'::jsonb);
end;$$;
revoke all on function academy_private.academy_admin_teacher_links(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function academy_private.academy_admin_teacher_links(uuid,boolean,text,text) to authenticated;
create function public.academy_admin_teacher_links(p_teacher uuid,p_write boolean default false,p_teams text default null,p_zoom text default null) returns jsonb language sql security invoker set search_path='' as $$select academy_private.academy_admin_teacher_links(p_teacher,p_write,p_teams,p_zoom)$$;
revoke all on function public.academy_admin_teacher_links(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.academy_admin_teacher_links(uuid,boolean,text,text) to authenticated;

-- Count recorded attendance, including ended memberships; never infer attendance.
create function academy_private.academy_group_attendance_summary(p_space uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.academy_learning_spaces; result jsonb;
begin
 select * into s from public.academy_learning_spaces where id=p_space;
 if auth.uid() is null or s.id is null or not (public.is_admin() or s.student_id=auth.uid() or public.academy_active_teacher(s.teacher_id)) then raise exception 'Space permission required' using errcode='42501';end if;
 select jsonb_build_object('present',count(*) filter(where a.status='present'),'absent',count(*) filter(where a.status='absent'),'excused',count(*) filter(where a.status='excused')) into result
 from public.academy_class_members m join public.academy_class_sessions cs on cs.class_id=m.class_id and cs.status='completed' join public.academy_class_attendance a on a.session_id=cs.id and a.student_id=m.student_id
 where m.learning_space_id=p_space and m.student_id=s.student_id;
 return result;
end;$$;
revoke all on function academy_private.academy_group_attendance_summary(uuid) from public,anon,authenticated;
grant execute on function academy_private.academy_group_attendance_summary(uuid) to authenticated;
create function public.academy_group_attendance_summary(p_space uuid) returns jsonb language sql security invoker set search_path='' as $$select academy_private.academy_group_attendance_summary(p_space)$$;
revoke all on function public.academy_group_attendance_summary(uuid) from public,anon,authenticated;
grant execute on function public.academy_group_attendance_summary(uuid) to authenticated;

-- Messages are sent from the administrator, never impersonating a participant.
create function academy_private.academy_admin_send_message(p_space uuid,p_recipient uuid,p_body text) returns void language plpgsql security definer set search_path='' as $$
declare s public.academy_learning_spaces; teacher_user uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501';end if;
 select * into s from public.academy_learning_spaces where id=p_space;
 select user_id into teacher_user from public.academy_teachers where id=s.teacher_id;
 if s.id is null or p_recipient is null or p_recipient=auth.uid() or (p_recipient is distinct from s.student_id and p_recipient is distinct from teacher_user) then raise exception 'Choose a classroom participant';end if;
 if p_body is null or length(trim(p_body))=0 or length(p_body)>5000 then raise exception 'Invalid message';end if;
 insert into public.academy_messages(learning_space_id,sender_id,recipient_id,body) values(p_space,auth.uid(),p_recipient,trim(p_body));
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),p_recipient,'send_admin_message',jsonb_build_object('space',p_space));
end;$$;
revoke all on function academy_private.academy_admin_send_message(uuid,uuid,text) from public,anon,authenticated;
grant execute on function academy_private.academy_admin_send_message(uuid,uuid,text) to authenticated;
create function public.academy_admin_send_message(p_space uuid,p_recipient uuid,p_body text) returns void language sql security invoker set search_path='' as $$select academy_private.academy_admin_send_message(p_space,p_recipient,p_body)$$;
revoke all on function public.academy_admin_send_message(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.academy_admin_send_message(uuid,uuid,text) to authenticated;

-- Record administrator changes made through the existing role panels without storing content.
create function academy_private.audit_admin_panel_change() returns trigger language plpgsql security definer set search_path='' as $$
declare row_data jsonb; target uuid; space_id uuid; teacher_user uuid;
begin
 if auth.uid() is null or not public.is_admin() then if tg_op='DELETE' then return old;else return new;end if;end if;
 if tg_op='DELETE' then row_data:=to_jsonb(old);else row_data:=to_jsonb(new);end if;
 if row_data ? 'student_id' then target:=nullif(row_data->>'student_id','')::uuid;end if;
 if target is null and row_data ? 'learning_space_id' then space_id:=nullif(row_data->>'learning_space_id','')::uuid;select student_id into target from public.academy_learning_spaces where id=space_id;end if;
 if target is null and row_data ? 'teacher_id' then select user_id into teacher_user from public.academy_teachers where id=nullif(row_data->>'teacher_id','')::uuid;target:=teacher_user;end if;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),coalesce(target,auth.uid()),'panel_'||lower(tg_op),jsonb_build_object('table',tg_table_name,'record',coalesce(row_data->>'id',row_data->>'session_id',row_data->>'class_id'),'space',space_id));
 if tg_op='DELETE' then return old;else return new;end if;
end;$$;
revoke all on function academy_private.audit_admin_panel_change() from public,anon,authenticated;
do $$declare tab text;begin
 foreach tab in array array['academy_learning_spaces','academy_notes','academy_resources','academy_bookings','academy_availability','academy_class_sessions','academy_class_attendance','academy_class_members','academy_classes','academy_session_summaries','academy_test_results','academy_class_posts','academy_class_requests','academy_session_requests','academy_makeup_proposals','academy_makeup_votes','academy_time_off','academy_teachers','academy_course_plans','academy_posts','academy_post_translations'] loop
  execute format('create trigger academy_audit_admin_panel_change after insert or update or delete on public.%I for each row execute function academy_private.audit_admin_panel_change()',tab);
 end loop;
end$$;

-- Preview every dependency before deletion. Course links, reusable links and unused
-- availability are removed atomically; historical records are never cascaded.
create function academy_private.academy_admin_teacher_delete_impact(p_teacher uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare fk record; n bigint; result jsonb:='[]'::jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501';end if;
 if not exists(select 1 from public.academy_teachers where id=p_teacher) then raise exception 'Teacher not found';end if;
 for fk in select con.conrelid::regclass as tab,att.attname as col from pg_catalog.pg_constraint con join pg_catalog.pg_attribute att on att.attrelid=con.conrelid and att.attnum=con.conkey[1] where con.contype='f' and con.confrelid='public.academy_teachers'::regclass and array_length(con.conkey,1)=1 loop
  execute format('select count(*) from %s where %I=$1',fk.tab,fk.col) into n using p_teacher;
  if n>0 then result:=result||jsonb_build_array(jsonb_build_object('table',fk.tab::text,'count',n));end if;
 end loop;
 return result;
end;$$;
revoke all on function academy_private.academy_admin_teacher_delete_impact(uuid) from public,anon,authenticated;
grant execute on function academy_private.academy_admin_teacher_delete_impact(uuid) to authenticated;
create function public.academy_admin_teacher_delete_impact(p_teacher uuid) returns jsonb language sql security invoker set search_path='' as $$select academy_private.academy_admin_teacher_delete_impact(p_teacher)$$;
revoke all on function public.academy_admin_teacher_delete_impact(uuid) from public,anon,authenticated;
grant execute on function public.academy_admin_teacher_delete_impact(uuid) to authenticated;
create or replace function academy_private.academy_admin_delete_teacher(p_teacher uuid,p_name text) returns void language plpgsql security definer set search_path='' as $$
declare t public.academy_teachers; fk record; n bigint; total bigint:=0;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501';end if;
 select * into t from public.academy_teachers where id=p_teacher for update;
 if t.id is null or p_name is distinct from t.display_name then raise exception 'Teacher name does not match';end if;
 delete from public.academy_teacher_courses where teacher_id=p_teacher;
 delete from public.academy_teacher_meeting_links where teacher_id=p_teacher;
 delete from public.academy_availability a where a.teacher_id=p_teacher and not exists(select 1 from public.academy_bookings b where b.availability_id=a.id);
 for fk in select con.conrelid::regclass as tab,att.attname as col from pg_catalog.pg_constraint con join pg_catalog.pg_attribute att on att.attrelid=con.conrelid and att.attnum=con.conkey[1] where con.contype='f' and con.confrelid='public.academy_teachers'::regclass and array_length(con.conkey,1)=1 loop
  execute format('select count(*) from %s where %I=$1',fk.tab,fk.col) into n using p_teacher;total:=total+n;
 end loop;
 if total>0 then raise exception 'Teacher has % linked records; transfer or remove dependencies before deletion',total;end if;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),coalesce(t.user_id,auth.uid()),'delete_teacher',jsonb_build_object('teacher',t.id,'name',t.display_name));
 delete from public.academy_teachers where id=p_teacher;
end;$$;

-- Where historical rows must keep their foreign keys, permanently erase the
-- personal profile and retain an anonymous archived marker for those rows.
create function academy_private.academy_admin_erase_teacher_profile(p_teacher uuid,p_name text) returns void language plpgsql security definer set search_path='' as $$
declare t public.academy_teachers;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501';end if;
 select * into t from public.academy_teachers where id=p_teacher for update;
 if t.id is null or p_name is distinct from t.display_name then raise exception 'Teacher name does not match';end if;
 if exists(select 1 from public.academy_enrollments where teacher_id=p_teacher and status='active' and removed_at is null)
  or exists(select 1 from public.academy_classes where teacher_id=p_teacher and status='active')
  or exists(select 1 from public.academy_bookings where teacher_id=p_teacher and status in ('requested','confirmed','in_progress'))
 then raise exception 'Transfer active students and resolve active classes and bookings first';end if;
 delete from public.academy_teacher_courses where teacher_id=p_teacher;
 delete from public.academy_teacher_meeting_links where teacher_id=p_teacher;
 delete from public.academy_availability a where a.teacher_id=p_teacher and not exists(select 1 from public.academy_bookings b where b.availability_id=a.id);
 update public.academy_teachers set user_id=null,display_name='Former teacher',display_name_i18n='{"en":"Former teacher","fa":"استاد پیشین","sv":"Tidigare lärare","de":"Ehemalige Lehrkraft"}'::jsonb,photo_url=null,intro_i18n='{}',teaching_languages='{}',spoken_languages='{}',levels='{}',specialties='{}',email=null,phone=null,teams_chat_url=null,teams_call_url=null,telegram_url=null,instagram_url=null,status='archived',deleted_at=now(),updated_at=now() where id=p_teacher;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),coalesce(t.user_id,auth.uid()),'erase_teacher_profile',jsonb_build_object('teacher',p_teacher,'historical_marker_retained',true));
end;$$;
revoke all on function academy_private.academy_admin_erase_teacher_profile(uuid,text) from public,anon,authenticated;
grant execute on function academy_private.academy_admin_erase_teacher_profile(uuid,text) to authenticated;
create function public.academy_admin_erase_teacher_profile(p_teacher uuid,p_name text) returns void language sql security invoker set search_path='' as $$select academy_private.academy_admin_erase_teacher_profile(p_teacher,p_name)$$;
revoke all on function public.academy_admin_erase_teacher_profile(uuid,text) from public,anon,authenticated;
grant execute on function public.academy_admin_erase_teacher_profile(uuid,text) to authenticated;

-- Administrator-created teacher articles are explicitly attributed and audited.
create function academy_private.academy_admin_create_teacher_post(p_author uuid,p_locale text,p_category text,p_title text,p_body text,p_video_url text,p_keywords text[],p_description text,p_status text) returns uuid language plpgsql security definer set search_path='' as $$
declare pid uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501';end if;
 if not exists(select 1 from public.academy_teachers where user_id=p_author and status='active' and deleted_at is null) then raise exception 'Active linked teacher required';end if;
 pid:=public.academy_save_post(null,p_locale,p_category,p_title,p_body,p_video_url,p_keywords,p_description,p_status);
 update public.academy_posts set author_id=p_author where id=pid;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),p_author,'create_teacher_post',jsonb_build_object('post',pid));
 return pid;
end;$$;
revoke all on function academy_private.academy_admin_create_teacher_post(uuid,text,text,text,text,text,text[],text,text) from public,anon,authenticated;
grant execute on function academy_private.academy_admin_create_teacher_post(uuid,text,text,text,text,text,text[],text,text) to authenticated;
create function public.academy_admin_create_teacher_post(p_author uuid,p_locale text,p_category text,p_title text,p_body text,p_video_url text,p_keywords text[],p_description text,p_status text) returns uuid language sql security invoker set search_path='' as $$select academy_private.academy_admin_create_teacher_post(p_author,p_locale,p_category,p_title,p_body,p_video_url,p_keywords,p_description,p_status)$$;
revoke all on function public.academy_admin_create_teacher_post(uuid,text,text,text,text,text,text[],text,text) from public,anon,authenticated;
grant execute on function public.academy_admin_create_teacher_post(uuid,text,text,text,text,text,text[],text,text) to authenticated;
