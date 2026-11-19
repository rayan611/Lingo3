drop policy "Published post or editor" on public.academy_posts;
create policy "Published post or editor" on public.academy_posts for select using(exists(select 1 from public.academy_post_translations x where x.post_id=id and x.status='published') or academy_private.post_editor(id));
