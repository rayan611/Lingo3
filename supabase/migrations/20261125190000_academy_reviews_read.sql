-- Reviews stay OFF until an admin switches them on (academy_features.reviews_enabled).
-- This adds the read side: public (non-hidden) reviews when enabled; own, the teacher's and admin's always.
create function academy_private.reviews_enabled() returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select reviews_enabled from public.academy_features limit 1),false);
$$;
revoke all on function academy_private.reviews_enabled() from public;
grant execute on function academy_private.reviews_enabled() to anon,authenticated;

create function public.academy_reviews_on() returns boolean language sql stable security definer set search_path='' as $$
 select academy_private.reviews_enabled();
$$;
revoke all on function public.academy_reviews_on() from public;
grant execute on function public.academy_reviews_on() to anon,authenticated;

-- Column grant: reviewer ids and booking ids are never exposed through the API.
grant select(id,teacher_id,rating,body,teacher_response,hidden_reason,created_at,updated_at) on public.academy_reviews to anon,authenticated;
create policy "Reviews public when enabled" on public.academy_reviews for select to anon
 using(hidden_reason is null and academy_private.reviews_enabled());
create policy "Reviews visible to signed in" on public.academy_reviews for select to authenticated
 using((hidden_reason is null and academy_private.reviews_enabled()) or student_id=(select auth.uid()) or public.academy_active_teacher(teacher_id) or public.is_admin());
create index if not exists academy_reviews_teacher_idx on public.academy_reviews(teacher_id,created_at desc);
