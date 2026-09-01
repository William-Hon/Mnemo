-- Create ENUM for download session status
CREATE TYPE download_session_status AS ENUM ('PENDING', 'DOWNLOADING', 'COMPLETED', 'FAILED', 'CANCELED');

-- Create private_ai_download_sessions table
CREATE TABLE public.private_ai_download_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    model_id TEXT NOT NULL,
    model_version TEXT NOT NULL,
    status download_session_status NOT NULL DEFAULT 'PENDING',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Enable RLS
ALTER TABLE public.private_ai_download_sessions ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own sessions
CREATE POLICY "Users can view their own download sessions"
    ON public.private_ai_download_sessions
    FOR SELECT
    USING (auth.uid() = user_id);

-- Restrict inserts and updates strictly to the service role (Edge Functions)
-- No policies for INSERT or UPDATE to normal users.

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_private_ai_download_sessions_updated_at
    BEFORE UPDATE ON public.private_ai_download_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
