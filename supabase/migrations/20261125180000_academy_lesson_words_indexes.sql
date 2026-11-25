-- Covering indexes for the two foreign keys on academy_lesson_words that the performance advisor flagged.
create index if not exists academy_lesson_words_summary_idx on public.academy_lesson_words(summary_id);
create index if not exists academy_lesson_words_teacher_idx on public.academy_lesson_words(teacher_id);
