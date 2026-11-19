-- Explicit preview for course closure and individual teacher transfer; history is retained.
create or replace function public.academy_admin_lifecycle(p_kind text,p_id uuid,p_teacher uuid default null,p_expected jsonb default null) returns jsonb language plpgsql security definer set search_path='' as $$
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
 -- Keep original authorship on resources and assessment history.
 end if;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),coalesce(e.student_id,auth.uid()),p_kind,impact||jsonb_build_object('id',p_id,'teacher',p_teacher));
 return impact;
end;$$;
revoke all on function public.academy_admin_lifecycle(text,uuid,uuid,jsonb) from public,anon;grant execute on function public.academy_admin_lifecycle(text,uuid,uuid,jsonb) to authenticated;
