-- Create a function to search whole entries
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
    and entries.user_id = auth.uid() -- Enforce RLS!
  order by similarity desc
  limit match_count;
$$;
