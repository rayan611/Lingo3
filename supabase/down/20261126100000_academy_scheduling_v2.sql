drop function if exists public.academy_teacher_schedule_student(uuid,date,text,integer,jsonb,integer);
drop function if exists public.academy_admin_assign_student(uuid,uuid,uuid);
alter table public.academy_bookings drop column if exists alternative_starts;
