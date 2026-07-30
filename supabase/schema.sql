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

create index if not exists idx_reading_progress_user on public.reading_progress(user_id);
create index if not exists idx_quiz_attempts_user on public.quiz_attempts(user_id);
create index if not exists idx_quiz_attempts_user_quiz on public.quiz_attempts(user_id, quiz_id);

alter table public.reading_progress enable row level security;
alter table public.quiz_attempts enable row level security;

create policy "select own progress" on public.reading_progress
  for select using (auth.uid() = user_id);
create policy "upsert own progress" on public.reading_progress
  for insert with check (auth.uid() = user_id);
create policy "update own progress" on public.reading_progress
  for update using (auth.uid() = user_id);

create policy "select own attempts" on public.quiz_attempts
  for select using (auth.uid() = user_id);
create policy "insert own attempts" on public.quiz_attempts
  for insert with check (auth.uid() = user_id);

-- No update/delete policy on quiz_attempts: attempts are immutable history.
