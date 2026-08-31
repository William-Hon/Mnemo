# Qora

## Overview
Qora is a mobile-first personal journal bank and context retrieval app. It is designed to let users capture thoughts in whatever format is easiest (text, voice), preserve that context securely over time, and reliably retrieve the most relevant past entries using a hybrid semantic/keyword search engine. 

---

## Current Product Stage
Phase 10: Semantic Journal Bank MVP (Completed)

---

## Current Features
- Multi-modal capture: Typed entries and Voice capture with live audio decibel metering
- Advanced Hybrid Retrieval: Semantic (pgvector) and Full-text keyword search
- Local Audio Transcription and AI Processing Pipeline (Save First, Process Second)
- Supabase-backed secure cloud storage with strict Row Level Security (RLS)
- End-to-End Application-Level Privacy & Encryption Architecture
- Custom Brutalist/Mystic Blue UI with floating modals and drop-shadows
- Bulk Actions & Export: Select multiple journals and export them as a Context Brief
- Cross-Platform Support (iOS, Android, Web via Expo)
- Hybrid Image and PDF scanning
  - Typed documents use free, browser-native Tesseract.js and PDF.js
  - Handwritten documents securely use Google Cloud Vision API for high accuracy
- OCR Usage limits built-in (5 scans/user/day, 900 scans/app/month)
- Keyboard shortcuts (Ctrl+Enter to submit) and ability to go back and edit previous answers
- Inline editing of past journal entries from the Past Journals page

---

## Latest Session Changes

Changed
- **Global Layout:** Transformed the app into a strictly non-scrolling, viewport-bound application by enforcing `100vh` and `100%` constraints with `overflow: hidden` on the body and app shell.
- **Global Styles:** Hidden native scrollbars across all components to enforce a seamless, native app-like aesthetic.
- `PromptCard`: Restructured the `.input-actions` button layout into a stacked full-width column, establishing a flawless 2x2 grid of evenly sized buttons. This guarantees no horizontal overflow or text clipping on narrow mobile screens.
- `PromptCard`: Removed fixed minimum heights on text areas to enable true fluid flexing, allowing the UI to gracefully scale down to available screen real estate without content cutoff.
- `AuthPage`: Constrained the authentication container to `100%` height to align with the new absolute viewport bounds.

---

## Current Journal Flow

1. User answers "What do you feel right now?"
2. User answers "Why do you feel this?"
3. Emotion detection engine evaluates responses.
4. If confidence is low or ambiguous, a fallback emotion picker appears.
5. An appropriate emotion-specific reflection prompt is shown.
6. User can type, dictate, or scan a handwritten response via OCR/PDF upload.
7. Journal entry is saved securely to the user's Supabase account.
8. Users can revisit the "Past Journals" tab to inline-edit their past answers.

---

## Tech Stack
- Vite
- React
- TypeScript
- CSS
- Supabase (Auth and Database)
- Tesseract.js (Browser-based OCR)
- PDF.js (Browser-based PDF parsing)

---

## Folder Overview

`src/`
`src/components/` - React components for the journaling flow
`src/hooks/` - Custom React hooks like `useSpeechToText` and `useDocumentScanner`
`src/lib/emotions/` - Emotion detection logic, keywords, and prompts
`src/styles/` - Vanilla CSS styles
`src/types/` - TypeScript definitions
`src/services/` - Supabase database interactions
`src/utils/` - Legacy local storage utilities

---

## Known Limitations
- Emotion detection uses deterministic keyword matching, which may miss complex emotional nuances compared to an AI model.
- Handwriting OCR accuracy depends on image quality and handwriting clarity, though Google Vision provides state-of-the-art results.
- Cloud OCR requires a stable internet connection and is subject to daily and monthly usage caps.

---

## Next Steps
- Add basic mood tracking analytics or charts.
- Improve emotion detection accuracy and context awareness.
- Add ability to re-run emotion detection if an entry is edited retroactively.
- Further polish the UI/UX.

---

## Supabase Setup

To enable authentication and cloud journal storage, you need a Supabase project.

1. Create a `.env` file in the root directory and add your Supabase credentials:
   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
   ```
   **Important:** Never place your secret `service_role` key in frontend environment variables!

2. Run the SQL schema script in your Supabase SQL Editor:
   - Copy the contents of `docs/supabase_schema.sql` and run it in the SQL Editor to create the `journal_entries` table, Row Level Security (RLS) policies, and the `ocr_usage_events` table for tracking OCR limits.

3. Configure Redirect URLs:
   In your Supabase Dashboard, go to **Authentication → URL Configuration → Redirect URLs** and add the following allow-listed URLs to ensure email confirmations redirect correctly:
   - `http://localhost:5174/**`
   - `https://qora-orcin.vercel.app/**`
   - `https://www.myqora.com/**`

---

## Google Cloud Vision Setup

To enable highly accurate handwriting recognition, the app uses a serverless backend (`api/ocr.ts`) to communicate with Google Cloud Vision securely.

1. Get a Google Cloud Vision API Key from the Google Cloud Console.
2. If deploying to **Vercel**, add the following Environment Variables to your project settings:
   - `GOOGLE_CLOUD_VISION_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_PUBLISHABLE_KEY`
   *Note: These backend variables must NOT be prefixed with `VITE_`.*
3. Redeploy your Vercel project after adding these variables.
4. For **local testing** of the cloud OCR endpoint, simply create a `.env.local` file with all your variables (including `VITE_` ones). Our custom Vite config will automatically load them for the local backend mock.

---

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server:
   ```bash
   npm run dev
   ```
   *Note: Our custom `vite.config.ts` handles serving the frontend AND the backend `/api/ocr` serverless function simultaneously!*
