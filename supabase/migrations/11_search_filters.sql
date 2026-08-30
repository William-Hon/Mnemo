drop function if exists match_entries(vector(384), float, int);
drop function if exists match_entries(vector(384), float, int, text, timestamptz);

create or replace function match_entries (
  query_embedding vector(384),
  match_threshold float,
  match_count int,
  filter_type text default null,
  filter_start_date timestamptz default null
)
returns table (
  id uuid,
  entry_id uuid,
  encrypted_content text,
  encrypted_entry_content text,
  created_at timestamptz,
  similarity float
)
language sql stable
as $$
  select * from (
    select distinct on (c.entry_id)
      c.id,
      c.entry_id,
      c.encrypted_chunk_text as encrypted_content,
      e.encrypted_content as encrypted_entry_content,
      c.created_at,
      1 - (c.embedding <=> query_embedding) as similarity
    from entry_chunks c
    join entries e on e.id = c.entry_id
    where 1 - (c.embedding <=> query_embedding) > match_threshold
      and e.user_id = auth.uid()
      and (filter_type is null or e.entry_type = filter_type)
      and (filter_start_date is null or e.created_at >= filter_start_date)
    order by c.entry_id, 1 - (c.embedding <=> query_embedding) desc
  ) as unique_chunks
  order by similarity desc
  limit match_count;
$$;
