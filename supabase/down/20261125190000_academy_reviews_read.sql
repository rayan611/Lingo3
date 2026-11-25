drop policy if exists "Reviews public when enabled" on public.academy_reviews;
drop policy if exists "Reviews visible to signed in" on public.academy_reviews;
revoke select on public.academy_reviews from anon,authenticated;
drop index if exists public.academy_reviews_teacher_idx;
drop function if exists public.academy_reviews_on();
drop function if exists academy_private.reviews_enabled();
