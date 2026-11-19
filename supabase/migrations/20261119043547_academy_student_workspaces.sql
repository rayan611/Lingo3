-- Named roster: only the assigned active teacher/admin can resolve identities.
create function public.academy_teacher_roster(p_teacher uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not(public.is_admin() or public.academy_active_teacher(p_teacher)) then raise exception 'Teacher permission required' using errcode='42501'; end if;
 return coalesce((select jsonb_agg(to_jsonb(q)) from (
 select ls.*,coalesce(nullif(trim(us.display_name),''),nullif(trim(u.raw_user_meta_data->>'full_name'),''),nullif(trim(ls.student_display_name),''),split_part(u.email,'@',1),'Student') as resolved_name,
 e.status as enrollment_status,
 (select count(*) from public.academy_resources r where r.learning_space_id=ls.id and r.kind='homework' and r.student_status='submitted') as awaiting_review
 from public.academy_learning_spaces ls join public.academy_enrollments e on e.id=ls.enrollment_id
 join auth.users u on u.id=ls.student_id left join public.user_settings us on us.user_id=u.id
 where ls.teacher_id=p_teacher and e.status<>'cancelled' and e.removed_at is null
 order by us.display_name,ls.created_at)q),'[]');
end;$$;
revoke all on function public.academy_teacher_roster(uuid) from public,anon;
grant execute on function public.academy_teacher_roster(uuid) to authenticated;

create table public.academy_teacher_desk(
 user_id uuid primary key references auth.users(id),
 notes text not null default '' check(length(notes)<=50000),
 materials text not null default '' check(length(materials)<=50000),
 weekly_plan text not null default '' check(length(weekly_plan)<=50000),
 updated_at timestamptz not null default now()
);
alter table public.academy_teacher_desk enable row level security;
revoke all on public.academy_teacher_desk from public,anon,authenticated;
grant select,insert,update on public.academy_teacher_desk to authenticated;
create policy "Private teacher desk" on public.academy_teacher_desk for all to authenticated
using(user_id=auth.uid() and exists(select 1 from public.academy_teachers t where t.user_id=auth.uid() and t.status='active'))
with check(user_id=auth.uid() and exists(select 1 from public.academy_teachers t where t.user_id=auth.uid() and t.status='active'));

-- Keep individual assessment/private messages on the canonical Learning Space.
alter table public.academy_class_members add column learning_space_id uuid references public.academy_learning_spaces(id);
create function academy_private.link_member_space() returns trigger language plpgsql security definer set search_path='' as $$
declare c public.academy_classes; eid uuid; sid uuid;
begin
 if new.status<>'active' then return new; end if;
 select * into c from public.academy_classes where id=new.class_id;
 insert into public.academy_enrollments(student_id,teacher_id,course_id,status)
 values(new.student_id,c.teacher_id,c.course_id,'active')
 on conflict(student_id,course_id,teacher_id) do nothing;
 select id into eid from public.academy_enrollments where student_id=new.student_id and teacher_id=c.teacher_id and course_id=c.course_id;
 if not exists(select 1 from public.academy_enrollments where id=eid and status='active' and removed_at is null) then raise exception 'Restore enrollment before adding to class'; end if;
 insert into public.academy_learning_spaces(enrollment_id,student_id,teacher_id,course_id,student_display_name)
 select eid,new.student_id,c.teacher_id,c.course_id,coalesce(nullif(s.display_name,''),u.raw_user_meta_data->>'full_name',split_part(u.email,'@',1),'Student')
 from auth.users u left join public.user_settings s on s.user_id=u.id where u.id=new.student_id
 on conflict(enrollment_id) do nothing;
 select id into sid from public.academy_learning_spaces where enrollment_id=eid;
 new.learning_space_id:=sid; return new;
end;$$;
revoke all on function academy_private.link_member_space() from public,anon,authenticated;
create trigger academy_link_member_space before insert or update of status on public.academy_class_members for each row execute function academy_private.link_member_space();
update public.academy_class_members set status=status where status='active';
create function public.academy_class_roster(p_class uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.academy_classes c where c.id=p_class and (public.is_admin() or public.academy_active_teacher(c.teacher_id))) then raise exception 'Teacher permission required' using errcode='42501';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('student_id',m.student_id,'learning_space_id',m.learning_space_id,'status',m.status,'display_name',coalesce(nullif(s.display_name,''),u.raw_user_meta_data->>'full_name',split_part(u.email,'@',1),'Student'))) from public.academy_class_members m join auth.users u on u.id=m.student_id left join public.user_settings s on s.user_id=m.student_id where m.class_id=p_class),'[]');
end;$$;
revoke all on function public.academy_class_roster(uuid) from public,anon;
grant execute on function public.academy_class_roster(uuid) to authenticated;

-- Shared class feed contains no grades or submissions. Individual homework copies
-- use existing RLS/field guards; shared source stays separate from each response.
create table public.academy_class_posts(
 id uuid primary key default gen_random_uuid(),class_id uuid not null references public.academy_classes(id),
 author_id uuid not null references auth.users(id),kind text not null check(kind in ('note','message','material','homework')),
 title text not null check(length(title) between 1 and 160),body text not null check(length(body)<=20000),
 due_at timestamptz,created_at timestamptz not null default now()
);
alter table public.academy_class_posts enable row level security;
revoke all on public.academy_class_posts from public,anon,authenticated;
grant select on public.academy_class_posts to authenticated;
create policy "Class feed participants" on public.academy_class_posts for select to authenticated using(academy_private.class_access(class_id));
create function public.academy_publish_class_post(p_class uuid,p_kind text,p_title text,p_body text,p_due timestamptz default null) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.academy_classes; pid uuid; m record;
begin
 select * into c from public.academy_classes where id=p_class for update;
 if auth.uid() is null or c.status<>'active' or not academy_private.class_access(p_class) then raise exception 'Active membership required' using errcode='42501';end if;
 if p_kind<>'message' and not(public.is_admin() or public.academy_active_teacher(c.teacher_id)) then raise exception 'Teacher permission required' using errcode='42501';end if;
 insert into public.academy_class_posts(class_id,author_id,kind,title,body,due_at) values(p_class,auth.uid(),p_kind,trim(p_title),p_body,p_due) returning id into pid;
 if p_kind in ('material','homework') then
 for m in select * from public.academy_class_members where class_id=p_class and status='active' loop
 insert into public.academy_resources(learning_space_id,teacher_id,kind,title,description,due_at) values(m.learning_space_id,c.teacher_id,p_kind,p_title,p_body,p_due);
 end loop;
 end if;
 insert into public.academy_notifications(user_id,actor_id,event,class_id,body) select student_id,auth.uid(),'class_content',p_class,p_title from public.academy_class_members where class_id=p_class and status='active' and student_id<>auth.uid();
 return pid;
end;$$;
revoke all on function public.academy_publish_class_post(uuid,text,text,text,timestamptz) from public,anon;
grant execute on function public.academy_publish_class_post(uuid,text,text,text,timestamptz) to authenticated;

-- Ratings are closed by default, including direct RPC access.
create table public.academy_features(id boolean primary key default true check(id),reviews_enabled boolean not null default false);
insert into public.academy_features values(true,false);
alter table public.academy_features enable row level security;
revoke all on public.academy_features from public,anon,authenticated;
grant select,update on public.academy_features to authenticated;
create policy "Admin feature controls" on public.academy_features for all to authenticated using(public.is_admin()) with check(public.is_admin());
create table public.academy_reviews(
 id uuid primary key default gen_random_uuid(),teacher_id uuid not null references public.academy_teachers(id),student_id uuid not null references auth.users(id),
 booking_id uuid references public.academy_bookings(id),rating integer not null check(rating between 1 and 5),body text not null check(length(body) between 1 and 5000),
 teacher_response text check(length(teacher_response)<=5000),hidden_reason text,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(teacher_id,student_id)
);
create table public.academy_review_reports(id uuid primary key default gen_random_uuid(),review_id uuid not null references public.academy_reviews(id),user_id uuid not null references auth.users(id),reason text not null check(length(reason) between 1 and 2000),created_at timestamptz not null default now(),unique(review_id,user_id));
alter table public.academy_reviews enable row level security;alter table public.academy_review_reports enable row level security;
revoke all on public.academy_reviews,public.academy_review_reports from public,anon,authenticated;
-- No public stars/aggregates until the feature is explicitly enabled in a release.
create function public.academy_review_action(p_action text,p_teacher uuid default null,p_review uuid default null,p_rating integer default null,p_body text default null) returns void
language plpgsql security definer set search_path='' as $$
declare r public.academy_reviews; bid uuid;
begin
 if auth.uid() is null or not exists(select 1 from public.academy_features where reviews_enabled) then raise exception 'Reviews are disabled' using errcode='42501';end if;
 if p_action='submit' then
 select id into bid from public.academy_bookings where teacher_id=p_teacher and student_id=auth.uid() and status='completed' order by confirmed_start desc limit 1;
 if bid is null and not exists(select 1 from public.academy_class_sessions s join public.academy_class_attendance a on a.session_id=s.id where s.teacher_id=p_teacher and s.status='completed' and a.student_id=auth.uid() and a.status='present') then raise exception 'Completed lesson required' using errcode='42501';end if;
 insert into public.academy_reviews(teacher_id,student_id,booking_id,rating,body) values(p_teacher,auth.uid(),bid,p_rating,trim(p_body)) on conflict(teacher_id,student_id) do update set rating=excluded.rating,body=excluded.body,updated_at=now();return;
 end if;
 select * into r from public.academy_reviews where id=p_review for update;
 if r.id is null then raise exception 'Review not found';end if;
 if p_action='reply' and public.academy_active_teacher(r.teacher_id) then update public.academy_reviews set teacher_response=p_body,updated_at=now() where id=r.id;
 elsif p_action='report' then insert into public.academy_review_reports(review_id,user_id,reason) values(r.id,auth.uid(),p_body) on conflict(review_id,user_id) do update set reason=excluded.reason;
 elsif p_action='hide' and public.is_admin() and length(trim(p_body))>0 then
 update public.academy_reviews set hidden_reason=p_body,updated_at=now() where id=r.id;
 else raise exception 'Action not permitted' using errcode='42501';end if;
end;$$;
revoke all on function public.academy_review_action(text,uuid,uuid,integer,text) from public,anon;
grant execute on function public.academy_review_action(text,uuid,uuid,integer,text) to authenticated;
