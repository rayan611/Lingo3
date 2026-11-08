-- Run as the existing database owner. Every fixture and edit is rolled back.
begin;
set local statement_timeout = '20s';
create temporary table lexical_fixture (concept_id uuid, status text);
insert into lexical_fixture values
 (gen_random_uuid(),'ready'),(gen_random_uuid(),'ready'),
 (gen_random_uuid(),'draft'),(gen_random_uuid(),'rejected');
grant select on lexical_fixture to anon, authenticated;
insert into public.shared_concepts(id,source_key,source,source_lang,lemma,pos,tags,status)
select concept_id,'test:stored-form:'||concept_id,'core','en','zzz'||status||concept_id,'verb','{}',status from lexical_fixture;
insert into public.shared_entries(concept_id,lang,headword,morphology,example,source)
select concept_id,'en','to zzz'||status||concept_id,
 jsonb_build_object('kind','verb','base','zzz'||concept_id,'thirdPerson','zzzthird'||concept_id,
 'past','zzzpast'||concept_id,'pastParticiple','zzzpast'||concept_id,
 'additionalForms','zzzsharedcollision','auxiliary','zzzmetadata'),
 'zzzexampleonly','core' from lexical_fixture;
insert into public.shared_entries(concept_id,lang,headword,example,source)
select concept_id,'fa','موقت'||concept_id,'مثال موقت','core' from lexical_fixture;
set local role anon;
do $$
declare r record; word text; result jsonb;
begin
 for r in select * from lexical_fixture loop
   word:='zzzpast'||r.concept_id;
   result:=public.lookup_shared_expansion(word,'en','fa',array['en']);
   if (result is not null) is distinct from (r.status='ready') then raise exception 'RLS/status mismatch: %',r.status; end if;
 end loop;
 if public.lookup_shared_expansion('zzzmetadata','en','fa',array['en']) is not null then raise exception 'Metadata indexed';end if;
 if public.lookup_shared_expansion('zzzexampleonly','en','fa',array['en']) is not null then raise exception 'Example indexed';end if;
 if public.lookup_shared_expansion('zzzsharedcollision','en','fa',array['en']) is not null then raise exception 'Ambiguity not refused';end if;
 if public.lookup_shared_expansion('zzzpas','en','fa',array['en']) is not null then raise exception 'Substring match';end if;
 if public.lookup_shared_expansion('suttit','sv','fa',array['en'])->>'normalisedLemma' is distinct from 'sitta' then raise exception 'Existing Swedish regression';end if;
end $$;
reset role;
update public.shared_entries e set morphology=jsonb_set(morphology,'{additionalForms}',to_jsonb('zzzfreshauto'||e.concept_id))
where e.lang='en' and e.concept_id in(select concept_id from lexical_fixture where status='ready');
set local role authenticated;
do $$
declare r record;
begin
 for r in select * from lexical_fixture where status='ready' loop
  if public.lookup_shared_expansion('zzzfreshauto'||r.concept_id,'en','fa',array['en']) is null then raise exception 'Generated forms not refreshed';end if;
 end loop;
 if public.lookup_shared_expansion('zzzsharedcollision','en','fa',array['en']) is not null then raise exception 'Stale aliases remain';end if;
end $$;
reset role;
rollback;
