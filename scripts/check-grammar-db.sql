-- Execute inside BEGIN/ROLLBACK. Requires two existing accounts; never commits test rows.
select set_config('grammar.test_owner_a',(select id::text from auth.users order by id limit 1),true);
select set_config('grammar.test_owner_b',(select id::text from auth.users order by id offset 1 limit 1),true);
set local role authenticated;
select set_config('request.jwt.claim.sub',current_setting('grammar.test_owner_a'),true);
do $$
declare t text; p jsonb; n integer; expected timestamptz := '2026-01-01T00:00:00Z';
begin
  foreach t in array array['grammar_sections','grammar_rules'] loop
    p := jsonb_build_object('id','90000000-0000-4000-8000-000000000001','lang','sv','title','Grammar verification');
    execute format('insert into public.%I(id,user_id,updated_at,payload) values($1,$2,$3,$4)',t)
      using '90000000-0000-4000-8000-000000000001'::uuid,current_setting('grammar.test_owner_a')::uuid,expected,p;
    execute format('update public.%I set payload=$1,updated_at=$2 where id=$3 and user_id=$4 and updated_at=$5',t)
      using p || '{"title":"Laptop edit"}',expected+interval '1 millisecond','90000000-0000-4000-8000-000000000001'::uuid,current_setting('grammar.test_owner_a')::uuid,expected;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Owner CAS update failed'; end if;
    execute format('update public.%I set payload=$1 where id=$2 and user_id=$3 and updated_at=$4',t)
      using p || '{"title":"Stale phone edit"}','90000000-0000-4000-8000-000000000001'::uuid,current_setting('grammar.test_owner_a')::uuid,expected;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'Stale write overwrote winner'; end if;
    perform set_config('request.jwt.claim.sub',current_setting('grammar.test_owner_b'),true);
    execute format('select count(*) from public.%I where id=$1',t) into n using '90000000-0000-4000-8000-000000000001'::uuid;
    if n <> 0 then raise exception 'Cross-user read leak'; end if;
    execute format('update public.%I set payload=payload where id=$1',t) using '90000000-0000-4000-8000-000000000001'::uuid;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'Cross-user update leak'; end if;
    execute format('delete from public.%I where id=$1',t) using '90000000-0000-4000-8000-000000000001'::uuid;
    get diagnostics n = row_count;
    if n <> 0 then raise exception 'Cross-user delete leak'; end if;
    begin
      execute format('insert into public.%I(id,user_id,updated_at,payload) values($1,$2,$3,$4)',t)
        using '90000000-0000-4000-8000-000000000002'::uuid,current_setting('grammar.test_owner_a')::uuid,expected,p;
      raise exception 'Forged owner allowed';
    exception when insufficient_privilege then null; end;
    perform set_config('request.jwt.claim.sub',current_setting('grammar.test_owner_a'),true);
    execute format('update public.%I set deleted_at=now(),payload=payload || ''{"deletedAt":1}'' where id=$1',t) using '90000000-0000-4000-8000-000000000001'::uuid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Owner soft delete failed'; end if;
    execute format('delete from public.%I where id=$1',t) using '90000000-0000-4000-8000-000000000001'::uuid;
    get diagnostics n = row_count;
    if n <> 1 then raise exception 'Owner delete failed'; end if;
    -- Leave a temporary owner row to exercise anonymous read isolation.
    execute format('insert into public.%I(id,user_id,updated_at,payload) values($1,$2,$3,$4)',t)
      using '90000000-0000-4000-8000-000000000001'::uuid,current_setting('grammar.test_owner_a')::uuid,expected,p;
  end loop;
end $$;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ declare n integer; t text; begin
  foreach t in array array['grammar_sections','grammar_rules'] loop
    begin
      execute format('select count(*) from public.%I',t) into n;
      if n <> 0 then raise exception 'Anonymous read leak'; end if;
    exception when insufficient_privilege then null; end;
    begin
      execute format('insert into public.%I(id,user_id,updated_at,payload) values($1,$2,now(),''{}'')',t)
        using '90000000-0000-4000-8000-000000000003'::uuid,current_setting('grammar.test_owner_a')::uuid;
      raise exception 'Anonymous insert allowed';
    exception when insufficient_privilege then null; end;
  end loop;
end $$;
reset role;
select 'PASS: owner CRUD, atomic stale-write rejection, soft delete, cross-user read/update/delete denied, forged owner denied, anonymous read/write denied' as result;
