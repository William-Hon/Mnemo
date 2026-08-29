import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encryptText } from "../shared/encryption.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { entryId, audioPath, encryptionKey } = await req.json();
    
    if (!entryId || !audioPath) {
      throw new Error("Missing entryId or audioPath");
    }
    if (!encryptionKey) {
      throw new Error("Missing encryptionKey");
    }

    const groqApiKey = Deno.env.get('GROQ_API_KEY');
    if (!groqApiKey) {
      throw new Error("GROQ_API_KEY is not set. Please add it to Supabase secrets.");
    }

    // Create a Supabase client with the Auth context of the logged in user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Update status to processing
    await supabaseClient
      .from('entries')
      .update({ processing_status: 'processing' })
      .eq('id', entryId);

    // Download the audio file from Storage
    const { data: audioData, error: downloadError } = await supabaseClient
      .storage
      .from('media')
      .download(audioPath);

    if (downloadError || !audioData) {
      throw new Error("Failed to download audio file: " + (downloadError?.message || "Unknown error"));
    }

    // Prepare FormData for Groq Whisper
    const formData = new FormData();
    const ext = audioPath.split('.').pop() || 'webm';
    formData.append("file", audioData, `audio.${ext}`);
    formData.append("model", "whisper-large-v3"); // Groq's whisper model

    // Call Groq API
    const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${groqApiKey}`,
      },
      body: formData,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq API error: ${response.status} ${errorText}`);
    }

    const result = await response.json();
    const transcribedText = result.text;
    
    // Encrypt the transcribed text!
    const encryptedContent = await encryptText(transcribedText, encryptionKey);

    // Update the database with the encrypted transcription
    const { error: updateError } = await supabaseClient
      .from('entries')
      .update({ 
        encrypted_content: encryptedContent,
        processing_status: 'ready' 
      })
      .eq('id', entryId);

    if (updateError) {
      throw updateError;
    }

    // Return the plaintext to the client so it can display it immediately
    return new Response(JSON.stringify({ text: transcribedText }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
