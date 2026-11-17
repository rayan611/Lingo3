-- Slot status synchronization must work when a student cancels a booking.
-- The trigger function is SECURITY DEFINER only for this narrowly-scoped
-- derived update; it accepts no arguments and is not callable as a normal RPC.
create or replace function public.academy_sync_slot_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.availability_id is null then
    return new;
  end if;

  if new.status in ('confirmed','in_progress','completed','no_show') then
    update public.academy_availability
      set status = 'booked', updated_at = now()
      where id = new.availability_id;
  elsif new.status in ('cancelled_student','cancelled_teacher','cancelled_admin') then
    update public.academy_availability
      set status = 'available', updated_at = now()
      where id = new.availability_id and ends_at > now();
  end if;

  return new;
end;
$$;

revoke all on function public.academy_sync_slot_status() from public;
revoke all on function public.academy_sync_slot_status() from anon;
revoke all on function public.academy_sync_slot_status() from authenticated;

-- Teachers should not delete booked slot history; admin retains full control.
drop policy if exists "academy availability teacher admin delete" on public.academy_availability;
create policy "academy availability teacher admin delete"
on public.academy_availability for delete to authenticated
using (
  (
    status in ('available','blocked','cancelled')
    and exists (
      select 1 from public.academy_teachers t
      where t.id = teacher_id and t.user_id = (select auth.uid())
    )
  )
  or exists (
    select 1 from public.user_settings s
    where s.user_id = (select auth.uid()) and s.is_admin
  )
);
