-- Enable the vector extension
create extension if not exists vector;

-- Add whole-entry embedding to entries table (384 dimensions for gte-small)
alter table public.entries 
  add column if not exists whole_embedding vector(384);

-- Create table for overlapping chunks
create table if not exists public.entry_chunks (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.entries(id) on delete cascade,
  chunk_text text not null,
  embedding vector(384),
  created_at timestamptz default now()
);

-- RLS for entry_chunks
alter table public.entry_chunks enable row level security;

create policy "Users can view their own entry chunks"
on public.entry_chunks for select to authenticated
using (entry_id in (select id from public.entries where user_id = auth.uid()));

create policy "Users can insert their own entry chunks"
on public.entry_chunks for insert to authenticated
with check (entry_id in (select id from public.entries where user_id = auth.uid()));
