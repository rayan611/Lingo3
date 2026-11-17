-- Academy policy/index follow-up after Supabase advisors.
drop policy if exists "academy courses admin write" on public.academy_courses;
create policy "academy courses admin insert" on public.academy_courses for insert to authenticated
with check (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin));
create policy "academy courses admin update" on public.academy_courses for update to authenticated
using (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin))
with check (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin));
create policy "academy courses admin delete" on public.academy_courses for delete to authenticated
using (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin));

drop policy if exists "academy teacher courses admin write" on public.academy_teacher_courses;
create policy "academy teacher courses admin insert" on public.academy_teacher_courses for insert to authenticated
with check (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin));
create policy "academy teacher courses admin update" on public.academy_teacher_courses for update to authenticated
using (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin))
with check (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin));
create policy "academy teacher courses admin delete" on public.academy_teacher_courses for delete to authenticated
using (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin));

create index if not exists academy_bookings_teacher_idx on public.academy_bookings(teacher_id);
create index if not exists academy_bookings_course_idx on public.academy_bookings(course_id);
create index if not exists academy_courses_created_by_idx on public.academy_courses(created_by);
create index if not exists academy_enrollments_course_idx on public.academy_enrollments(course_id);
create index if not exists academy_enrollments_teacher_idx on public.academy_enrollments(teacher_id);
create index if not exists academy_learning_spaces_course_idx on public.academy_learning_spaces(course_id);
create index if not exists academy_learning_spaces_teacher_idx on public.academy_learning_spaces(teacher_id);
create index if not exists academy_notes_space_idx on public.academy_notes(learning_space_id);
create index if not exists academy_notes_author_idx on public.academy_notes(author_id);
create index if not exists academy_teacher_courses_course_idx on public.academy_teacher_courses(course_id);
create index if not exists academy_teachers_created_by_idx on public.academy_teachers(created_by);
