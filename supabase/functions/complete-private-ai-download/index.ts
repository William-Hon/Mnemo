import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { session_id, model_version } = await req.json()

    if (!session_id || !model_version) {
        throw new Error("session_id and model_version required");
    }

    // 1. Authenticate user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // 2. Service role client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Update session to COMPLETED idempotently
    const { data: sessionData, error: updateError } = await supabaseAdmin
      .from('private_ai_download_sessions')
      .update({ 
          status: 'COMPLETED',
          completed_at: new Date().toISOString()
      })
      .eq('id', session_id)
      .eq('user_id', user.id)
      .eq('model_version', model_version)
      .neq('status', 'COMPLETED') // Ensure idempotency
      .select()
      .single();

    // If updateError is not null but error code is PGRST116 (0 rows returned), 
    // it means it was either already COMPLETED or doesn't belong to the user.
    if (updateError && updateError.code !== 'PGRST116') {
        throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
