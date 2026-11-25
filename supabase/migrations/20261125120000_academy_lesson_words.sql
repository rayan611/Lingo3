-- Phase 1: words a teacher publishes after a lesson, delivered to the student's Lingo3 App.
-- Writes go only through academy_publish_lesson(); nothing is visible to the student until the teacher publishes.
create table public.academy_lesson_words (
 id uuid primary key default gen_random_uuid(),
 learning_space_id uuid not null references public.academy_learning_spaces(id) on delete cascade,
 summary_id uuid references public.academy_session_summaries(id) on delete set null,
 teacher_id uuid not null references public.academy_teachers(id) on delete restrict,
 student_id uuid not null references auth.users(id) on delete cascade,
 lang text not null check(lang in ('en','sv','de','fa','es','ru','it','fr')),
 word text not null check(length(trim(word)) between 1 and 80),
 meaning text not null default '' check(length(meaning)<=200),
 example text not null default '' check(length(example)<=300),
 created_at timestamptz not null default now()
);
create unique index academy_lesson_words_unique on public.academy_lesson_words(learning_space_id,lang,lower(trim(word)));
create index academy_lesson_words_student_idx on public.academy_lesson_words(student_id,created_at desc);
alter table public.academy_lesson_words enable row level security;
revoke all on public.academy_lesson_words from public,anon,authenticated;
grant select on public.academy_lesson_words to authenticated;
create policy "Lesson words student or teacher read" on public.academy_lesson_words for select to authenticated
using(student_id=(select auth.uid()) or public.academy_space_access(learning_space_id));

create function public.academy_publish_lesson(p_space uuid,p_booking uuid,p_covered text,p_weak text,p_homework text,p_words jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.academy_learning_spaces; sid uuid; w jsonb; added int:=0; n int; wl text; ww text;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into s from public.academy_learning_spaces where id=p_space;
 if not found or not(public.is_admin() or public.academy_active_teacher(s.teacher_id)) then raise exception 'Teacher permission required' using errcode='42501'; end if;
 if coalesce(trim(p_covered),'')='' then raise exception 'Describe what was covered'; end if;
 if length(p_covered)>4000 or length(coalesce(p_weak,''))>2000 or length(coalesce(p_homework,''))>2000 then raise exception 'Text too long'; end if;
 if p_words is null or jsonb_typeof(p_words)<>'array' then p_words:='[]'::jsonb; end if;
 if jsonb_array_length(p_words)>40 then raise exception 'At most 40 words per lesson'; end if;
 if p_booking is not null and not exists(select 1 from public.academy_bookings b where b.id=p_booking and b.teacher_id=s.teacher_id and b.student_id=s.student_id) then raise exception 'Booking does not belong to this student'; end if;
 insert into public.academy_session_summaries(learning_space_id,booking_id,teacher_id,student_id,covered,improve_next,next_focus)
 values(s.id,p_booking,s.teacher_id,s.student_id,trim(p_covered),nullif(trim(coalesce(p_weak,'')),''),nullif(trim(coalesce(p_homework,'')),'')) returning id into sid;
 for w in select * from jsonb_array_elements(p_words) loop
  wl:=lower(trim(coalesce(w->>'lang','')));ww:=trim(coalesce(w->>'word',''));
  continue when ww='' ;
  insert into public.academy_lesson_words(learning_space_id,summary_id,teacher_id,student_id,lang,word,meaning,example)
  values(s.id,sid,s.teacher_id,s.student_id,wl,ww,left(trim(coalesce(w->>'meaning','')),200),left(trim(coalesce(w->>'example','')),300))
  on conflict do nothing;
  get diagnostics n=row_count; added:=added+n;
 end loop;
 insert into public.academy_notifications(user_id,actor_id,event,body)
 values(s.student_id,auth.uid(),'lesson_published','Your teacher published a lesson summary'||case when added>0 then ' and '||added||' new word'||case when added=1 then '' else 's' end else '' end||'.');
 return jsonb_build_object('summary_id',sid,'words_added',added);
end;$$;
revoke all on function public.academy_publish_lesson(uuid,uuid,text,text,text,jsonb) from public,anon;
grant execute on function public.academy_publish_lesson(uuid,uuid,text,text,text,jsonb) to authenticated;
