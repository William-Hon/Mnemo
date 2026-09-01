import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { S3Client, GetObjectCommand } from "https://esm.sh/@aws-sdk/client-s3"
import { getSignedUrl } from "https://esm.sh/@aws-sdk/s3-request-presigner"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_DOWNLOADS_PER_MONTH = 10;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { model_id, model_version } = await req.json()

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

    // 2. Service role client for database access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Count completed installations this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    const { data: completedSessions, error: countError } = await supabaseAdmin
      .from('private_ai_download_sessions')
      .select('id')
      .eq('user_id', user.id)
      .eq('status', 'COMPLETED')
      .gte('completed_at', startOfMonth.toISOString());

    if (countError) throw countError;

    const completedCount = completedSessions?.length || 0;

    if (completedCount >= MAX_DOWNLOADS_PER_MONTH) {
      return new Response(
        JSON.stringify({ 
          error: 'Monthly limit reached', 
          message: 'You have reached the maximum of 10 successful model installations per month.' 
        }), 
        {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // 4. Look for an existing unfinished session for this model/version
    const { data: existingSessions, error: findError } = await supabaseAdmin
      .from('private_ai_download_sessions')
      .select('id, status')
      .eq('user_id', user.id)
      .eq('model_id', model_id)
      .eq('model_version', model_version)
      .in('status', ['PENDING', 'DOWNLOADING', 'FAILED', 'CANCELED'])
      .order('created_at', { ascending: false })
      .limit(1);

    if (findError) throw findError;

    let sessionId;
    if (existingSessions && existingSessions.length > 0) {
      sessionId = existingSessions[0].id;
      // Mark as DOWNLOADING
      await supabaseAdmin
        .from('private_ai_download_sessions')
        .update({ status: 'DOWNLOADING' })
        .eq('id', sessionId);
    } else {
      // Create new session
      const { data: newSession, error: createError } = await supabaseAdmin
        .from('private_ai_download_sessions')
        .insert({
          user_id: user.id,
          model_id,
          model_version,
          status: 'DOWNLOADING'
        })
        .select()
        .single();

      if (createError) throw createError;
      sessionId = newSession.id;
    }

    // 5. Generate R2 Signed URL
    const r2Endpoint = Deno.env.get('R2_ENDPOINT') ?? '';
    const r2Bucket = Deno.env.get('R2_BUCKET') ?? '';
    const r2Key = Deno.env.get('R2_MODEL_KEY') ?? '';

    console.log(`[private-ai-download-url] R2_ENDPOINT: ${r2Endpoint}`);
    console.log(`[private-ai-download-url] R2_BUCKET: ${r2Bucket}`);
    console.log(`[private-ai-download-url] R2_MODEL_KEY: ${r2Key}`);

    const s3Client = new S3Client({
      region: 'auto',
      endpoint: r2Endpoint,
      credentials: {
        accessKeyId: Deno.env.get('R2_ACCESS_KEY_ID') ?? '',
        secretAccessKey: Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '',
      },
    });

    const command = new GetObjectCommand({
      Bucket: r2Bucket,
      Key: r2Key,
    });

    // Valid for 60 minutes
    const signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

    return new Response(
      JSON.stringify({
        session_id: sessionId,
        signed_url: signedUrl,
        used_downloads: completedCount,
        total_allowed: MAX_DOWNLOADS_PER_MONTH
      }),
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
