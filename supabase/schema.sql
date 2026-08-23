-- Supabase SQL Editor에서 한 번 실행하세요.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique,
  display_name text,
  created_at timestamptz not null default now()
);
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into public.profiles (id, email) values (new.id, new.email); return new; end; $$;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

create table public.calendars (
  id uuid primary key default gen_random_uuid(), name text not null check (char_length(name) between 1 and 80),
  color text not null default '#4f46e5', created_by uuid not null references auth.users(id), created_at timestamptz not null default now()
);
create type public.calendar_role as enum ('owner', 'editor', 'viewer');
create table public.calendar_members (
  calendar_id uuid references public.calendars(id) on delete cascade, user_id uuid references auth.users(id) on delete cascade,
  role public.calendar_role not null default 'viewer', primary key (calendar_id, user_id)
);
create table public.events (
  id uuid primary key default gen_random_uuid(), calendar_id uuid not null references public.calendars(id) on delete cascade,
  encrypted_payload text not null, starts_at timestamptz not null, ends_at timestamptz not null, all_day boolean not null default false,
  created_at timestamptz not null default now(), check (ends_at >= starts_at)
);
create or replace function public.is_calendar_member(target_calendar uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.calendar_members where calendar_id = target_calendar and user_id = auth.uid()) $$;
create or replace function public.is_calendar_editor(target_calendar uuid) returns boolean language sql stable security definer set search_path = public as $$ select exists(select 1 from public.calendar_members where calendar_id = target_calendar and user_id = auth.uid() and role in ('owner','editor')) $$;
create or replace function public.add_calendar_owner() returns trigger language plpgsql security definer set search_path = public as $$ begin insert into public.calendar_members(calendar_id,user_id,role) values(new.id,new.created_by,'owner'); return new; end; $$;
create trigger calendar_owner after insert on public.calendars for each row execute procedure public.add_calendar_owner();

alter table public.profiles enable row level security; alter table public.calendars enable row level security; alter table public.calendar_members enable row level security; alter table public.events enable row level security;
create policy "profiles visible to authenticated" on public.profiles for select to authenticated using (true);
create policy "members see calendars" on public.calendars for select using (public.is_calendar_member(id));
create policy "users create calendars" on public.calendars for insert with check (auth.uid() = created_by);
create policy "members see memberships" on public.calendar_members for select using (public.is_calendar_member(calendar_id));
create policy "members see events" on public.events for select using (public.is_calendar_member(calendar_id));
create policy "editors add events" on public.events for insert with check (public.is_calendar_editor(calendar_id));
create policy "editors update events" on public.events for update using (public.is_calendar_editor(calendar_id));
create policy "owners delete events" on public.events for delete using (public.is_calendar_editor(calendar_id));
create or replace function public.invite_calendar_member(target_calendar uuid, target_email text, member_role public.calendar_role) returns void language plpgsql security definer set search_path = public as $$
declare target_user uuid; begin
 if not exists(select 1 from public.calendar_members where calendar_id=target_calendar and user_id=auth.uid() and role='owner') then raise exception 'Only an owner can invite members'; end if;
 select id into target_user from public.profiles where lower(email)=lower(target_email); if target_user is null then raise exception 'The user must sign up first'; end if;
 insert into public.calendar_members(calendar_id,user_id,role) values(target_calendar,target_user,member_role) on conflict(calendar_id,user_id) do update set role=excluded.role;
end; $$;
grant execute on function public.invite_calendar_member(uuid,text,public.calendar_role) to authenticated;
