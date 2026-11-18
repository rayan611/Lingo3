begin;
insert into auth.users(id) values('e6181000-0000-4000-8000-000000000001'),('e6181000-0000-4000-8000-000000000002');
insert into public.user_settings(user_id,is_admin,display_name) values('e6181000-0000-4000-8000-000000000001',true,'Role test admin'),('e6181000-0000-4000-8000-000000000002',false,'Role test student') on conflict(user_id) do update set is_admin=excluded.is_admin,display_name=excluded.display_name;
update auth.users set phone='46701234567',raw_user_meta_data='{"username":"qa_roster_user"}' where id='e6181000-0000-4000-8000-000000000002';
set local role authenticated;
select set_config('request.jwt.claim.sub','e6181000-0000-4000-8000-000000000002',true);
do $$begin
 begin perform public.academy_admin_users(); raise exception 'Directory permission failed'; exception when insufficient_privilege then null; end;
 begin perform public.academy_admin_set_admin('e6181000-0000-4000-8000-000000000002',true); raise exception 'Privilege escalation allowed'; exception when insufficient_privilege then null; end;
 begin update public.user_settings set is_admin=true where user_id='e6181000-0000-4000-8000-000000000002'; raise exception 'Direct flag change allowed'; exception when insufficient_privilege then null; end;
end$$;
select set_config('request.jwt.claim.sub','e6181000-0000-4000-8000-000000000001',true);
do $$begin
 if (public.academy_admin_users('46701234567')->>'total')::int<>1 then raise exception 'Phone search failed';end if;
 if (public.academy_admin_users('qa_roster_user')->>'total')::int<>1 then raise exception 'Username search failed';end if;
 if (public.academy_admin_users('Role test','','0')->>'total')::int <>2 then raise exception 'Directory search failed'; end if;
end$$;
select public.academy_admin_set_admin('e6181000-0000-4000-8000-000000000002',true);
select public.academy_admin_set_admin('e6181000-0000-4000-8000-000000000002',true);
select public.academy_admin_set_admin('e6181000-0000-4000-8000-000000000002',false);
do $$begin
 if (select count(*) from public.academy_admin_audit where target_id='e6181000-0000-4000-8000-000000000002')<>2 then raise exception 'Idempotent audit failed'; end if;
end$$;
rollback;
