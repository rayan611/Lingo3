-- Review queue for words the AI added to the shared bank.
-- AI answers are served at once (people benefit immediately) but stay in the
-- queue until someone approves or rejects them. A rejected concept is no longer
-- served (the read policy and the lookup only see 'ready') and cache_ai_expansion
-- never turns it back on, because it only promotes 'draft' rows.
alter table public.shared_concepts drop constraint if exists shared_concepts_status_check;
alter table public.shared_concepts
  add constraint shared_concepts_status_check check (status in ('draft', 'ready', 'rejected'));
alter table public.shared_concepts add column if not exists reviewed_at timestamptz;
update public.shared_concepts set reviewed_at = now() where source = 'core' and reviewed_at is null;

create or replace view public.shared_review_queue with (security_invoker = true) as
select c.id, c.source_lang, c.lemma, c.pos, c.created_at,
       (select jsonb_object_agg(e.lang, jsonb_build_object('headword', e.headword, 'example', e.example))
          from public.shared_entries e where e.concept_id = c.id) as entries
from public.shared_concepts c
where c.source = 'ai' and c.status = 'ready' and c.reviewed_at is null;
revoke all on public.shared_review_queue from public, anon, authenticated;
grant select on public.shared_review_queue to service_role;

create or replace function public.review_shared_concept(concept uuid, approve boolean)
returns void language sql security invoker set search_path = ''
as $$
  update public.shared_concepts
     set reviewed_at = now(), status = case when approve then 'ready' else 'rejected' end,
         updated_at = now()
   where id = concept and source = 'ai';
$$;
revoke all on function public.review_shared_concept(uuid, boolean) from public, anon, authenticated;
grant execute on function public.review_shared_concept(uuid, boolean) to service_role;
