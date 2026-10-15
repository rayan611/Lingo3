-- Avoid re-evaluating auth helpers for every row in these RLS policies.
-- Keep the existing ownership and admin checks unchanged semantically.
drop policy if exists "stories are private to their owner" on public.stories;
create policy "stories are private to their owner"
  on public.stories for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists suggestions_insert_own on public.suggestions;
create policy suggestions_insert_own
  on public.suggestions for insert to authenticated
  with check (user_id = (select auth.uid()));

drop policy if exists suggestions_select on public.suggestions;
create policy suggestions_select
  on public.suggestions for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

drop policy if exists suggestions_delete_admin on public.suggestions;
create policy suggestions_delete_admin
  on public.suggestions for delete to authenticated
  using ((select public.is_admin()));

drop policy if exists suggestions_update_admin on public.suggestions;
create policy suggestions_update_admin
  on public.suggestions for update to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));
