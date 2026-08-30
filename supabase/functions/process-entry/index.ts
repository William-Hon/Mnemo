import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// @ts-ignore: Supabase is globally available in the Edge Runtime
const session = new Supabase.ai.Session('gte-small');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function chunkText(text: string, maxWords = 300, overlap = 50): string[] {
  const words = text.split(/\s+/);
  if (words.length <= maxWords) return [text];
  
  const chunks = [];
  let i = 0;
  while (i < words.length) {
    const chunk = words.slice(i, i + maxWords).join(" ");
    chunks.push(chunk);
    i += (maxWords - overlap);
  }
  return chunks;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { entryId } = await req.json();
    if (!entryId) throw new Error("Missing entryId");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Fetch the entry content
    const { data: entry, error: fetchError } = await supabaseClient
      .from('entries')
      .select('content')
      .eq('id', entryId)
      .single();

    if (fetchError || !entry) throw new Error("Failed to fetch entry: " + fetchError?.message);

    const plainText = entry.content;
    if (!plainText || plainText.trim().length === 0) {
      return new Response(JSON.stringify({ message: "Empty content, nothing to process" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // 2. Generate Whole Entry Embedding using native Supabase AI on the plaintext
    const wholeEmbedding = await session.run(plainText, { mean_pool: true, normalize: true });

    // Update the whole_embedding on the entry
    await supabaseClient
      .from('entries')
      .update({ whole_embedding: JSON.stringify(Array.from(wholeEmbedding)) })
      .eq('id', entryId);

    // 3. Chunking for long entries
    const chunks = chunkText(plainText);
    if (chunks.length > 1) {
      for (const chunkTextContent of chunks) {
        const chunkEmbedding = await session.run(chunkTextContent, { mean_pool: true, normalize: true });

        await supabaseClient
          .from('entry_chunks')
          .insert([{ 
            entry_id: entryId, 
            chunk_text: chunkTextContent, 
            embedding: JSON.stringify(Array.from(chunkEmbedding)) 
          }]);
      }
    }

    return new Response(JSON.stringify({ success: true, chunksGenerated: chunks.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error("Processing Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
