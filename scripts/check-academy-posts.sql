begin;
insert into auth.users(id) values('e6193000-0000-4000-8000-000000000001'),('e6193000-0000-4000-8000-000000000002'),('e6193000-0000-4000-8000-000000000003');
insert into public.academy_teachers(id,user_id,display_name,status) values('e6193000-0000-4000-8000-000000000010','e6193000-0000-4000-8000-000000000001','Article QA','active'),('e6193000-0000-4000-8000-000000000011','e6193000-0000-4000-8000-000000000003','Other teacher','active');
set local role authenticated;
select set_config('request.jwt.claim.sub','e6193000-0000-4000-8000-000000000001',true);
select set_config('test.post',public.academy_save_post(null,'fa','grammar','متن آزمایشی','متن فارسی',null,array['گرامر'],'توضیح فارسی','published')::text,true);
select public.academy_save_post(current_setting('test.post')::uuid,'en','grammar','English private draft','PRIVATE_DRAFT',null,array['grammar'],'English draft','draft');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin
 if (select count(*) from public.academy_post_translations where post_id=current_setting('test.post')::uuid)<>1 then raise exception 'Private draft leaked';end if;
 if exists(select 1 from public.academy_post_translations where post_id=current_setting('test.post')::uuid and locale='en') then raise exception 'Language fallback leaked draft';end if;
 if not exists(select 1 from public.academy_posts where id=current_setting('test.post')::uuid) then raise exception 'Public post not visible';end if;
end$$;
set local role authenticated;
select set_config('request.jwt.claim.sub','e6193000-0000-4000-8000-000000000002',true);
do $$begin
 begin perform public.academy_save_post(null,'en','exam','Forgery','body',null,'{}','','published');raise exception 'Student publishing allowed';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','e6193000-0000-4000-8000-000000000003',true);
do $$begin
 begin perform public.academy_save_post(current_setting('test.post')::uuid,'en','exam','Forgery','body',null,'{}','','published');raise exception 'Other teacher overwrote post';exception when insufficient_privilege then null;end;
end$$;
select set_config('request.jwt.claim.sub','e6193000-0000-4000-8000-000000000001',true);
do $$begin
 begin perform public.academy_save_post(current_setting('test.post')::uuid,'sv','grammar','Bad URL','','https://youtube.com.evil.example/a','{}','','published');raise exception 'Unsafe host accepted';exception when check_violation then null;end;
end$$;
select public.academy_save_post(current_setting('test.post')::uuid,'en','grammar','Published English','English body',null,'{}','Description','published');
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$begin if (select count(*) from public.academy_post_translations where post_id=current_setting('test.post')::uuid)<>2 then raise exception 'Published translation missing';end if;end$$;
rollback;
