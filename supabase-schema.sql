-- ============================================
-- SZPT DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROFILES ──────────────────────────────────
create table profiles (
  id uuid references auth.users on delete cascade primary key,
  name text,
  age integer,
  gender text,
  height_cm numeric,
  job text,
  activity_level numeric,
  start_weight numeric,
  goal_weight numeric,
  bmr integer,
  maintenance_cals integer,
  allergies text,
  supplements text,
  notes text,
  why text,
  hevy_api_key text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── PLANS ─────────────────────────────────────
create table plans (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  phase text default 'cut',
  name text,
  start_date date,
  cal_target integer,
  prot_target integer,
  steps_target integer,
  start_weight numeric,
  goal_weight numeric,
  maintenance_cals integer,
  notes text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ── DAILY LOGS ────────────────────────────────
create table daily_logs (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  calories integer,
  protein integer,
  steps integer,
  weight numeric,
  creatine boolean,
  excuse text,
  excuse_wi text,
  excuse_log text,
  excuse_supp boolean,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, date)
);

-- ── PROGRESS PHOTOS ───────────────────────────
create table progress_photos (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  label text,
  note text,
  storage_path text not null,
  weight_on_day numeric,
  created_at timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────
alter table profiles enable row level security;
alter table plans enable row level security;
alter table daily_logs enable row level security;
alter table progress_photos enable row level security;

-- Profiles: users can only see/edit their own
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can insert own profile" on profiles for insert with check (auth.uid() = id);

-- Plans
create policy "Users can manage own plans" on plans for all using (auth.uid() = user_id);

-- Daily logs
create policy "Users can manage own logs" on daily_logs for all using (auth.uid() = user_id);

-- Photos
create policy "Users can manage own photos" on progress_photos for all using (auth.uid() = user_id);

-- ── TRIGGER: auto-create profile on signup ────
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name)
  values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ── STORAGE BUCKET FOR PHOTOS ─────────────────
insert into storage.buckets (id, name, public) values ('photos', 'photos', false);

create policy "Users can upload own photos" on storage.objects for insert
  with check (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can view own photos" on storage.objects for select
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);

create policy "Users can delete own photos" on storage.objects for delete
  using (bucket_id = 'photos' and auth.uid()::text = (storage.foldername(name))[1]);
