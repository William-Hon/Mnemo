-- Rename columns back to plaintext names
alter table public.entries rename column encrypted_content to content;
alter table public.entry_chunks rename column encrypted_chunk_text to chunk_text;

-- Drop encryption metadata columns
alter table public.entries drop column if exists content_encryption_version;
alter table public.entry_chunks drop column if exists encryption_version;

-- Drop the encryption keys table
drop table if exists public.user_encryption_keys;

-- Update the match_entries RPC to use 'content' instead of 'encrypted_content'
drop function if exists match_entries(vector(384), float, int);

create or replace function match_entries (
  query_embedding vector(384),
  match_threshold float,
  match_count int
)
returns table (
  id uuid,
  content text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select
    entries.id,
    entries.content,
    entries.created_at,
    1 - (entries.whole_embedding <=> query_embedding) as similarity
  from entries
  where 1 - (entries.whole_embedding <=> query_embedding) > match_threshold
    and entries.user_id = auth.uid()
  order by similarity desc
  limit match_count;
$$;
