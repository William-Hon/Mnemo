# Qora: Full Product Roadmap & Architectural Breakdown

Qora is a **mobile-first personal journal bank and context retrieval app**.

The core product is not just journaling and not just AI chat. Qora is designed to let users capture thoughts in whatever format is easiest, preserve that context over time, and reliably retrieve the most relevant past entries later.

Users should be able to:

- **Speak** a journal entry.
- **Type** a journal entry.
- **Handwrite** an entry and upload/capture it as an image.
- Store all of those inputs in one unified **Journal Bank**.
- Search naturally for specific past experiences, topics, people, events, or periods.
- See journal entries **ranked by relevance**, not just by date.
- See a short, query-relevant preview before opening a full entry.
- Export all entries or selected/retrieved groups of entries into concise context briefs for:
  - therapists
  - Claude / ChatGPT projects
  - personal reflection
  - other analysis tools

The central product promise is:

> **Put anything in, preserve it, find the right context later, and take that context with you.**

---

# Part 1: Core Product Model

Qora should treat the user's journal history as a searchable personal context bank.

The system has four main jobs:

1. **Capture**
2. **Normalize and store**
3. **Retrieve accurately**
4. **Package context for reuse**

High-level flow:

```text
VOICE / TEXT / HANDWRITING
            ↓
      NORMALIZE TO TEXT
            ↓
     STORE ORIGINAL ENTRY
            ↓
        SEARCH INDEX
            ↓
      JOURNAL BANK
            ↓
 NATURAL-LANGUAGE SEARCH
            ↓
  RANKED RELEVANT ENTRIES
            ↓
  QUERY-SPECIFIC PREVIEWS
            ↓
 OPEN / SELECT / EXPORT
```

---

# Part 2: Why Qora Needs Embeddings, Chunking, Metadata, and Hybrid Search

## 1. Whole-Entry Embeddings

A normal keyword search only finds exact words.

Example:

```text
Search:
"times I felt overwhelmed about school"
```

A past entry may say:

```text
"I feel like assignments are piling up and I can't keep up."
```

The word `overwhelmed` never appears, but the meanings are similar.

An embedding model converts text into a numerical representation of meaning.

Qora can compare:

```text
search meaning
vs.
entry meaning
```

and retrieve entries that are conceptually related even when the exact wording differs.

Every journal entry should receive a **whole-entry embedding**.

This is especially useful for short entries where the entire entry represents one small set of ideas.

---

## 2. Chunk Embeddings for Long or Multi-Topic Entries

One embedding is not enough for long entries.

A 20-minute voice journal might contain:

```text
school
↓
breakup
↓
gym
↓
internship
↓
breakup again
↓
family
```

If the whole entry receives only one vector, all of those ideas get blended together.

Instead, Qora should split long entries into **overlapping, paragraph-aware chunks**.

Example:

```text
Full Entry
│
├── Chunk 1 → embedding
├── Chunk 2 → embedding
├── Chunk 3 → embedding
├── Chunk 4 → embedding
└── Chunk 5 → embedding
```

If the user searches:

```text
"entries where I was struggling with my breakup"
```

a specific breakup chunk may score extremely highly even if the rest of the entry is unrelated.

The user still receives the **full parent journal entry** as the result.

Chunks exist for retrieval, not as separate user-visible journals.

---

## 3. Why Chunks Should Overlap

Human journals are messy.

A person may:

```text
talk about school
↓
mention relationship stress
↓
switch to gym
↓
return to relationship stress
↓
talk about work
↓
return to relationship stress again
```

Qora should not assume each topic appears in one clean section.

Chunks should overlap so thoughts that cross boundaries are not lost.

Initial implementation:

- approximately 300–500 tokens per chunk
- approximately 50–100 tokens of overlap
- respect sentence / paragraph boundaries when possible

For short entries, no chunk splitting is needed.

The full entry is effectively one chunk.

---

## 4. Metadata

Metadata answers:

> **Where should Qora search?**

Useful metadata includes:

- `user_id`
- `created_at`
- `updated_at`
- `source_type`
  - text
  - voice
  - handwriting
- processing status
- optional original media reference

Example search:

```text
"voice entries about my breakup last summer"
```

Qora can interpret:

```text
source_type = voice
date range = last summer
semantic meaning = breakup / relationship ending
```

Metadata should usually be applied as a **hard filter** before semantic ranking.

---

## 5. Keyword / Full-Text Search

Embeddings are good at meaning.

They are less reliable for specific exact terms such as:

- names
- companies
- course numbers
- locations
- exact phrases

Example:

```text
"entries about my Palantir final-round interview"
```

Important exact terms:

```text
Palantir
final round
interview
```

Qora should use PostgreSQL full-text / lexical search alongside vector search.

This is especially useful for entities such as:

```text
Sarah
Palantir
Boston
CS3500
Milan
```

---

## 6. Hybrid Search

Qora should **not** use vector similarity as the final ranking by itself.

Retrieval should combine:

```text
metadata constraints
+
whole-entry semantic similarity
+
chunk semantic similarity
+
keyword / full-text relevance
```

Later, an additional reranker can improve precision.

Conceptually:

```text
USER QUERY
    ↓
Understand query
    ↓
Extract hard filters
    ↓
Search eligible entries/chunks
    ↓
┌──────────────────────────────┐
│ Whole-entry vector search    │
│ Chunk vector search          │
│ Keyword / full-text search   │
└──────────────────────────────┘
    ↓
Merge candidate results
    ↓
Group chunks by parent entry
    ↓
Calculate entry-level relevance
    ↓
Optional reranker
    ↓
Return best journal entries
```

---

# Part 3: Entry Processing and Storage

## Phase A: Capture

The user can create an entry through:

### Typed Entry

```text
typed text
↓
normalized text
```

### Voice Entry

```text
audio
↓
transcription
↓
normalized text
```

### Handwritten Entry

For MVP, Qora does not need to build a handwriting editor.

The user can:

```text
photograph / upload handwritten page
↓
vision / OCR extraction
↓
normalized text
```

The extracted text should be reviewable/editable before final ingestion when practical.

---

## Phase B: Save First, Process Second

The journal should be safely stored before expensive AI processing happens.

Example:

```text
User presses Save
↓
create entry record immediately
↓
processing_status = processing
↓
user can leave screen
```

Then background processing performs:

```text
transcription / OCR if necessary
↓
normalize text
↓
generate whole-entry embedding
↓
chunk if long
↓
generate chunk embeddings
↓
mark searchable
```

This protects against losing a journal because transcription, embeddings, or another AI service temporarily fails.

For Qora, losing an entry is much worse than search taking another few seconds to become available.

---

## Phase C: Preserve the Original

The full normalized journal is the source of truth.

Do not replace it with summaries, chunks, or AI-generated representations.

Conceptually:

```text
ENTRY
│
├── Original source
│   ├── typed content
│   ├── audio reference
│   └── handwriting image reference
│
├── Normalized full text
│
├── Metadata
│
├── Whole-entry embedding
│
└── Search chunks
    ├── Chunk 1 + embedding
    ├── Chunk 2 + embedding
    └── ...
```

---

# Part 4: Core Data Model

## `entries`

Stores the user's actual journals and entry-level search information.

Suggested fields:

```text
entries
-----------------------------
id
user_id
source_type
content
created_at
updated_at
whole_embedding
processing_status
original_asset_url
```

Possible optional fields later:

```text
generic_summary
generated_title
```

These are useful for UI but are not required for core retrieval.

---

## `entry_chunks`

Stores search units for long / multi-topic entries.

```text
entry_chunks
-----------------------------
id
entry_id
user_id
chunk_index
chunk_text
embedding
```

Relationship:

```text
entries
   1
   |
   | has many
   ↓
entry_chunks
```

Short entries may have:

- zero explicit chunk rows and only use `whole_embedding`, or
- one chunk identical to the full entry

Either approach is acceptable as long as retrieval logic is consistent.

---

# Part 5: Detailed Retrieval Logic

Suppose the user searches:

> **"Show me entries I wrote about my Palantir final-round interview."**

Qora should not simply compare one vector against every entry.

The retrieval process should be:

---

## Step 1: Understand the Query

Parse the user's intent into useful retrieval signals.

Example:

```text
Original query:
"entries about my Palantir final-round interview"
```

Interpretation:

```text
Exact / entity terms:
- Palantir
- final round

Semantic intent:
- job interview
- interview experience
- interview performance / reflection

Date:
- none explicitly given
```

Another query:

```text
"when was I struggling with that breakup last year?"
```

could become:

```text
Semantic intent:
emotional difficulty surrounding breakup

Date filter:
last year
```

The system does not need a perfect structured parser on day one.

Start with obvious metadata extraction and improve later.

---

## Step 2: Security Filtering

Before retrieval:

```text
user_id = authenticated user
```

This must be enforced by database security / RLS, not only application code.

Qora should never search all users' embeddings and remove unauthorized results afterward.

Only the authenticated user's permitted entries should ever be candidates.

---

## Step 3: Apply Hard Metadata Filters

If the user says:

```text
"last year"
```

then apply the corresponding date range.

If the user says:

```text
"voice entries"
```

then apply:

```text
source_type = voice
```

Metadata filters reduce the search universe before semantic ranking.

---

## Step 4: Generate Query Embedding

Convert the semantic meaning of the query into an embedding.

Example:

```text
"technical job interview experience at Palantir"
↓
embedding model
↓
query vector
```

---

## Step 5: Whole-Entry Vector Search

Compare the query vector against whole-entry embeddings.

This answers:

> **Is this journal broadly about what the user means?**

Useful especially for short entries.

---

## Step 6: Chunk Vector Search

Compare the same query against chunk embeddings.

This answers:

> **Is the topic buried somewhere inside a larger journal?**

Example:

```text
Entry 123

Whole entry similarity: 0.64

Chunk 1: 0.38
Chunk 2: 0.95  ← interview discussion
Chunk 3: 0.44
Chunk 4: 0.88  ← interview discussion again
```

Entry 123 should still be considered strongly relevant.

---

## Step 7: Keyword / Full-Text Search

Search exact terms and lexical matches.

For:

```text
"Palantir final-round interview"
```

exact matches such as:

```text
Palantir
final round
interview
```

should provide a strong relevance boost.

This prevents semantically related but wrong entries from outranking entries that clearly discuss the exact event.

---

## Step 8: Merge Candidate Results

The candidate pool may contain results from:

```text
whole-entry vector search
chunk vector search
keyword search
```

Combine them into one candidate set.

---

## Step 9: Group Chunks Back Into Entries

Internally:

```text
Entry 14 / Chunk 3 → .95
Entry 72 / Chunk 1 → .93
Entry 14 / Chunk 7 → .90
Entry 31 / Chunk 2 → .87
```

User-facing results should become:

```text
Entry 14
- strongest chunk: .95
- additional strong chunk: .90

Entry 72
- strongest chunk: .93

Entry 31
- strongest chunk: .87
```

The user sees entries, not fragments.

---

## Step 10: Calculate Entry-Level Relevance

Conceptually, entry relevance can include:

```text
whole-entry semantic relevance
+
strongest matching chunk
+
limited bonus for additional matching chunks
+
keyword relevance
```

Metadata is generally a filter, not another arbitrary percentage.

Do not let long repetitive entries dominate simply because they contain more chunks.

Any bonus for multiple matching chunks should be capped.

Exact weights should be tuned using real searches rather than guessed permanently upfront.

---

## Step 11: Optional Reranking

Later, retrieve perhaps the top 20–30 candidate entries and use a stronger reranker to judge:

> **Given exactly what the user asked, how directly does this entry match their intent?**

Example:

Query:

```text
"entries about my Palantir final-round interview"
```

Candidate A:

```text
"Just finished my Palantir final round..."
```

Candidate B:

```text
"Palantir internship applications opened today..."
```

Candidate C:

```text
"I keep replaying that technical question and wish I had
communicated more..."
```

A reranker should understand:

```text
A = extremely relevant
C = highly relevant
B = weakly relevant
```

Reranking is a useful later upgrade but does not need to block the MVP.

---

# Part 6: Search Result Previews

A generic entry summary is not always enough.

Example full entry:

```text
school
+
breakup
+
gym
+
career
```

Generic summary:

```text
"Discussed school, relationship issues, exercise, and career."
```

That is not useful when the user specifically searched for:

```text
"the breakup"
```

Qora should use the **matched chunks** to create or select a query-specific preview.

Example result:

```text
October 14, 2025

You returned to the breakup several times in this entry,
including difficulty letting go and uncertainty about whether
you missed the person or the relationship itself.

[Open full entry]
```

For very short entries, the original text itself may be a better preview than an AI-generated summary.

Do not over-summarize short entries.

---

# Part 7: Context Export

Retrieval is not only for reading entries inside Qora.

Users should be able to select:

- individual entries
- multiple search results
- entries within a date range
- all entries
- entries around a specific topic / event

and turn them into a portable context document.

Example:

```text
Search:
"entries about my breakup last year"

↓
select relevant entries

↓
Build Context Brief
```

Potential output:

```text
Context Brief: Relationship / Breakup
Period: September–December 2025
Source Entries: 14

OVERVIEW
Concise synthesis based only on selected entries.

TIMELINE
- Sept 29: ...
- Oct 12: ...
- Nov 4: ...

RECURRING THEMES
- ...
- ...

SOURCE REFERENCES
- Entry date / title / identifier

OPTIONAL FULL ENTRIES
Appendix
```

Target use cases:

- therapist onboarding / discussion context
- Claude or ChatGPT projects
- personal reflection
- other analyzers

The user should review generated briefs before sharing them.

The system should never silently invent details not present in the selected entries.

---

# Part 8: Updated Product Roadmap

```text
Phase 1: Mobile Foundation & Auth              ✅
Phase 2: Typed Journal Entries                 ✅
Phase 3: Voice Capture UI                      ✅
Phase 4: Multimodal Ingestion
Phase 5: Entry Processing & Search Indexing
Phase 6: Hybrid Retrieval Engine
Phase 7: Ranked Search + Relevant Previews
Phase 8: Journal Bank UI
Phase 9: Context Brief Builder & Export
Phase 10: Privacy, Security & Data Ownership
Phase 11: Offline Support & Reliability
Phase 12: AI Reflection / RAG Chat
Phase 13: Notifications & Retention
Phase 14: Production Polish & EAS Build
```

---

# Phase 1: Mobile Foundation & Auth ✅

## Goal

Set up the cross-platform Expo application and authentication.

## Deliverables

- Expo Router navigation
- Home
- History / Journal Bank
- Settings
- AuthProvider
- Supabase Auth
- secure session/token storage
- sign-in
- sign-up

---

# Phase 2: Typed Journal Entries ✅

## Goal

Allow users to write, store, and retrieve normal text entries.

## Deliverables

- `entries` database schema
- RLS
- new-entry text editor
- entry creation service
- entry history list
- pull-to-refresh

---

# Phase 3: Voice Capture UI ✅

## Goal

Provide extremely low-friction voice capture.

## Deliverables

- microphone permissions
- mobile audio recording
- web MediaRecorder support
- state flow:

```text
idle
↓
recording
↓
transcribing
↓
reviewing
```

- editable transcript review UI

---

# Phase 4: Multimodal Ingestion

## Goal

Convert voice, text, and handwriting into a common normalized entry format.

## Voice

```text
audio
↓
backend transcription
↓
normalized text
```

## Typed

```text
typed content
↓
normalized text
```

## Handwriting

```text
image
↓
vision / OCR
↓
extracted text
↓
review / correction
↓
normalized text
```

## Backend requirements

- API keys remain server-side
- no OpenAI keys in the mobile client
- save entry records before long-running processing
- resilient processing status

Suggested status values:

```text
pending
processing
ready
failed
```

---

# Phase 5: Entry Processing & Search Indexing

## Goal

Turn every stored entry into a reliable searchable representation.

## Steps

1. Enable `pgvector` in Supabase.
2. Add `whole_embedding` to `entries`.
3. Create `entry_chunks`.
4. Generate a whole-entry embedding for every completed entry.
5. Measure entry length.
6. Keep short entries as a single semantic unit.
7. Split long entries into overlapping, paragraph-aware chunks.
8. Generate an embedding per chunk.
9. Configure PostgreSQL full-text search / lexical indexing.
10. Mark the entry as searchable when indexing completes.

Important:

- original journal remains source of truth
- embeddings are indexes, not replacements for content
- long entries should be discoverable through specific buried topics
- short entries should remain searchable without unnecessary chunking

---

# Phase 6: Hybrid Retrieval Engine

## Goal

Return the journal entries that best match what the user actually meant.

## Input

Natural-language query.

Example:

```text
"Show me entries I wrote about my Palantir final-round interview."
```

## Pipeline

```text
query
↓
extract obvious filters / intent
↓
authenticate + enforce user scope
↓
apply metadata constraints
↓
generate query embedding
↓
run:
- whole-entry vector search
- chunk vector search
- full-text / keyword search
↓
merge candidates
↓
group chunks by parent entry
↓
calculate entry relevance
↓
return ranked candidates
```

## Security

All retrieval must be user-scoped through RLS and backend authorization.

Never search all users' journal data and filter afterward.

---

# Phase 7: Ranked Search + Relevant Previews

## Goal

Make retrieval understandable and useful to the user.

Each result should contain:

- entry date
- relevance ordering
- short relevant preview
- source type if useful
- button to open full entry

The preview should preferentially describe the **matched sections**, not just repeat a generic whole-entry summary.

Example:

```text
Aug 24, 2026

You reflected on the technical portion of the final round,
including not asking enough clarifying questions and uncertainty
about how your interviewer perceived your performance.

[Open Entry]
```

Potential later upgrade:

- dedicated reranker for the top candidate set

---

# Phase 8: Journal Bank UI

## Goal

Give users a unified place to browse and search their journal history.

## Features

- natural-language search
- semantic search
- lexical / exact search
- date filters
- source-type filters
- search result ranking
- result previews
- open full entry
- multi-select entries
- selection from search results

Avoid making users choose between "exact" and "semantic" modes unless testing shows they need that control.

The default experience should ideally use hybrid search automatically.

---

# Phase 9: Context Brief Builder & Export

## Goal

Turn stored journal context into portable, user-controlled documents.

## Users can select

- specific entries
- search results
- date ranges
- all entries

## Export forms

- Markdown
- plain text
- JSON
- concise context brief
- optional PDF later

## Context brief uses

- therapists
- Claude projects
- ChatGPT projects
- personal analysis
- other reflection tools

The user should be able to review what is included before export.

---

# Phase 10: Privacy, Security & Data Ownership

## Goal

Make the system appropriate for highly sensitive personal writing.

## Requirements

- Supabase Auth handles passwords
- no password column in app `users` table
- strict RLS on all user-owned tables
- service-role credentials never exposed to the client
- secure API secrets
- export all user data
- delete account and cascade-delete data
- audit privileged/admin access
- explicit handling of stored audio / images
- clear policy for data sent to external AI providers

Important:

RLS prevents normal users from reading each other's entries.

RLS alone does **not** make plaintext journal entries invisible to privileged database administrators.

If Qora promises that admins cannot casually read journal bodies, add application-level encryption with appropriate key management.

Do not claim "absolute privacy" unless the architecture actually supports that promise.

---

# Phase 11: Offline Support & Reliability

## Goal

Allow journals to be safely captured even without a stable connection.

## Features

- local storage / SQLite
- offline entry creation
- queued uploads
- sync when connectivity returns
- retry failed processing
- conflict handling
- clear sync state

This phase comes after the core retrieval loop works.

---

# Phase 12: AI Reflection / RAG Chat

## Goal

Use the existing retrieval engine as context for optional AI reflection.

This is **not** the core retrieval architecture.

RAG should reuse the same search pipeline:

```text
user question
↓
hybrid retrieval
↓
best journal entries / chunks
↓
temporary context
↓
LLM
↓
grounded response
```

Possible questions:

- "How has my thinking about my career changed?"
- "What was I worried about before that interview?"
- "What patterns show up around this relationship?"

AI responses should reference the underlying journal evidence when possible.

RAG does not eliminate hallucinations automatically.

Prompts and UI should distinguish:

- what the user explicitly wrote
- what the model is inferring

---

# Phase 13: Notifications & Retention

## Goal

Lower the barrier to consistently adding context.

Potential features:

- optional daily capture reminder
- weekly reminder
- "anything worth remembering today?"
- memory resurfacing later

Notifications should remain optional.

Do not force daily reflection as a requirement to use Qora.

---

# Phase 14: Production Polish & EAS Build

## Goal

Prepare Qora for real-device production distribution.

## Deliverables

- app icons
- splash screen
- permissions text
- production environment configuration
- EAS Build
- iOS production build
- Android production build
- error monitoring
- release testing

---

# Part 9: MVP Priority

The MVP should prove:

> **Can a user put almost any kind of journal entry into Qora and reliably find the right entry later using normal language?**

Priority order:

1. reliable text storage
2. reliable voice transcription
3. handwriting ingestion
4. whole-entry embeddings
5. long-entry chunking
6. chunk embeddings
7. hybrid semantic + keyword retrieval
8. relevance ranking
9. useful matched previews
10. selection + context export

Do not prioritize before this works:

- generic AI chat
- complicated agent systems
- elaborate mood analytics
- social features
- heavy topic tagging systems
- automatic psychological conclusions
- infrastructure for massive scale
- complex event graphs
- daily forced reflection

---

# Part 10: Engineering Principles

## 1. Preserve before analyzing

Never risk losing a journal because AI processing failed.

```text
save first
process second
```

## 2. Original entry is the source of truth

Summaries, embeddings, extracted text, and chunks exist to improve retrieval.

They should never silently overwrite the original journal.

## 3. Optimize for retrieval quality

The system should answer:

> "Which actual journal entries best match what this user means?"

not:

> "Which vectors happen to be mathematically closest?"

## 4. Use multiple retrieval signals

```text
metadata
+
whole-entry meaning
+
specific chunk meaning
+
exact language
```

## 5. Return journals, not chunks

Chunks are internal retrieval units.

The user ultimately interacts with complete journal entries.

## 6. Do not manufacture missing context

If a user recorded only:

```text
"Rough day. Argument with Sarah."
```

Qora may retrieve that entry for queries about Sarah or arguments.

It should not invent the cause, meaning, or emotional depth that was never recorded.

## 7. Keep the architecture simple

For the initial product:

```text
Supabase Postgres
+
pgvector
+
Postgres full-text search
+
Supabase Auth / RLS
+
backend AI functions
```

is sufficient.

Do not add a separate vector database or Elasticsearch unless actual scale / performance requirements justify it.

---

# Final System Mental Model

```text
               QORA

       CAPTURE ANYTHING
       /      |       \
    Voice    Text   Handwriting
       \      |       /
        NORMALIZE TO TEXT
               ↓
        STORE FULL ENTRY
               ↓
       BUILD SEARCH INDEX
        /      |       \
 whole vec   chunks   keywords
               ↓
         JOURNAL BANK
               ↓
        USER SEARCH QUERY
               ↓
     UNDERSTAND + FILTER
               ↓
        HYBRID RETRIEVAL
               ↓
     GROUP + RANK ENTRIES
               ↓
     RELEVANT PREVIEWS
               ↓
       OPEN FULL JOURNAL
               ↓
          SELECT ENTRIES
               ↓
        CONTEXT BRIEF
               ↓
   THERAPIST / AI / SELF
```

The core product is:

> **Capture context now. Retrieve the right context later.**
