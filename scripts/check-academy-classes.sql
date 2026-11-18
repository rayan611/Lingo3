begin;
insert into auth.users(id) values('e6182000-0000-4000-8000-000000000001'),('e6182000-0000-4000-8000-000000000002'),('e6182000-0000-4000-8000-000000000003');
insert into public.academy_courses(id,subject_code,level_code,title_i18n,status) values('e6182000-0000-4000-8000-000000000010','sv','A2','{"en":"Group rollback"}','active');
insert into public.academy_teachers(id,user_id,display_name,status) values('e6182000-0000-4000-8000-000000000020','e6182000-0000-4000-8000-000000000001','Teacher rollback','active');
insert into public.academy_teacher_courses(teacher_id,course_id) values('e6182000-0000-4000-8000-000000000020','e6182000-0000-4000-8000-000000000010');
set local role authenticated;
select set_config('request.jwt.claim.sub','e6182000-0000-4000-8000-000000000001',true);
select set_config('test.class',public.academy_create_class('e6182000-0000-4000-8000-000000000020','e6182000-0000-4000-8000-000000000010','Rollback group',1)::text,true);
select public.academy_add_class_member(current_setting('test.class')::uuid,'e6182000-0000-4000-8000-000000000002');
do $$declare rejected boolean:=false;begin
 begin perform public.academy_add_class_member(current_setting('test.class')::uuid,'e6182000-0000-4000-8000-000000000003'); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Capacity exceeded'; end if;
end$$;
select public.academy_schedule_class(current_setting('test.class')::uuid,'2027-03-21 18:00','Europe/Stockholm',60,'weekly',2);
do $$begin
 if (select count(*) from public.academy_class_sessions where class_id=current_setting('test.class')::uuid)<>2 then raise exception 'Recurrence failed'; end if;
 if (select extract(epoch from(max(starts_at)-min(starts_at)))/3600 from public.academy_class_sessions where class_id=current_setting('test.class')::uuid)<>167 then raise exception 'DST failed'; end if;
end$$;
do $$declare rejected boolean:=false;begin
 begin perform public.academy_schedule_class(current_setting('test.class')::uuid,'2027-03-21 18:15','Europe/Stockholm',60,'once',1); exception when raise_exception then rejected:=true; end;
 if not rejected then raise exception 'Overlap allowed'; end if;
end$$;
select set_config('request.jwt.claim.sub','e6182000-0000-4000-8000-000000000002',true);
do $$begin
 if (select count(*) from public.academy_classes where id=current_setting('test.class')::uuid)<>1 then raise exception 'Student cannot read class'; end if;
 if (select count(*) from public.academy_notifications where class_id=current_setting('test.class')::uuid)<>2 then raise exception 'Notifications missing'; end if;
 begin perform public.academy_schedule_class(current_setting('test.class')::uuid,'2027-04-21 18:15','Europe/Stockholm',60,'once',1); raise exception 'Student scheduled'; exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','e6182000-0000-4000-8000-000000000003',true);
do $$begin
 if (select count(*) from public.academy_classes where id=current_setting('test.class')::uuid)<>0 then raise exception 'Class privacy failed'; end if;
 if (select count(*) from public.academy_notifications where class_id=current_setting('test.class')::uuid)<>0 then raise exception 'Notification privacy failed'; end if;
end$$;
reset role;
update public.academy_classes set capacity=2 where id=current_setting('test.class')::uuid;
set local role authenticated;
select set_config('request.jwt.claim.sub','e6182000-0000-4000-8000-000000000003',true);
select public.academy_request_class(current_setting('test.class')::uuid,'Join test');
select set_config('test.request',(select id::text from public.academy_class_requests where class_id=current_setting('test.class')::uuid),true);
select set_config('request.jwt.claim.sub','e6182000-0000-4000-8000-000000000001',true);
select public.academy_resolve_class_request(current_setting('test.request')::uuid,'accepted');
select set_config('request.jwt.claim.sub','e6182000-0000-4000-8000-000000000003',true);
do $$begin if (select count(*) from public.academy_classes where id=current_setting('test.class')::uuid)<>1 then raise exception 'Accepted membership failed';end if;end$$;
select set_config('test.session',(select id::text from public.academy_class_sessions where class_id=current_setting('test.class')::uuid order by starts_at limit 1),true);
select public.academy_session_action(current_setting('test.session')::uuid,'request_cancel','{"reason":"Unavailable"}');
select set_config('test.cancel',(select id::text from public.academy_session_requests where session_id=current_setting('test.session')::uuid),true);
select set_config('request.jwt.claim.sub','e6182000-0000-4000-8000-000000000001',true);
select public.academy_session_action(current_setting('test.session')::uuid,'approve_cancel',jsonb_build_object('request_id',current_setting('test.cancel')));
do $$begin
 if (select status from public.academy_class_sessions where id=current_setting('test.session')::uuid)<>'confirmed' then raise exception 'Individual cancellation cancelled group';end if;
 if (select status from public.academy_class_attendance where session_id=current_setting('test.session')::uuid and student_id='e6182000-0000-4000-8000-000000000003')<>'excused' then raise exception 'Excused attendance missing';end if;
end$$;
select public.academy_session_action(current_setting('test.session')::uuid,'cancel','{"reason":"Teacher unavailable"}');
-- Calendar exposes busy group time to prospective students, but no participant data.
reset role;
insert into public.academy_class_sessions(class_id,teacher_id,starts_at,ends_at,timezone,series_id)
values(current_setting('test.class')::uuid,'e6182000-0000-4000-8000-000000000020',now()+interval '5 days',now()+interval '5 days 1 hour','UTC',gen_random_uuid());
insert into public.academy_availability(teacher_id,starts_at,ends_at,delivery_mode,status)
values('e6182000-0000-4000-8000-000000000020',now()+interval '5 days',now()+interval '5 days 1 hour','online','available');
set local role anon;
do $$ declare rows jsonb; begin
 select jsonb_agg(to_jsonb(c)) into rows from public.academy_teacher_calendar('e6182000-0000-4000-8000-000000000020') c;
 if jsonb_array_length(rows)<>1 or rows->0->>'status'<>'busy' then raise exception 'Calendar falsely advertised occupied slot';end if;
 if rows->0 ? 'student_id' or rows->0 ? 'meeting_url' then raise exception 'Public calendar privacy failed';end if;
end $$;
rollback;
