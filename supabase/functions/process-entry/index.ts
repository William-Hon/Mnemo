import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { decryptText, encryptText } from '../shared/encryption.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { entryId, encryptionKey } = await req.json()
    if (!entryId || !encryptionKey) {
      throw new Error('entryId and encryptionKey are required')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Fetch the entry
    const { data: entry, error: entryError } = await supabaseClient
      .from('entries')
      .select('encrypted_content')
      .eq('id', entryId)
      .single()

    if (entryError || !entry) {
      throw new Error('Entry not found')
    }

    // Decrypt the content in-memory
    let plaintext = '';
    try {
      plaintext = await decryptText(entry.encrypted_content, encryptionKey);
    } catch (e) {
      throw new Error('Failed to decrypt entry content with provided key');
    }

    // Generate embedding for the full entry
    const session = new (globalThis as any).Supabase.ai.Session('gte-small')
    const wholeEmbedding = await session.run(plaintext, { mean_pool: true, normalize: true })

    // Naive chunking
    const chunks = plaintext.split('\n\n').filter((c: string) => c.trim().length > 0)
    
    // Clear old chunks
    await supabaseClient.from('entry_chunks').delete().eq('entry_id', entryId)

    // Generate embeddings for chunks and encrypt them
    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i]
      const chunkEmbedding = await session.run(chunkText, { mean_pool: true, normalize: true })
      
      const encryptedChunk = await encryptText(chunkText, encryptionKey);
      
      await supabaseClient.from('entry_chunks').insert({
        entry_id: entryId,
        encrypted_chunk_text: encryptedChunk,
        embedding: Array.from(chunkEmbedding),
      })
    }

    // Update entry with whole embedding and mark as ready
    await supabaseClient
      .from('entries')
      .update({
        whole_embedding: Array.from(wholeEmbedding),
        processing_status: 'ready'
      })
      .eq('id', entryId)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
