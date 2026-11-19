-- One post, four independently edited/published translations. No automatic translation.
create table public.academy_posts (
 id uuid primary key default gen_random_uuid(), author_id uuid not null references auth.users(id),
 category text not null check(category in ('grammar','vocabulary','conversation','exam')),
 original_locale text not null check(original_locale in ('en','fa','sv','de')),
 created_at timestamptz not null default now()
);
create table public.academy_post_translations (
 post_id uuid not null references public.academy_posts(id),locale text not null check(locale in ('en','fa','sv','de')),
 title text not null check(length(trim(title)) between 1 and 160),
 body text not null default '' check(length(body)<=50000),
 video_url text check(video_url is null or video_url ~ '^https://(www\.)?(youtube\.com|youtu\.be|instagram\.com)/[^[:space:]]+$'),
 keywords text[] not null default '{}' check(cardinality(keywords)<=20),
 description text not null default '' check(length(description)<=320),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 published_at timestamptz,updated_at timestamptz not null default now(),
 primary key(post_id,locale),check(length(trim(body))>0 or video_url is not null)
);
create index academy_post_public_idx on public.academy_post_translations(locale,status,published_at desc);
alter table public.academy_posts enable row level security;
alter table public.academy_post_translations enable row level security;
revoke all on public.academy_posts,public.academy_post_translations from public,anon,authenticated;
grant select on public.academy_posts,public.academy_post_translations to anon,authenticated;
create function academy_private.can_edit_post(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (public.is_admin() or exists(select 1 from public.academy_posts p join public.academy_teachers t on t.user_id=p.author_id where p.id=p_id and p.author_id=auth.uid() and t.status='active'));
$$;
revoke all on function academy_private.can_edit_post(uuid) from public,anon;grant execute on function academy_private.can_edit_post(uuid) to authenticated;
create policy "Published post or editor" on public.academy_posts for select using(exists(select 1 from public.academy_post_translations x where x.post_id=id and x.status='published') or (auth.uid()=author_id) or public.is_admin());
-- Independent policy without recursive parent-policy evaluation.
create function academy_private.post_editor(p_id uuid) returns boolean language sql stable security definer set search_path='' as $$ select public.is_admin() or exists(select 1 from public.academy_posts where id=p_id and author_id=auth.uid()); $$;
revoke all on function academy_private.post_editor(uuid) from public;grant execute on function academy_private.post_editor(uuid) to anon,authenticated;
create policy "Published translation or editor" on public.academy_post_translations for select using(status='published' or academy_private.post_editor(post_id));
create function public.academy_save_post(p_id uuid,p_locale text,p_category text,p_title text,p_body text,p_video_url text,p_keywords text[],p_description text,p_status text) returns uuid
language plpgsql security definer set search_path='' as $$
declare pid uuid:=p_id;
begin
 if auth.uid() is null or not(public.is_admin() or exists(select 1 from public.academy_teachers where user_id=auth.uid() and status='active')) then raise exception 'Active teacher or admin required' using errcode='42501';end if;
 if pid is null then insert into public.academy_posts(author_id,category,original_locale) values(auth.uid(),p_category,p_locale) returning id into pid;
 elsif not academy_private.can_edit_post(pid) then raise exception 'Own post required' using errcode='42501';
 else perform 1 from public.academy_posts where id=pid for update; update public.academy_posts set category=p_category where id=pid;
 end if;
 if exists(select 1 from unnest(p_keywords) k where length(k)>80) then raise exception 'Keyword too long';end if;
 insert into public.academy_post_translations(post_id,locale,title,body,video_url,keywords,description,status,published_at)
 values(pid,p_locale,trim(p_title),coalesce(p_body,''),nullif(trim(p_video_url),''),coalesce(p_keywords,'{}'),coalesce(p_description,''),p_status,case when p_status='published' then now() end)
 on conflict(post_id,locale) do update set title=excluded.title,body=excluded.body,video_url=excluded.video_url,keywords=excluded.keywords,description=excluded.description,status=excluded.status,updated_at=now(),published_at=case when excluded.status='published' then coalesce(academy_post_translations.published_at,now()) else academy_post_translations.published_at end;
 insert into public.academy_admin_audit(actor_id,target_id,action,details) values(auth.uid(),auth.uid(),'post_saved',jsonb_build_object('post_id',pid,'locale',p_locale,'status',p_status));
 return pid;
end;$$;
revoke all on function public.academy_save_post(uuid,text,text,text,text,text,text[],text,text) from public,anon;grant execute on function public.academy_save_post(uuid,text,text,text,text,text,text[],text,text) to authenticated;
create function public.academy_share_post(p_post uuid,p_locale text,p_space uuid) returns uuid language plpgsql security definer set search_path='' as $$
declare x public.academy_post_translations;s public.academy_learning_spaces;rid uuid;
begin
 if not academy_private.can_edit_post(p_post) then raise exception 'Post editor required' using errcode='42501';end if;
 select * into s from public.academy_learning_spaces where id=p_space;
 if s.id is null or not (public.is_admin() or public.academy_active_teacher(s.teacher_id)) or not exists(select 1 from public.academy_enrollments where id=s.enrollment_id and status='active' and removed_at is null) then raise exception 'Assigned active classroom required' using errcode='42501';end if;
 select * into x from public.academy_post_translations where post_id=p_post and locale=p_locale;
 if not found then raise exception 'Save this translation first';end if;
 insert into public.academy_resources(learning_space_id,teacher_id,kind,title,description,url) values(s.id,s.teacher_id,'material',x.title,x.body,x.video_url) returning id into rid;
 return rid;
end;$$;
revoke all on function public.academy_share_post(uuid,text,uuid) from public,anon;grant execute on function public.academy_share_post(uuid,text,uuid) to authenticated;
