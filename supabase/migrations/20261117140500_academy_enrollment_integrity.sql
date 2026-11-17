create unique index if not exists academy_enrollments_unassigned_unique
on public.academy_enrollments(student_id, course_id)
where teacher_id is null and status <> 'cancelled';
