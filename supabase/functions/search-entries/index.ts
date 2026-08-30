import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore: Supabase is globally available in the Edge Runtime
const session = new Supabase.ai.Session('gte-small');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { query, filterType, filterStartDate } = await req.json();
    if (!query) throw new Error("Missing search query");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Convert the user's text query into a mathematical vector
    const queryEmbedding = await session.run(query, { mean_pool: true, normalize: true });
    const embeddingArray = Array.from(queryEmbedding);

    // 2. Pass the vector and filters to our Postgres match_entries function
    const { data: matchedEntries, error: matchError } = await supabaseClient
      .rpc('match_entries', {
        query_embedding: JSON.stringify(embeddingArray),
        match_threshold: 0.65, // Lower threshold for broad retrieval
        match_count: 30, // Fetch more candidates for client-side reranking
        filter_type: filterType || null,
        filter_start_date: filterStartDate || null
      });

    if (matchError) throw new Error("Failed to match entries: " + matchError.message);

    return new Response(JSON.stringify({ results: matchedEntries }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Search Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
