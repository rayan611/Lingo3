-- RETURNING on an INSERT evaluates SELECT policies before the new ID can be
-- found by a separate table lookup. Check the candidate row's membership.
drop policy "academy active classroom read" on public.academy_learning_spaces;
create policy "academy active classroom read" on public.academy_learning_spaces
as restrictive for select to authenticated using (
 public.is_admin() or student_id=(select auth.uid()) or
 (public.academy_active_teacher(teacher_id) and exists(
 select 1 from public.academy_enrollments e
 where e.id=academy_learning_spaces.enrollment_id and e.status<>'cancelled'
 )));
