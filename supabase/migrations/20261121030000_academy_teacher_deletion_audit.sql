-- Audit immutable IDs for successfully removed teacher profiles, without preserving PII.
create table if not exists public.academy_teacher_deletion_audit (
 teacher_id uuid primary key,
 deleted_at timestamptz not null default now(),
 deleted_by uuid references auth.users(id) on delete set null
);
alter table public.academy_teacher_deletion_audit enable row level security;
revoke all on public.academy_teacher_deletion_audit from anon, authenticated;
grant select on public.academy_teacher_deletion_audit to authenticated;
drop policy if exists "admin read teacher deletion audit" on public.academy_teacher_deletion_audit;
create policy "admin read teacher deletion audit" on public.academy_teacher_deletion_audit
 for select to authenticated
 using (exists(select 1 from public.user_settings s where s.user_id=(select auth.uid()) and s.is_admin));
create or replace function public.academy_record_teacher_deletion()
returns trigger language plpgsql security definer
set search_path=pg_catalog,public as $$
begin
 insert into public.academy_teacher_deletion_audit (teacher_id,deleted_at,deleted_by)
 values (old.id,now(),(select auth.uid()))
 on conflict (teacher_id) do nothing;
 return old;
end
$$;
revoke all on function public.academy_record_teacher_deletion() from public,anon,authenticated;
drop trigger if exists academy_teacher_delete_audit on public.academy_teachers;
create trigger academy_teacher_delete_audit after delete on public.academy_teachers
 for each row execute function public.academy_record_teacher_deletion();
