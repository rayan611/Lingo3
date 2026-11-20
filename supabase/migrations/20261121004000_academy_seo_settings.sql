-- Non-destructive SEO metadata overrides. Existing Academy content remains canonical.
create table if not exists public.academy_seo_settings (
  entity_type text not null check(entity_type in ('app','page','course','teacher','post')),
  entity_id text not null check(length(entity_id) between 1 and 100),
  locale text not null check(locale in ('en','sv','fa','de')),
  title text not null default '' check(length(title)<=140),
  description text not null default '' check(length(description)<=360),
  target_keywords text[] not null default '{}'::text[] check(cardinality(target_keywords)<=20),
  image_url text check(image_url is null or (length(image_url)<=1000 and image_url ~ '^https://')),
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key(entity_type,entity_id,locale)
);
create index if not exists academy_seo_settings_updated_at_idx on public.academy_seo_settings(updated_at desc);
alter table public.academy_seo_settings enable row level security;
drop policy if exists "seo published public read" on public.academy_seo_settings;
create policy "seo published public read" on public.academy_seo_settings
 for select to anon, authenticated using (
  entity_type in ('page','app')
  or (entity_type='course' and exists (select 1 from public.academy_courses c where c.id::text=entity_id and c.status='active'))
  or (entity_type='teacher' and exists (select 1 from public.academy_teachers t where t.id::text=entity_id and t.status='active'))
  or (entity_type='post' and exists (select 1 from public.academy_post_translations p where p.post_id::text=entity_id and p.locale=academy_seo_settings.locale and p.status='published'))
  or exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin)
 );
drop policy if exists "seo admin insert" on public.academy_seo_settings;
create policy "seo admin insert" on public.academy_seo_settings for insert to authenticated
 with check (exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin));
drop policy if exists "seo admin update" on public.academy_seo_settings;
create policy "seo admin update" on public.academy_seo_settings for update to authenticated
 using (exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin))
 with check (exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin));
drop policy if exists "seo admin delete" on public.academy_seo_settings;
create policy "seo admin delete" on public.academy_seo_settings for delete to authenticated
 using (exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin));
grant select on public.academy_seo_settings to anon,authenticated;
grant insert,update,delete on public.academy_seo_settings to authenticated;
