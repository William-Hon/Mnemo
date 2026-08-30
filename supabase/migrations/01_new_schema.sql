create table if not exists public.entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  entry_type text not null check (entry_type in ('voice', 'text')),
  audio_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.entries enable row level security;

create policy "Users can view their own entries"
on public.entries for select to authenticated using (auth.uid() = user_id);

create policy "Users can insert their own entries"
on public.entries for insert to authenticated with check (auth.uid() = user_id);

create policy "Users can update their own entries"
on public.entries for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Users can delete their own entries"
on public.entries for delete to authenticated using (auth.uid() = user_id);
