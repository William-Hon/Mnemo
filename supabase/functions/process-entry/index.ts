import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { decryptText, encryptText } from "../shared/encryption.ts";

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
    const { entryId, encryptionKey } = await req.json();
    if (!entryId) throw new Error("Missing entryId");
    if (!encryptionKey) throw new Error("Missing encryptionKey");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // 1. Fetch the entry content
    const { data: entry, error: fetchError } = await supabaseClient
      .from('entries')
      .select('encrypted_content')
      .eq('id', entryId)
      .single();

    if (fetchError || !entry) throw new Error("Failed to fetch entry: " + fetchError?.message);

    const encryptedContent = entry.encrypted_content;
    if (!encryptedContent || encryptedContent.trim().length === 0) {
      return new Response(JSON.stringify({ message: "Empty content, nothing to process" }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Decrypt content in memory to generate embeddings
    const plainText = await decryptText(encryptedContent, encryptionKey);

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
        
        // Encrypt the chunk text before storing it!
        const encryptedChunk = await encryptText(chunkTextContent, encryptionKey);

        await supabaseClient
          .from('entry_chunks')
          .insert([{ 
            entry_id: entryId, 
            encrypted_chunk_text: encryptedChunk, 
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
