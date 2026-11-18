-- Administrative identity operations use a checked RPC. Direct flag edits remain blocked.
create table public.academy_admin_audit (
 id uuid primary key default gen_random_uuid(),
 actor_id uuid references auth.users(id) on delete set null,
 target_id uuid references auth.users(id) on delete set null,
 action text not null,
 details jsonb not null default '{}',
 created_at timestamptz not null default now()
);
alter table public.academy_admin_audit enable row level security;
revoke all on public.academy_admin_audit from anon,authenticated;
grant select on public.academy_admin_audit to authenticated;
create policy "Administrators read role history" on public.academy_admin_audit
 for select to authenticated using (public.is_admin());

create function public.academy_admin_users(p_query text default '',p_role text default '',p_page integer default 0)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501'; end if;
 if p_role not in ('','admin','teacher','student') or p_page < 0 then raise exception 'Invalid filter'; end if;
 with users as (
 select u.id as user_id,coalesce(s.display_name,'') as display_name,u.email,
 coalesce(s.is_admin,false) as is_admin,t.id as teacher_id,t.status as teacher_status,u.created_at
 from auth.users u left join public.user_settings s on s.user_id=u.id
 left join public.academy_teachers t on t.user_id=u.id
 where (p_query='' or position(lower(p_query) in lower(coalesce(s.display_name,'')||' '||coalesce(u.email,'')||' '||u.id::text))>0)
 and (p_role='' or (p_role='admin' and s.is_admin) or (p_role='teacher' and t.status='active')
 or (p_role='student' and exists(select 1 from public.academy_enrollments e where e.student_id=u.id and e.status='active')))
 ), page as (select * from users order by created_at desc,user_id limit 25 offset p_page*25)
 select jsonb_build_object('total',(select count(*) from users),'users',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]')) into result;
 return result;
end;$$;

create function public.academy_admin_set_admin(p_user_id uuid,p_enabled boolean)
returns void language plpgsql security definer set search_path='' as $$
declare previous boolean;
begin
 -- Serialize administrator mutations, including concurrent removal of the last two administrators.
 perform pg_advisory_xact_lock(611,3001);
 if auth.uid() is null or not public.is_admin() then raise exception 'Admin permission required' using errcode='42501'; end if;
 if p_enabled is null or not exists(select 1 from auth.users where id=p_user_id) then raise exception 'Invalid user'; end if;
 select is_admin into previous from public.user_settings where user_id=p_user_id;
 if coalesce(previous,false)=p_enabled then return; end if;
 if not p_enabled and (select count(*) from public.user_settings where is_admin)<2 then raise exception 'The last administrator cannot be removed'; end if;
 insert into public.user_settings(user_id,is_admin) values(p_user_id,p_enabled)
 on conflict(user_id) do update set is_admin=excluded.is_admin,updated_at=now();
 insert into public.academy_admin_audit(actor_id,target_id,action,details)
 values(auth.uid(),p_user_id,'admin_access',jsonb_build_object('previous',coalesce(previous,false),'enabled',p_enabled));
end;$$;
revoke all on function public.academy_admin_users(text,text,integer),public.academy_admin_set_admin(uuid,boolean) from public,anon,authenticated;
grant execute on function public.academy_admin_users(text,text,integer),public.academy_admin_set_admin(uuid,boolean) to authenticated;
