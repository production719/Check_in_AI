-- เว็บเช็คชื่อคลาส Claude AI — โครงสร้างฐานข้อมูล Supabase (v2.1.0)

-- ===== tables =====
create table public.admins (
  email text primary key,
  created_at timestamptz not null default now()
);

create table public.settings (
  id int primary key default 1 check (id = 1),
  title text not null default 'Claude AI',
  start_time time not null default '09:00',
  grace_minutes int not null default 15 check (grace_minutes between 0 and 600),
  updated_at timestamptz not null default now()
);

create table public.roster (
  id text primary key check (id ~ '^[A-Za-z0-9_\-]{1,40}$'),
  name text not null check (length(name) between 1 and 200),
  org text not null default '',
  name_en text not null default '',
  sort int not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_date date not null,
  roster_id text not null references public.roster(id) on update cascade on delete cascade,
  checked_at timestamptz not null default now(),
  status text not null check (status in ('on_time','late')),
  late_minutes int not null default 0,
  signature text,
  unique (class_date, roster_id)
);
create index attendance_date_idx on public.attendance (class_date);

-- ===== admin check (private schema, not exposed by the API) =====
create schema if not exists private;
grant usage on schema private to anon, authenticated;

create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.admins a
    where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
revoke execute on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- ===== RLS =====
alter table public.admins enable row level security;
alter table public.settings enable row level security;
alter table public.roster enable row level security;
alter table public.attendance enable row level security;

create policy "admins readable by admins" on public.admins for select to authenticated using (private.is_admin());
create policy "settings readable by all" on public.settings for select to anon, authenticated using (true);
create policy "settings writable by admins" on public.settings for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "roster readable by all" on public.roster for select to anon, authenticated using (true);
create policy "roster insert by admins" on public.roster for insert to authenticated with check (private.is_admin());
create policy "roster update by admins" on public.roster for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "roster delete by admins" on public.roster for delete to authenticated using (private.is_admin());
create policy "attendance read by admins" on public.attendance for select to authenticated using (private.is_admin());
create policy "attendance update by admins" on public.attendance for update to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "attendance delete by admins" on public.attendance for delete to authenticated using (private.is_admin());

revoke all on public.attendance from anon;
revoke all on public.admins from anon;

-- ===== API privileges (new projects do not grant these automatically) =====
grant usage on schema public to anon, authenticated;
grant select on public.roster, public.settings to anon, authenticated;
grant insert, update, delete on public.roster to authenticated;
grant update on public.settings to authenticated;
grant select, update, delete on public.attendance to authenticated;
grant select on public.admins to authenticated;

-- ===== student accounts (v2.1.0) =====
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  roster_id text unique references public.roster(id) on update cascade on delete set null,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
grant select, delete on public.profiles to authenticated;
create policy "profiles read own or admin" on public.profiles for select to authenticated using (user_id = auth.uid() or private.is_admin());
create policy "profiles delete by admin" on public.profiles for delete to authenticated using (private.is_admin());

alter table public.attendance add column if not exists checked_by uuid references auth.users(id) on delete set null;
create policy "attendance read own" on public.attendance for select to authenticated
  using (roster_id in (select p.roster_id from public.profiles p where p.user_id = auth.uid()));

create or replace function public.claim_roster(p_roster_id text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare uid uuid := auth.uid();
begin
  if uid is null then return json_build_object('ok', false, 'error', 'not_signed_in'); end if;
  if not exists (select 1 from public.roster where id = p_roster_id and active) then
    return json_build_object('ok', false, 'error', 'unknown_student');
  end if;
  if exists (select 1 from public.profiles where roster_id = p_roster_id and user_id <> uid) then
    return json_build_object('ok', false, 'error', 'taken');
  end if;
  insert into public.profiles (user_id, roster_id, email, updated_at)
  values (uid, p_roster_id, auth.jwt() ->> 'email', now())
  on conflict (user_id) do update set roster_id = excluded.roster_id, email = excluded.email, updated_at = now();
  return json_build_object('ok', true, 'roster_id', p_roster_id);
exception when unique_violation then
  return json_build_object('ok', false, 'error', 'taken');
end;
$$;

create or replace function public.unclaim_my_roster()
returns json language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then return json_build_object('ok', false, 'error', 'not_signed_in'); end if;
  update public.profiles set roster_id = null, updated_at = now() where user_id = auth.uid();
  return json_build_object('ok', true);
end;
$$;

create or replace function public.claimed_roster_ids()
returns setof text language sql stable security definer set search_path = public, pg_temp as $$
  select roster_id from public.profiles where roster_id is not null;
$$;

revoke execute on function public.claim_roster(text) from public;
revoke execute on function public.unclaim_my_roster() from public;
revoke execute on function public.claimed_roster_ids() from public;
grant execute on function public.claim_roster(text) to authenticated;
grant execute on function public.unclaim_my_roster() to authenticated;
grant execute on function public.claimed_roster_ids() to anon, authenticated;

-- ===== public RPCs =====
create or replace function public.check_in(p_roster_id text, p_signature text)
returns json language plpgsql security definer set search_path = public, pg_temp as $$
declare
  s public.settings; local_ts timestamp; d date; mins int; st text; new_id uuid; new_at timestamptz;
begin
  if not exists (select 1 from public.roster where id = p_roster_id and active) then
    return json_build_object('ok', false, 'error', 'unknown_student');
  end if;
  if p_signature is null or p_signature not like 'data:image/png;base64,%' or length(p_signature) > 300000 then
    return json_build_object('ok', false, 'error', 'bad_signature');
  end if;
  select * into s from public.settings where id = 1;
  local_ts := now() at time zone 'Asia/Bangkok';
  d := local_ts::date;
  mins := floor(extract(epoch from (local_ts - (d + coalesce(s.start_time, '09:00'::time)))) / 60);
  st := case when mins > coalesce(s.grace_minutes, 15) then 'late' else 'on_time' end;
  insert into public.attendance (class_date, roster_id, checked_at, status, late_minutes, signature, checked_by)
  values (d, p_roster_id, now(), st, greatest(mins, 0), p_signature, auth.uid())
  on conflict (class_date, roster_id) do nothing
  returning id, checked_at into new_id, new_at;
  if new_id is null then return json_build_object('ok', false, 'error', 'duplicate'); end if;
  return json_build_object('ok', true, 'class_date', d, 'checked_at', new_at, 'status', st, 'late_minutes', greatest(mins, 0));
end;
$$;

create or replace function public.public_board(p_date date default null)
returns table (roster_id text, checked_at timestamptz, status text, late_minutes int)
language sql stable security definer set search_path = public, pg_temp as $$
  select a.roster_id, a.checked_at, a.status, a.late_minutes
  from public.attendance a
  where a.class_date = coalesce(p_date, (now() at time zone 'Asia/Bangkok')::date);
$$;

create or replace function public.today_bkk()
returns date language sql stable set search_path = public, pg_temp as $$ select (now() at time zone 'Asia/Bangkok')::date $$;

revoke execute on function public.check_in(text, text) from public;
revoke execute on function public.public_board(date) from public;
grant execute on function public.check_in(text, text) to anon, authenticated;
grant execute on function public.public_board(date) to anon, authenticated;
grant execute on function public.today_bkk() to anon, authenticated;

-- ===== seed =====
insert into public.admins (email) values ('production@foodlenoodle.com');
insert into public.settings (id, title, start_time, grace_minutes) values (1, 'Claude AI', '09:00', 15);
-- รายชื่อผู้เรียนเริ่มต้น 22 คน นำเข้าจากแท็บ Roster ของ Google Sheet
