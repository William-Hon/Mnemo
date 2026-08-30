-- 1. Create HNSW indexes for high-performance vector search at scale
create index if not exists entry_chunks_embedding_hnsw_idx 
  on public.entry_chunks 
  using hnsw (embedding vector_cosine_ops);

create index if not exists entries_whole_embedding_hnsw_idx 
  on public.entries 
  using hnsw (whole_embedding vector_cosine_ops);

-- 2. Drop previous match_entries function signature
drop function if exists match_entries(vector(384), float, int);

-- 3. Update match_entries RPC to search chunks and return both the matched chunk and the full entry ciphertext
create or replace function match_entries (
  query_embedding vector(384),
  match_threshold float,
  match_count int
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
  order by c.entry_id, similarity desc
  limit match_count;
$$;
