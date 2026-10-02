-- Run this in the Supabase SQL Editor (Project > SQL Editor > New query) after creating the project.

create table if not exists public.reading_progress (
  user_id uuid references auth.users(id) on delete cascade not null,
  article_slug text not null,
  status text not null default 'unread' check (status in ('unread', 'in_progress', 'read')),
  updated_at timestamptz not null default now(),
  primary key (user_id, article_slug)
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  quiz_id text not null,
  score integer not null,
  total_questions integer not null,
  answers jsonb not null,
  completed_at timestamptz not null default now()
);

create table if not exists public.roadmap_progress (
  user_id uuid references auth.users(id) on delete cascade not null,
  section_id text not null,
  completed boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, section_id)
);

create index if not exists idx_reading_progress_user on public.reading_progress(user_id);
create index if not exists idx_quiz_attempts_user on public.quiz_attempts(user_id);
create index if not exists idx_quiz_attempts_user_quiz on public.quiz_attempts(user_id, quiz_id);
create index if not exists idx_roadmap_progress_user on public.roadmap_progress(user_id);

alter table public.reading_progress enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.roadmap_progress enable row level security;

create policy "select own progress" on public.reading_progress
  for select using (auth.uid() = user_id);
create policy "upsert own progress" on public.reading_progress
  for insert with check (auth.uid() = user_id);
create policy "update own progress" on public.reading_progress
  for update using (auth.uid() = user_id);
create policy "delete own progress" on public.reading_progress
  for delete using (auth.uid() = user_id);

create policy "select own attempts" on public.quiz_attempts
  for select using (auth.uid() = user_id);
create policy "insert own attempts" on public.quiz_attempts
  for insert with check (auth.uid() = user_id);
create policy "delete own attempts" on public.quiz_attempts
  for delete using (auth.uid() = user_id);

-- No update policy on quiz_attempts: past attempts can be cleared (e.g. via
-- a progress reset) but not edited in place.

create policy "select own roadmap progress" on public.roadmap_progress
  for select using (auth.uid() = user_id);
create policy "upsert own roadmap progress" on public.roadmap_progress
  for insert with check (auth.uid() = user_id);
create policy "update own roadmap progress" on public.roadmap_progress
  for update using (auth.uid() = user_id);
create policy "delete own roadmap progress" on public.roadmap_progress
  for delete using (auth.uid() = user_id);

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  article_slug text not null,
  heading_slug text not null,
  heading_title text not null,
  created_at timestamptz not null default now(),
  unique (user_id, article_slug, heading_slug)
);

create index if not exists idx_bookmarks_user on public.bookmarks(user_id);

alter table public.bookmarks enable row level security;

create policy "select own bookmarks" on public.bookmarks
  for select using (auth.uid() = user_id);
create policy "insert own bookmarks" on public.bookmarks
  for insert with check (auth.uid() = user_id);
create policy "delete own bookmarks" on public.bookmarks
  for delete using (auth.uid() = user_id);

create table if not exists public.problem_reports (
  id uuid primary key default gen_random_uuid(),
  -- set null rather than cascade: a report stays useful after its author
  -- deletes their account.
  user_id uuid references auth.users(id) on delete set null,
  email text,
  category text not null check (category in ('bug', 'content', 'account', 'suggestion', 'other')),
  page_url text check (char_length(page_url) <= 500),
  message text not null check (char_length(message) between 10 and 2000),
  status text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists idx_problem_reports_user_created
  on public.problem_reports(user_id, created_at);

alter table public.problem_reports enable row level security;

create policy "insert own reports" on public.problem_reports
  for insert with check (auth.uid() = user_id);
-- Lets the submit action count a user's recent reports for rate limiting.
create policy "select own reports" on public.problem_reports
  for select using (auth.uid() = user_id);

-- No update or delete policies: reports are triaged from the Supabase
-- dashboard, which bypasses RLS.
