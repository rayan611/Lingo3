begin;
insert into auth.users(id,raw_user_meta_data) values('e6192000-0000-4000-8000-000000000001','{}'),('e6192000-0000-4000-8000-000000000002','{"full_name":"Named student"}'),('e6192000-0000-4000-8000-000000000003','{}');
insert into public.academy_courses(id,subject_code,level_code,title_i18n,status) values('e6192000-0000-4000-8000-000000000010','sv','A2','{"en":"Workspace test"}','active');
insert into public.academy_teachers(id,user_id,display_name,status) values('e6192000-0000-4000-8000-000000000020','e6192000-0000-4000-8000-000000000001','Teacher test','active');
insert into public.academy_teacher_courses(teacher_id,course_id) values('e6192000-0000-4000-8000-000000000020','e6192000-0000-4000-8000-000000000010');
set local role authenticated;
select set_config('request.jwt.claim.sub','e6192000-0000-4000-8000-000000000001',true);
select set_config('test.class',public.academy_create_class('e6192000-0000-4000-8000-000000000020','e6192000-0000-4000-8000-000000000010','Workspace test',2)::text,true);
select public.academy_add_class_member(current_setting('test.class')::uuid,'e6192000-0000-4000-8000-000000000002');
select public.academy_add_class_member(current_setting('test.class')::uuid,'e6192000-0000-4000-8000-000000000003');
select public.academy_add_class_member(current_setting('test.class')::uuid,'e6192000-0000-4000-8000-000000000002');
do $$begin
 if (select count(*) from public.academy_learning_spaces where teacher_id='e6192000-0000-4000-8000-000000000020')<>2 then raise exception 'Duplicate/missing space';end if;
 if public.academy_teacher_roster('e6192000-0000-4000-8000-000000000020')->0->>'resolved_name' is null then raise exception 'Roster has no name';end if;
end$$;

select public.academy_schedule_class(current_setting('test.class')::uuid,'2027-08-10 12:00','UTC',60,'once',1);
select set_config('test.session',(select id::text from public.academy_class_sessions where class_id=current_setting('test.class')::uuid),true);
select set_config('test.proposal',public.academy_propose_makeup(current_setting('test.session')::uuid,'2027-08-11 12:00','UTC','Makeup test')::text,true);
select set_config('request.jwt.claim.sub','e6192000-0000-4000-8000-000000000002',true);
select public.academy_answer_makeup(current_setting('test.proposal')::uuid,true);
do $$begin if (select status from public.academy_class_sessions where id=current_setting('test.session')::uuid)<>'confirmed' then raise exception 'Changed before unanimity';end if;end$$;
select set_config('request.jwt.claim.sub','e6192000-0000-4000-8000-000000000003',true);
select public.academy_answer_makeup(current_setting('test.proposal')::uuid,true);
do $$begin if (select status from public.academy_class_sessions where id=current_setting('test.session')::uuid)<>'cancelled' then raise exception 'Original not cancelled';end if;if (select count(*) from public.academy_class_sessions where class_id=current_setting('test.class')::uuid and status='confirmed')<>1 then raise exception 'Replacement missing';end if;end$$;
select set_config('request.jwt.claim.sub','e6192000-0000-4000-8000-000000000001',true);
select set_config('test.impact',public.academy_cancel_range('e6192000-0000-4000-8000-000000000020','2027-08-11 00:00Z','2027-08-12 00:00Z','Time off')::text,true);
select public.academy_cancel_range('e6192000-0000-4000-8000-000000000020','2027-08-11 00:00Z','2027-08-12 00:00Z','Time off',current_setting('test.impact')::jsonb);
do $$declare denied boolean:=false;begin
begin perform public.academy_schedule_class(current_setting('test.class')::uuid,'2027-08-11 14:00','UTC',60,'once',1);exception when raise_exception then denied:=true;end;
if not denied then raise exception 'Time off ignored';end if;
end$$;
rollback;
