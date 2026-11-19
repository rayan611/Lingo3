-- Explicit preview for course closure and individual teacher transfer; history is retained.
create function public.academy_admin_lifecycle(p_kind text,p_id uuid,p_teacher uuid default null,p_expected jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.academy_enrollments;impact jsonb;item record;sid uuid;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin required' using errcode='42501';end if;
 if p_kind not in ('archive_course','transfer') then raise exception 'Invalid operation';end if;
 if p_kind='transfer' then
 select * into e from public.academy_enrollments where id=p_id for update;
 if e.id is null or e.teacher_id is not distinct from p_teacher or not exists(select 1 from public.academy_teachers t join public.academy_teacher_courses tc on tc.teacher_id=t.id where t.id=p_teacher and t.status='active' and tc.course_id=e.course_id) then raise exception 'Select a different eligible teacher';end if;
 if exists(select 1 from public.academy_demo_accounts where student_id=e.student_id) then raise exception 'Demo accounts stay with their owner';end if;
 else perform 1 from public.academy_courses where id=p_id for update;if not found then raise exception 'Course not found';end if;
 end if;
 select jsonb_build_object('bookings',coalesce((select jsonb_agg(id order by id) from public.academy_bookings where course_id=case when p_kind='transfer' then e.course_id else p_id end and (p_kind<>'transfer' or (student_id=e.student_id and teacher_id=e.teacher_id)) and status in ('requested','confirmed') and coalesce(confirmed_start,preferred_start)>now()),'[]'::jsonb),
 'memberships',coalesce((select jsonb_agg(m.class_id order by m.class_id) from public.academy_class_members m join public.academy_classes c on c.id=m.class_id where p_kind='transfer' and c.course_id=e.course_id and c.teacher_id=e.teacher_id and m.student_id=e.student_id and m.status='active'),'[]'::jsonb),
 'sessions',coalesce((select jsonb_agg(s.id order by s.id) from public.academy_class_sessions s join public.academy_classes c on c.id=s.class_id where p_kind='archive_course' and c.course_id=p_id and s.status='confirmed' and s.starts_at>now()),'[]'::jsonb)) into impact;
 if p_expected is null then return impact;end if;
 if p_expected<>impact then raise exception 'Impact changed. Preview again.';end if;
 for item in select value from jsonb_array_elements_text(impact->'bookings') loop update public.academy_bookings set status='cancelled_teacher',teacher_note='Administrative change: '||p_kind where id=item.value::uuid;end loop;
 if p_kind='archive_course' then
 for item in select value from jsonb_array_elements_text(impact->'sessions') loop perform public.academy_session_action(item.value::uuid,'cancel','{"reason":"Course archived"}'::jsonb);end loop;
 update public.academy_courses set status='archived' where id=p_id;
 update public.academy_classes set status='cancelled' where course_id=p_id and status='active';
 else
 update public.academy_class_members set status='cancelled' where student_id=e.student_id and class_id in(select value::uuid from jsonb_array_elements_text(impact->'memberships'));
 perform set_config('academy.transfer',e.id::text,true);
 sid:=public.academy_activate_enrollment(e.id,p_teacher);
 update public.academy_resources set teacher_id=p_teacher where learning_space_id=sid;
 end if;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),coalesce(e.student_id,auth.uid()),p_kind,impact||jsonb_build_object('id',p_id,'teacher',p_teacher));
 return impact;
end;$$;
revoke all on function public.academy_admin_lifecycle(text,uuid,uuid,jsonb) from public,anon;grant execute on function public.academy_admin_lifecycle(text,uuid,uuid,jsonb) to authenticated;
create function academy_private.guard_lifecycle() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='academy_courses' then
 if old.status='active' and new.status<>'active' and (exists(select 1 from public.academy_bookings b where b.course_id=old.id and b.status in('requested','confirmed') and coalesce(b.confirmed_start,b.preferred_start)>now()) or exists(select 1 from public.academy_class_sessions s join public.academy_classes c on c.id=s.class_id where c.course_id=old.id and s.status='confirmed' and s.starts_at>now())) then raise exception 'Use course closure preview to cancel future sessions first';end if;
 elsif tg_table_name='academy_enrollments' then
 if old.status='active' and new.teacher_id is distinct from old.teacher_id and current_setting('academy.transfer',true) is distinct from old.id::text then raise exception 'Use teacher transfer preview';end if;
 end if;
 return new;
end;$$;
revoke all on function academy_private.guard_lifecycle() from public,anon,authenticated;
create trigger academy_lifecycle before update on public.academy_courses for each row execute function academy_private.guard_lifecycle();
create trigger academy_lifecycle before update on public.academy_enrollments for each row execute function academy_private.guard_lifecycle();
-- Prevent real accounts from being added to demo classes and demo records from using real slots.
create function academy_private.guard_demo_boundary() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='academy_class_members' then
 if exists(select 1 from public.academy_demo_accounts d where (d.class_id=new.class_id and d.student_id<>new.student_id) or (d.student_id=new.student_id and d.class_id<>new.class_id)) then raise exception 'Demo classroom is isolated';end if;
 else
 if exists(select 1 from public.academy_demo_accounts d where d.student_id=new.student_id) and (new.availability_id is not null or not exists(select 1 from public.academy_demo_accounts d where d.student_id=new.student_id and d.teacher_id=new.teacher_id and d.course_id=new.course_id)) then raise exception 'Demo cannot occupy real availability';end if;
 end if;return new;
end;$$;
revoke all on function academy_private.guard_demo_boundary() from public,anon,authenticated;
create trigger academy_demo_boundary before insert or update on public.academy_class_members for each row execute function academy_private.guard_demo_boundary();
create trigger academy_demo_boundary before insert or update on public.academy_bookings for each row execute function academy_private.guard_demo_boundary();
-- Named roster for all admin classrooms or one assigned teacher.
create or replace function public.academy_teacher_roster(p_teacher uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(public.is_admin() or public.academy_active_teacher(p_teacher)) then raise exception 'Teacher permission required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(to_jsonb(q)) from(select ls.*,coalesce(nullif(trim(us.display_name),''),nullif(trim(u.raw_user_meta_data->>'full_name'),''),nullif(trim(ls.student_display_name),''),split_part(u.email,'@',1),'Student') as resolved_name,e.status as enrollment_status,exists(select 1 from public.academy_demo_accounts d where d.student_id=ls.student_id) as is_demo,(select count(*) from public.academy_resources r where r.learning_space_id=ls.id and r.kind='homework' and r.student_status='submitted') as awaiting_review from public.academy_learning_spaces ls join public.academy_enrollments e on e.id=ls.enrollment_id join auth.users u on u.id=ls.student_id left join public.user_settings us on us.user_id=u.id where (ls.teacher_id=p_teacher or (p_teacher is null and public.is_admin())) and e.status<>'cancelled' and e.removed_at is null order by us.display_name,ls.created_at)q),'[]');
end;$$;
-- Audit moderation without exposing comment text in the log.
create function academy_private.audit_review() returns trigger language plpgsql security definer set search_path='' as $$begin
 if old.hidden_reason is distinct from new.hidden_reason then insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),new.student_id,'review_moderation',jsonb_build_object('review',new.id,'reason',new.hidden_reason));end if;return new;end;$$;
revoke all on function academy_private.audit_review() from public,anon,authenticated;
create trigger academy_review_audit after update on public.academy_reviews for each row execute function academy_private.audit_review();
