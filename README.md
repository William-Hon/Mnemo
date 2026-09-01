# MNEMO

**A privacy-first personal memory system.**

Capture, search, and reason over years of thoughts — without handing your entire journal history to a third-party AI provider.

### **[→ Try the live app](https://qora-orcin.vercel.app/home)**

---

## What It Does

MNEMO is a cross-platform journal and memory retrieval system. Users write or speak entries that are encrypted, embedded as vectors, and made searchable through a hybrid semantic + keyword pipeline. A local LLM can then reason over retrieved memories entirely on-device.

---

## Core Systems

### 1. Privacy-First Encryption

All journal text is encrypted client-side before it ever reaches the database.

- **AES-256-GCM** encryption applied before storage
- A randomly generated **Master Encryption Key (MEK)** is created per user on their device
- The MEK is protected by a **Key Encryption Key (KEK)** derived from the user's passphrase via **PBKDF2**
- Supabase/PostgreSQL stores only encrypted ciphertext — never readable entries
- Cloud features (embedding generation, transcription) briefly decrypt data in isolated memory without permanently storing plaintext
- The local LLM path keeps retrieved journal context entirely on-device

### 2. Hybrid RAG Search

MNEMO turns unstructured entries into a searchable personal knowledge base using a custom **Retrieval-Augmented Generation** pipeline.

- Entries are chunked and embedded as vectors using `gte-small` via Supabase's built-in AI runtime
- Vectors are stored in **PostgreSQL + pgvector** and searched by cosine similarity
- The device runs a local keyword pass over decrypted results
- **Reciprocal Rank Fusion (RRF)** merges semantic and keyword rankings for stronger retrieval
- Relevant memories are dynamically injected into the LLM context instead of loading the user's entire history

### 3. Private Local LLM

A quantized **Qwen3 0.6B** model runs directly on the user's device.

- **Local inference** — no data sent to ChatGPT, Claude, or any external LLM
- **WebGPU acceleration** on supported devices; multi-threaded WASM fallback
- Model downloaded once from **Cloudflare R2** via signed URLs and cached persistently (OPFS on web, document directory on mobile)
- **KV-cache reuse** — journal context is prefilled before chat begins, so follow-up questions reuse cached computation instead of re-evaluating
- **Prompt engineering** keeps the model grounded in actual journal data with structured system prompts

### 4. Voice-to-Memory Pipeline

Voice entries flow through the same encrypted, searchable pipeline as text.

- Audio uploaded to private authenticated storage
- **Groq Whisper** (whisper-large-v3-turbo) performs speech-to-text transcription
- Transcripts are encrypted before database storage
- Transcribed entries automatically enter the embedding and RAG pipeline
- Original audio persists for playback and is deleted when the entry is removed

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client (Expo)                        │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  Journal  │  │  Search  │  │  Voice   │  │  Local LLM │  │
│  │  Entry    │  │  (RAG)   │  │  Capture │  │  (wllama/  │  │
│  │          │  │          │  │          │  │  llama.rn)  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └──────┬─────┘  │
│       │              │              │               │        │
│  AES-256-GCM    Local RRF     Audio Upload    On-Device     │
│  Encrypt        Reranking                     Inference     │
└───────┼──────────────┼──────────────┼───────────────┼────────┘
        │              │              │               │
        ▼              ▼              ▼               │
┌───────────────────────────────────────────┐         │
│         Supabase Edge Functions (Deno)    │         │
│                                           │         │
│  process-entry    search-entries          │         │
│  (decrypt→chunk→  (embed query→           │         │
│   embed→encrypt)   pgvector match)        │         │
│                                           │         │
│  transcribe       delete-account          │         │
│  (Groq Whisper→   (cascade delete)        │         │
│   encrypt text)                           │         │
│                                           │         │
│  private-ai-download-url                  │         │
│  (R2 signed URL + quota)                  │◄────────┘
└──────────────────┬────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────┐
│     PostgreSQL + pgvector (Supabase)     │
│                                          │
│  entries (encrypted_content, embedding)  │
│  entry_chunks (encrypted_chunk_text,     │
│                embedding)                │
│  user_encryption_keys (wrapped MEK)      │
│  private_ai_download_sessions            │
│                                          │
│  Row-Level Security: auth.uid() = user_id│
└──────────────────────────────────────────┘
```

### Privacy Boundaries

| Data | Client | Database | Edge Functions |
|---|---|---|---|
| Journal text | Plaintext | **Encrypted** | In-memory only |
| MEK | Plaintext | Wrapped (KEK) | In-memory only |
| Audio files | Plaintext | Plaintext | Passed to Groq |
| Embeddings | — | Plaintext vectors | Generated here |
| Search queries | Plaintext | — | Plaintext |
| **Local AI chat** | **Plaintext** | **Never** | **Never** |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Client | React Native (Expo SDK 57), TypeScript, NativeWind/Tailwind |
| Navigation | Expo Router (file-based) |
| Backend | Supabase (Auth, PostgreSQL, Storage, Edge Functions) |
| Vector Search | pgvector + custom `match_entries` RPC |
| Embeddings | `gte-small` via Supabase Edge AI Runtime |
| Local LLM (Web) | `@wllama/wllama` (GGUF + WebGPU/WASM) |
| Local LLM (Mobile) | `llama.rn` (native C++ execution) |
| Transcription | Groq Whisper API (`whisper-large-v3-turbo`) |
| Model Hosting | Cloudflare R2 (private bucket, signed URLs) |
| Encryption | AES-256-GCM via WebCrypto API (client + Edge) |
| Key Derivation | PBKDF2 (passphrase → KEK → wraps MEK) |
| Deployment | Vercel |

---

## Project Structure

```
app/
  (auth)/          — Sign-in, sign-up, passphrase recovery
  (tabs)/          — Main app screens
    home.tsx       — Journal entry creation (text + voice)
    history.tsx    — Past journals, search, bulk actions
    settings.tsx   — Account, encryption, model management
    admin.tsx      — Retry failed processing tasks
    about.tsx      — Architecture & privacy info

src/
  lib/             — Supabase client, encryption utilities
  services/        — LocalAIService (wllama/llama.rn), database services
  providers/       — React context providers

supabase/
  functions/
    process-entry/           — Decrypt → chunk → embed → encrypt
    search-entries/          — Query embedding + pgvector search
    transcribe/              — Groq Whisper → encrypt transcript
    private-ai-download-url/ — R2 signed URL + quota enforcement
    complete-private-ai-download/ — Mark download session complete
    delete-account/          — Cascade delete user data
    shared/encryption.ts     — AES-GCM encrypt/decrypt (Deno WebCrypto)

docs/
  ARCHITECTURE.md            — Detailed technical architecture
  supabase_migrations/       — Database migration scripts
```

---

## Edge Functions

| Function | Purpose |
|---|---|
| `process-entry` | Receives entry ID + MEK, decrypts in memory, splits into chunks, generates vector embeddings (`gte-small`), re-encrypts chunks, stores in `entry_chunks` |
| `search-entries` | Embeds user query, calls `match_entries` RPC for pgvector cosine similarity, returns top 30 encrypted candidates |
| `transcribe` | Downloads audio from storage, sends to Groq Whisper, encrypts transcript, triggers `process-entry` |
| `private-ai-download-url` | Enforces monthly download quota (10/month), generates signed R2 URL for model download |
| `complete-private-ai-download` | Marks a model download session as completed after client-side integrity verification |
| `delete-account` | Authenticates user and triggers cascade deletion via Supabase Admin Auth |

---

## Local AI Details

- **Model**: Qwen3 0.6B Instruct, Q4_K_M quantization (GGUF format, ~460 MB)
- **Web runtime**: `@wllama/wllama` — WebGPU with multi-threaded WASM fallback
- **Mobile runtime**: `llama.rn` — native C++ via llama.cpp bindings
- **Context**: 2048 tokens, `n_gpu_layers: 50`
- **Optimizations**: Flash Attention enabled, journal prefill via KV-cache warmup, exact prefix matching for cache survival across chat turns
- **Output control**: Thinking mode suppressed via prompt injection; responses capped at 150 tokens

---

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Create a `.env` file with your Supabase credentials:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. Start the development server:
   ```bash
   npm run web      # Web
   npm run ios      # iOS
   npm run android  # Android
   ```

---

## Environment Variables

### Client (`.env`)
| Variable | Description |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous/public key |

### Edge Functions (Supabase Dashboard)
| Variable | Description |
|---|---|
| `SUPABASE_URL` | Auto-provided by Supabase |
| `SUPABASE_ANON_KEY` | Auto-provided by Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided by Supabase |
| `GROQ_API_KEY` | Groq API key for Whisper transcription |
| `R2_ENDPOINT` | Cloudflare R2 S3-compatible endpoint |
| `R2_BUCKET` | R2 bucket name |
| `R2_MODEL_KEY` | Object key for the GGUF model file |
| `R2_ACCESS_KEY_ID` | R2 access key |
| `R2_SECRET_ACCESS_KEY` | R2 secret key |

---

## Deployment

The app is deployed on **Vercel** as a static Expo web export.

**Production URL**: [https://qora-orcin.vercel.app/home](https://qora-orcin.vercel.app/home)

---

## License

Private repository. All rights reserved.
