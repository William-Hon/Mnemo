import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptText } from "../shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { entryId, audioPath, encryptionKey } = await req.json();
    if (!entryId || !audioPath || !encryptionKey) {
      throw new Error("Missing entryId, audioPath, or encryptionKey");
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Download audio file from storage
    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from('media')
      .download(audioPath);

    if (downloadError || !fileData) {
      throw new Error("Failed to download audio file: " + downloadError?.message);
    }

    // Extract extension from path
    const match = audioPath.match(/\.([a-zA-Z0-9]+)$/);
    const ext = match ? match[1] : 'm4a';

    // Call Groq Whisper API
    const formData = new FormData();
    formData.append('file', fileData, `audio.${ext}`);
    formData.append('model', 'whisper-large-v3-turbo');

    const groqResponse = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`
      },
      body: formData
    });

    if (!groqResponse.ok) {
      const errText = await groqResponse.text();
      throw new Error("Groq API error: " + errText);
    }

    const groqData = await groqResponse.json();
    const transcription = groqData.text;

    // Encrypt transcription
    const encryptedContent = await encryptText(transcription, encryptionKey);

    // Update entry with encrypted content
    const { error: updateError } = await supabaseClient
      .from('entries')
      .update({
        encrypted_content: encryptedContent
      })
      .eq('id', entryId);

    if (updateError) {
      throw new Error("Failed to save encrypted transcription: " + updateError.message);
    }

    // Trigger process-entry for embeddings
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/process-entry`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entryId, encryptionKey })
    });

    return new Response(JSON.stringify({ success: true, text: transcription }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error("Transcription Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
