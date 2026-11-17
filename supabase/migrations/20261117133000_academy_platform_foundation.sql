-- Lingo3 Academy configurable catalogue, roles-by-data, enrolment and learning-space foundation.
-- Additive only. Existing Lingo3 vocabulary tables are untouched.

create table if not exists public.academy_courses (
  id uuid primary key default gen_random_uuid(),
  subject_code text not null check (char_length(subject_code) between 2 and 40),
  level_code text not null check (char_length(level_code) between 1 and 20),
  title_i18n jsonb not null default '{}'::jsonb,
  description_i18n jsonb not null default '{}'::jsonb,
  topics_i18n jsonb not null default '{}'::jsonb,
  delivery_modes text[] not null default array['individual_online']::text[],
  price_sek numeric(10,2),
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 240),
  telegram_url text,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_teachers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  display_name text not null check (char_length(display_name) between 1 and 120),
  photo_url text,
  intro_i18n jsonb not null default '{}'::jsonb,
  teaching_languages text[] not null default '{}'::text[],
  spoken_languages text[] not null default '{}'::text[],
  levels text[] not null default '{}'::text[],
  specialties text[] not null default '{}'::text[],
  email text,
  phone text,
  teams_chat_url text,
  teams_call_url text,
  telegram_url text,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_teacher_courses (
  teacher_id uuid not null references public.academy_teachers(id) on delete cascade,
  course_id uuid not null references public.academy_courses(id) on delete cascade,
  primary key (teacher_id, course_id)
);

create table if not exists public.academy_enrollments (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.academy_courses(id) on delete restrict,
  teacher_id uuid references public.academy_teachers(id) on delete set null,
  status text not null default 'interested' check (status in ('interested','active','completed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(student_id, course_id, teacher_id)
);

create table if not exists public.academy_learning_spaces (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid unique references public.academy_enrollments(id) on delete cascade,
  student_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid references public.academy_teachers(id) on delete set null,
  course_id uuid not null references public.academy_courses(id) on delete restrict,
  goal text,
  current_level text,
  target_level text,
  progress integer not null default 0 check (progress between 0 and 100),
  next_session_topics text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_notes (
  id uuid primary key default gen_random_uuid(),
  learning_space_id uuid not null references public.academy_learning_spaces(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 20000),
  visibility text not null default 'private' check (visibility in ('private','shared')),
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.academy_bookings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references auth.users(id) on delete cascade,
  teacher_id uuid not null references public.academy_teachers(id) on delete restrict,
  course_id uuid references public.academy_courses(id) on delete set null,
  session_type text not null default 'trial' check (session_type in ('trial','individual','small_group','offline_intro')),
  preferred_start timestamptz,
  status text not null default 'requested' check (status in ('requested','confirmed','in_progress','completed','cancelled_student','cancelled_teacher','cancelled_admin','no_show')),
  meeting_url text,
  student_message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists academy_courses_public_idx on public.academy_courses(status, subject_code, level_code, sort_order);
create index if not exists academy_teachers_public_idx on public.academy_teachers(status, display_name);
create index if not exists academy_enrollments_student_idx on public.academy_enrollments(student_id, status);
create index if not exists academy_learning_spaces_student_idx on public.academy_learning_spaces(student_id);
create index if not exists academy_bookings_student_idx on public.academy_bookings(student_id, status);

alter table public.academy_courses enable row level security;
alter table public.academy_teachers enable row level security;
alter table public.academy_teacher_courses enable row level security;
alter table public.academy_enrollments enable row level security;
alter table public.academy_learning_spaces enable row level security;
alter table public.academy_notes enable row level security;
alter table public.academy_bookings enable row level security;

grant select on public.academy_courses, public.academy_teachers, public.academy_teacher_courses to anon;
grant select on public.academy_courses, public.academy_teachers, public.academy_teacher_courses to authenticated;
grant select, insert, update, delete on public.academy_enrollments, public.academy_learning_spaces, public.academy_notes, public.academy_bookings to authenticated;
grant insert, update, delete on public.academy_courses, public.academy_teachers, public.academy_teacher_courses to authenticated;

drop policy if exists "academy courses public active" on public.academy_courses;
create policy "academy courses public active" on public.academy_courses for select to anon, authenticated
using (status = 'active' or exists (
  select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin
));

drop policy if exists "academy courses admin write" on public.academy_courses;
create policy "academy courses admin write" on public.academy_courses for all to authenticated
using (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin))
with check (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin));

drop policy if exists "academy teachers public active" on public.academy_teachers;
create policy "academy teachers public active" on public.academy_teachers for select to anon, authenticated
using (
  status = 'active'
  or user_id = (select auth.uid())
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
);

drop policy if exists "academy teachers admin or self update" on public.academy_teachers;
create policy "academy teachers admin or self update" on public.academy_teachers for update to authenticated
using (
  user_id = (select auth.uid())
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
)
with check (
  user_id = (select auth.uid())
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
);

drop policy if exists "academy teachers admin insert" on public.academy_teachers;
create policy "academy teachers admin insert" on public.academy_teachers for insert to authenticated
with check (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin));

drop policy if exists "academy teachers admin delete" on public.academy_teachers;
create policy "academy teachers admin delete" on public.academy_teachers for delete to authenticated
using (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin));

drop policy if exists "academy teacher courses public visible" on public.academy_teacher_courses;
create policy "academy teacher courses public visible" on public.academy_teacher_courses for select to anon, authenticated
using (
  exists (select 1 from public.academy_courses c where c.id = course_id and c.status = 'active')
  and exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.status = 'active')
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
);

drop policy if exists "academy teacher courses admin write" on public.academy_teacher_courses;
create policy "academy teacher courses admin write" on public.academy_teacher_courses for all to authenticated
using (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin))
with check (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin));

drop policy if exists "academy enrollments student read" on public.academy_enrollments;
create policy "academy enrollments student read" on public.academy_enrollments for select to authenticated
using (
  student_id = (select auth.uid())
  or exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
);

drop policy if exists "academy enrollments student interest" on public.academy_enrollments;
create policy "academy enrollments student interest" on public.academy_enrollments for insert to authenticated
with check (student_id = (select auth.uid()) and status = 'interested');

drop policy if exists "academy enrollments admin update" on public.academy_enrollments;
create policy "academy enrollments admin update" on public.academy_enrollments for update to authenticated
using (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin))
with check (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin));

drop policy if exists "academy learning spaces members read" on public.academy_learning_spaces;
create policy "academy learning spaces members read" on public.academy_learning_spaces for select to authenticated
using (
  student_id = (select auth.uid())
  or exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
);

drop policy if exists "academy learning spaces members update" on public.academy_learning_spaces;
create policy "academy learning spaces members update" on public.academy_learning_spaces for update to authenticated
using (
  student_id = (select auth.uid())
  or exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
)
with check (
  student_id = (select auth.uid())
  or exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
);

drop policy if exists "academy learning spaces admin insert" on public.academy_learning_spaces;
create policy "academy learning spaces admin insert" on public.academy_learning_spaces for insert to authenticated
with check (exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin));

drop policy if exists "academy notes member read" on public.academy_notes;
create policy "academy notes member read" on public.academy_notes for select to authenticated
using (
  author_id = (select auth.uid())
  or (
    visibility = 'shared'
    and exists (
      select 1 from public.academy_learning_spaces ls
      where ls.id = learning_space_id
        and (
          ls.student_id = (select auth.uid())
          or exists (select 1 from public.academy_teachers t where t.id = ls.teacher_id and t.user_id = (select auth.uid()))
          or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
        )
    )
  )
);

drop policy if exists "academy notes member insert" on public.academy_notes;
create policy "academy notes member insert" on public.academy_notes for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.academy_learning_spaces ls
    where ls.id = learning_space_id
      and (
        ls.student_id = (select auth.uid())
        or exists (select 1 from public.academy_teachers t where t.id = ls.teacher_id and t.user_id = (select auth.uid()))
        or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
      )
  )
);

drop policy if exists "academy bookings member read" on public.academy_bookings;
create policy "academy bookings member read" on public.academy_bookings for select to authenticated
using (
  student_id = (select auth.uid())
  or exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
);

drop policy if exists "academy bookings student request" on public.academy_bookings;
create policy "academy bookings student request" on public.academy_bookings for insert to authenticated
with check (student_id = (select auth.uid()) and status = 'requested');

drop policy if exists "academy bookings admin teacher update" on public.academy_bookings;
create policy "academy bookings admin teacher update" on public.academy_bookings for update to authenticated
using (
  exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
)
with check (
  exists (select 1 from public.academy_teachers t where t.id = teacher_id and t.user_id = (select auth.uid()))
  or exists (select 1 from public.user_settings s where s.user_id = (select auth.uid()) and s.is_admin)
);

-- Initial editable course catalogue. No teachers are invented.
insert into public.academy_courses
(subject_code, level_code, title_i18n, description_i18n, topics_i18n, delivery_modes, duration_minutes, status, sort_order)
select *
from (values
('sv','A1',
 '{"en":"Swedish A1","sv":"Svenska A1","fa":"سوئدی A1"}'::jsonb,
 '{"en":"Foundation Swedish for everyday situations.","sv":"Grundläggande svenska för vardagliga situationer.","fa":"سوئدی پایه برای موقعیت‌های روزمره."}'::jsonb,
 '{"en":["Introductions and greetings","Numbers, time and dates","Family and daily routines","Basic word order","Present tense and common verbs"],"sv":["Presentation och hälsningar","Siffror, tid och datum","Familj och vardagsrutiner","Grundläggande ordföljd","Presens och vanliga verb"],"fa":["معرفی و سلام و احوالپرسی","اعداد، ساعت و تاریخ","خانواده و کارهای روزانه","ترتیب پایه کلمات","زمان حال و فعل‌های پرکاربرد"]}'::jsonb,
 array['individual_online','small_group_online','offline_intro']::text[],60,'active',10),
('sv','A2',
 '{"en":"Swedish A2","sv":"Svenska A2","fa":"سوئدی A2"}'::jsonb,
 '{"en":"Build confidence in everyday speaking, reading and writing.","sv":"Bygg trygghet i vardagligt tal, läsning och skrivning.","fa":"تقویت اعتمادبه‌نفس در مکالمه، خواندن و نوشتن روزمره."}'::jsonb,
 '{"en":["Past and future time","Work and study situations","Shopping, health and travel","Subordinate clauses","Longer everyday conversations"],"sv":["Dåtid och framtid","Arbete och studier","Shopping, hälsa och resor","Bisatser","Längre vardagssamtal"],"fa":["زمان گذشته و آینده","موقعیت‌های کار و تحصیل","خرید، سلامت و سفر","جمله‌های وابسته","مکالمات روزمره طولانی‌تر"]}'::jsonb,
 array['individual_online','small_group_online','offline_intro']::text[],60,'active',20),
('sv','B1',
 '{"en":"Swedish B1","sv":"Svenska B1","fa":"سوئدی B1"}'::jsonb,
 '{"en":"Independent Swedish for work, study and social life.","sv":"Självständig svenska för arbete, studier och socialt liv.","fa":"سوئدی مستقل برای کار، تحصیل و زندگی اجتماعی."}'::jsonb,
 '{"en":["Opinions and arguments","Workplace communication","Formal and informal writing","News and society","Fluency and pronunciation"],"sv":["Åsikter och argument","Kommunikation på jobbet","Formellt och informellt skrivande","Nyheter och samhälle","Flyt och uttal"],"fa":["بیان نظر و استدلال","ارتباط در محیط کار","نوشتار رسمی و غیررسمی","اخبار و جامعه","روانی گفتار و تلفظ"]}'::jsonb,
 array['individual_online','small_group_online','offline_intro']::text[],60,'active',30),
('en','A1',
 '{"en":"English A1","sv":"Engelska A1","fa":"انگلیسی A1"}'::jsonb,
 '{"en":"Practical beginner English for everyday communication.","sv":"Praktisk nybörjarengelska för vardaglig kommunikation.","fa":"انگلیسی مقدماتی و کاربردی برای ارتباط روزمره."}'::jsonb,
 '{"en":["Greetings","Everyday vocabulary","Basic questions","Present simple","Listening and pronunciation"],"sv":["Hälsningar","Vardagsord","Grundfrågor","Presens","Hörförståelse och uttal"],"fa":["سلام و معرفی","واژگان روزمره","سؤال‌های پایه","حال ساده","شنیدار و تلفظ"]}'::jsonb,
 array['individual_online','small_group_online','offline_intro']::text[],60,'active',40),
('de','A1',
 '{"en":"German A1","sv":"Tyska A1","fa":"آلمانی A1"}'::jsonb,
 '{"en":"German foundations with practical speaking and grammar.","sv":"Tyska grunder med praktiskt tal och grammatik.","fa":"مبانی آلمانی با مکالمه و گرامر کاربردی."}'::jsonb,
 '{"en":["Greetings","Noun gender and articles","Core verbs","Numbers and time","Simple conversations"],"sv":["Hälsningar","Substantivens genus och artiklar","Vanliga verb","Siffror och tid","Enkla samtal"],"fa":["سلام و معرفی","جنس اسم و حروف تعریف","فعل‌های اصلی","اعداد و زمان","مکالمات ساده"]}'::jsonb,
 array['individual_online','small_group_online','offline_intro']::text[],60,'active',50),
('fa','A1',
 '{"en":"Persian A1","sv":"Persiska A1","fa":"فارسی A1"}'::jsonb,
 '{"en":"Beginner Persian for practical conversation and reading.","sv":"Persiska för nybörjare med praktiska samtal och läsning.","fa":"فارسی مقدماتی برای مکالمه و خواندن کاربردی."}'::jsonb,
 '{"en":["Persian script","Greetings","Everyday phrases","Present tense","Family and daily life"],"sv":["Persiskt alfabet","Hälsningar","Vardagliga fraser","Presens","Familj och vardagsliv"],"fa":["خط فارسی","سلام و معرفی","عبارت‌های روزمره","زمان حال","خانواده و زندگی روزمره"]}'::jsonb,
 array['individual_online','small_group_online','offline_intro']::text[],60,'active',60)
) as seed(subject_code,level_code,title_i18n,description_i18n,topics_i18n,delivery_modes,duration_minutes,status,sort_order)
where not exists (
  select 1 from public.academy_courses c
  where c.subject_code=seed.subject_code and c.level_code=seed.level_code and c.status <> 'archived'
);
