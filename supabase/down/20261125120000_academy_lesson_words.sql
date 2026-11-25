-- Undo for 20261125120000_academy_lesson_words.sql. Drops published lesson words (summaries stay).
drop function if exists public.academy_publish_lesson(uuid,uuid,text,text,text,jsonb);
drop table if exists public.academy_lesson_words;
