-- My Vacation Manager: database schema for Supabase
-- Run this once in the Supabase dashboard: SQL Editor > New query > paste > Run.

-- Settings: one row per user (profile, policy, email template)
create table if not exists public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

-- Per-year overrides (entitlement, carryover, deadline)
create table if not exists public.year_accounts (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year int not null,
  data jsonb not null,
  primary key (user_id, year)
);

-- Manual balance adjustments: append-only audit history
create table if not exists public.adjustments (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  year int not null,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Vacation requests including signature (PNG data URL) and status history
create table if not exists public.vacation_requests (
  id uuid primary key,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number text not null,
  status text not null check (status in ('draft', 'pending', 'approved', 'rejected', 'withdrawn')),
  start_date date not null,
  end_date date not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists vacation_requests_user_start on public.vacation_requests (user_id, start_date);

-- Row Level Security: every user only sees and changes their own rows
alter table public.settings enable row level security;
alter table public.year_accounts enable row level security;
alter table public.adjustments enable row level security;
alter table public.vacation_requests enable row level security;

create policy "own settings" on public.settings
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create policy "own year accounts" on public.year_accounts
  for all using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Adjustments can be read and added, never changed or deleted (audit trail)
create policy "read own adjustments" on public.adjustments
  for select using (user_id = (select auth.uid()));
create policy "add own adjustments" on public.adjustments
  for insert with check (user_id = (select auth.uid()));

create policy "read own requests" on public.vacation_requests
  for select using (user_id = (select auth.uid()));
create policy "add own requests" on public.vacation_requests
  for insert with check (user_id = (select auth.uid()));
create policy "update own requests" on public.vacation_requests
  for update using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
-- Requests can be deleted completely (Chris' decision, 17.11.2026).
create policy "delete own requests" on public.vacation_requests
  for delete using (user_id = (select auth.uid()));
