-- Academy advisor cleanup: cover message sender FK and collapse booking UPDATE policies.
create index if not exists academy_messages_sender_idx
  on public.academy_messages(sender_id);

drop policy if exists "academy bookings admin teacher update" on public.academy_bookings;
drop policy if exists "academy bookings student update" on public.academy_bookings;
drop policy if exists "academy bookings member update" on public.academy_bookings;

create policy "academy bookings member update"
on public.academy_bookings for update to authenticated
using (
  student_id = (select auth.uid())
  or exists (
    select 1 from public.academy_teachers t
    where t.id = teacher_id and t.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
)
with check (
  student_id = (select auth.uid())
  or exists (
    select 1 from public.academy_teachers t
    where t.id = teacher_id and t.user_id = (select auth.uid())
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
);
