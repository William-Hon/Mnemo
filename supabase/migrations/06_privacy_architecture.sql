create table if not exists public.user_encryption_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wrapped_mek text not null,
  wrapped_mek_iv text not null,
  kdf_salt text not null,
  kdf_algorithm text not null,
  kdf_params jsonb not null,
  encryption_algorithm text not null,
  key_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_encryption_keys enable row level security;
create policy "Users manage their own keys" on public.user_encryption_keys 
  for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Explicitly rename columns so accidental plaintext insertion is structurally impossible
alter table public.entries rename column content to encrypted_content;
alter table public.entries add column content_encryption_version int default 1;

alter table public.entry_chunks rename column chunk_text to encrypted_chunk_text;
alter table public.entry_chunks add column encryption_version int default 1;

-- Update match_entries RPC to return the encrypted_content
drop function if exists match_entries(vector(384), float, int);

create or replace function match_entries (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  encrypted_content text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    entries.id,
    entries.encrypted_content,
    entries.created_at,
    1 - (entries.whole_embedding <=> query_embedding) as similarity
  from entries
  where 1 - (entries.whole_embedding <=> query_embedding) > match_threshold
    and entries.user_id = auth.uid()
  order by similarity desc
  limit match_count;
$$;
