# Qora Privacy Architecture — Implementation Plan

## Goal

Implement Qora so journal text is encrypted before it is stored in Supabase, while still allowing the same user to regain access after reinstalling Qora or signing in on another device.

The key model is:

```text
Recovery passphrase
        ↓
derive KEK
        ↓
unlock wrapped MEK
        ↓
MEK decrypts journals
```

Where:

- **MEK (Master Encryption Key):** random 256-bit key that encrypts/decrypts journal data.
- **KEK (Key Encryption Key):** derived from the user's recovery passphrase and used only to encrypt/decrypt the MEK.
- **Wrapped MEK:** encrypted form of the MEK that is safe to store in Supabase.

The usable MEK must never be stored in plaintext in Supabase.

---

# 1. Security Model

Qora should protect against a database/admin user opening Supabase and directly reading journal contents.

Supabase may contain:

```text
- encrypted journal ciphertext
- encrypted/wrapped MEK
- KDF salt
- KDF parameters
- encryption algorithm/version metadata
- normal record IDs/relationships
```

Supabase must not contain:

```text
- plaintext journal text
- plaintext MEK
- recovery passphrase
- KEK
```

Important limitation: if Qora sends decrypted text or the MEK to a backend/AI provider for transcription, embeddings, summaries, or reflection, plaintext may temporarily exist in memory during that operation. This plan secures persistent storage; do not claim the entire AI path is fully zero-knowledge unless that path is separately redesigned.

---

# 2. Cryptography Rules

Do not implement cryptographic primitives manually.

Use vetted libraries/platform APIs.

## Journal encryption

Use authenticated encryption such as:

```text
AES-256-GCM
```

Requirements:

- random 256-bit MEK
- new random nonce/IV for every encryption
- never reuse an IV with the same key
- authentication tag must be verified
- decryption/authentication failure must fail closed

Do not use bare AES-CTR.

## Passphrase → KEK

Use a password KDF, preferably:

```text
Argon2id
```

If the current Expo/React Native stack cannot support a vetted Argon2id implementation safely, use another audited password KDF supported by the platform. Do not write a custom KDF.

Store the non-secret KDF settings with the wrapped MEK:

```text
salt
algorithm
memory cost
iteration/time cost
parallelism
version
```

Never store the passphrase or KEK.

---

# 3. Database Schema

## `user_encryption_keys`

Create a dedicated table:

```text
user_encryption_keys
--------------------------------
user_id                 UUID PK/FK → auth.users.id
wrapped_mek             TEXT / BYTEA
wrapped_mek_iv          TEXT / BYTEA
kdf_salt                TEXT / BYTEA
kdf_algorithm           TEXT
kdf_params              JSONB
encryption_algorithm    TEXT
key_version             INTEGER
created_at              TIMESTAMPTZ
updated_at              TIMESTAMPTZ
```

If the chosen encryption library includes the authentication tag inside the ciphertext, it does not need a separate column.

Every encrypted payload should be versioned, e.g.:

```json
{
  "version": 1,
  "algorithm": "AES-256-GCM",
  "iv": "...",
  "ciphertext": "..."
}
```

## `entries`

Move journal content to encrypted storage:

```text
entries
--------------------------------
id
user_id
source_type
encrypted_content
content_encryption_version
created_at
updated_at
processing_status
original_asset_url
```

Do not persist plaintext `content` once migration is complete.

## `entry_chunks`

If chunk text is stored, it must also be encrypted:

```text
entry_chunks
--------------------------------
id
entry_id
user_id
chunk_index
encrypted_chunk_text
embedding
encryption_version
```

Embeddings are not plaintext but should still be treated as sensitive derived user data.

---

# 4. Local Key Storage

## Native mobile

Store the usable MEK in OS-protected secure storage, e.g. Expo SecureStore.

Scope it to the logged-in user:

```text
qora_mek_<user_id>
```

Never store the MEK in:

```text
AsyncStorage
normal files
Redux persistence
.env
source code
Supabase
logs
analytics
```

## Web

Do not store the raw MEK in `localStorage`.

Use Web Crypto / browser cryptographic key storage where possible. Treat clearing browser/site data as loss of the local MEK copy; the user must restore it with the recovery passphrase or a trusted device.

---

# 5. Account Creation Flow

After Supabase account creation succeeds:

```text
Create account
↓
Generate random MEK locally
↓
User creates recovery passphrase
↓
Generate random KDF salt
↓
Passphrase + salt → KDF → KEK
↓
KEK encrypts/wraps MEK locally
↓
Store wrapped MEK + salt + KDF metadata in Supabase
↓
Store plaintext MEK in local secure storage
```

Detailed steps:

1. Generate 32 random bytes locally for the MEK.
2. Ask user to create and confirm a recovery passphrase.
3. Generate random salt.
4. Derive KEK locally from passphrase + salt + KDF parameters.
5. Encrypt/wrap the MEK using the KEK with authenticated encryption.
6. Store only wrapped MEK + public crypto metadata in `user_encryption_keys`.
7. Store usable MEK in the device's secure storage.
8. Never log passphrase, KEK, or MEK.

UX must state clearly:

> Your recovery passphrase is required if you lose access to all trusted devices. Qora cannot recover it for you.

---

# 6. Normal Same-Device Login

If the user is authenticated and the local MEK exists:

```text
Authenticate account
↓
read local MEK from secure storage
↓
decrypt journal entries locally
```

Do not ask for the recovery passphrase every time Qora opens.

The passphrase is a recovery mechanism, not the normal daily unlock mechanism.

---

# 7. Explicit Logout

For the strongest privacy model, explicit logout should remove the local usable MEK.

```text
User taps Log Out
↓
clear Supabase auth session
↓
delete local MEK
↓
clear decrypted journal caches/state
```

After logging in again, if no trusted-device transfer is used, recovery passphrase is required to restore the MEK.

---

# 8. Reinstall / New Device Recovery — MVP

Never assume the secure-store copy survives uninstall.

When a user signs in and no local MEK exists:

```text
Log into Qora
↓
no local MEK found
↓
fetch wrapped MEK + KDF metadata from Supabase
↓
prompt for recovery passphrase
↓
derive KEK locally
↓
use KEK to unwrap MEK locally
↓
if valid, save MEK in secure device storage
↓
decrypt journals normally
```

If the passphrase is wrong, authenticated decryption of the wrapped MEK fails.

Do not save any candidate MEK when unwrap/authentication fails.

This MVP recovery flow supports:

```text
- app reinstall
- new phone
- laptop/web login
- replacement device
```

as long as the user remembers the recovery passphrase.

---

# 9. Changing the Recovery Passphrase

Do not re-encrypt every journal.

Flow:

```text
old passphrase
↓
derive old KEK
↓
unwrap MEK
↓
new passphrase
↓
new salt + new KEK
↓
rewrap the SAME MEK
↓
replace wrapped MEK metadata in Supabase
```

All existing journal ciphertext remains unchanged because journals are encrypted with the MEK, not directly with the passphrase.

---

# 10. Forgotten Recovery Passphrase

If at least one authorized device still has the MEK:

```text
trusted device already has MEK
↓
user creates new recovery passphrase
↓
derive new KEK
↓
rewrap MEK
↓
update wrapped MEK in Supabase
```

No journal re-encryption is needed.

If:

```text
recovery passphrase forgotten
+
no authorized device still has the MEK
```

then the journals are permanently unrecoverable.

Qora support must not have a hidden bypass if the product wants the strongest privacy model.

---

# 11. Creating a Text Entry

```text
User writes journal
↓
load local MEK
↓
encrypt plaintext locally with AES-256-GCM
↓
send ciphertext to Supabase
↓
store ciphertext only
```

Plaintext must not appear in:

```text
Supabase insert/update bodies
application logs
analytics
Sentry breadcrumbs
crash reports
```

except where an explicitly designed AI-processing flow requires temporary plaintext.

---

# 12. Reading Entries

```text
fetch encrypted entries from Supabase
↓
load local MEK
↓
decrypt locally
↓
render plaintext in Qora
```

Avoid persistent plaintext caches.

---

# 13. Updating Entries

```text
decrypt locally
↓
user edits
↓
encrypt updated plaintext with MEK + fresh IV
↓
replace ciphertext in Supabase
```

Every encryption operation must use a fresh nonce/IV.

---

# 14. Voice and Handwriting

## Voice

```text
record audio
↓
transcribe
↓
plaintext transcript exists temporarily
↓
encrypt transcript with MEK
↓
store ciphertext
```

If audio files are retained, they need their own encryption/privacy treatment.

## Handwriting

```text
image
↓
OCR / vision
↓
plaintext extracted text exists temporarily
↓
encrypt extracted text with MEK
↓
store ciphertext
```

If original images are retained, protect them as sensitive data too.

---

# 15. Search / Embedding Boundary

Qora's retrieval architecture uses:

```text
whole-entry embeddings
chunk embeddings
keyword/full-text logic
```

Embeddings require plaintext to be processed somewhere.

For the practical MVP, clearly define the temporary processing boundary:

```text
decrypt only when needed
↓
process in memory
↓
generate embedding/chunks
↓
encrypt textual outputs before persistence
↓
do not log plaintext or keys
```

If an Edge Function temporarily receives the MEK or plaintext, the database is still encrypted at rest, but the AI/backend path is not fully zero-knowledge.

Do not hide this limitation in product/privacy language.

---

# 16. RLS Requirements

Strict RLS must apply to:

```text
user_encryption_keys
entries
entry_chunks
trusted_devices         (later)
device_key_requests     (later)
```

Users may only access rows belonging to their authenticated `user_id`.

Remember:

```text
RLS = authorization
Encryption = confidentiality
```

Both are required.

---

# 17. Client Crypto Module

Keep cryptography behind one dedicated module rather than scattering crypto code throughout entry services.

Suggested structure:

```text
src/lib/crypto/
├── random.ts
├── kdf.ts
├── journalEncryption.ts
├── keyWrapping.ts
├── secureKeyStore.ts
└── types.ts
```

Suggested high-level API:

```typescript
generateMasterKey()
deriveKeyEncryptionKey(passphrase, salt, params)
wrapMasterKey(mek, kek)
unwrapMasterKey(wrappedMek, kek)
encryptJournalText(plaintext, mek)
decryptJournalText(ciphertext, mek)
saveLocalMasterKey(userId, mek)
getLocalMasterKey(userId)
deleteLocalMasterKey(userId)
```

Entry services should call this abstraction instead of implementing cryptography themselves.

---

# 18. Trusted Device Transfer — Phase 2

After passphrase-based recovery works, add trusted-device authorization so a new device can get the MEK from an already authorized device without typing the recovery passphrase.

User experience:

```text
New laptop logs into Qora
↓
"Approve this device from another Qora device"
↓
trusted phone receives request
↓
user approves
↓
phone securely wraps/transfers MEK for new device
↓
new device stores MEK securely
↓
journals unlock
```

Do not send a plaintext MEK through Supabase.

## Device key design

Each trusted device should have an asymmetric keypair:

```text
private key → remains only on that device
public key  → may be stored in Supabase
```

New device:

```text
generate device keypair
↓
upload public key
↓
create access request
```

Trusted device:

```text
user approves request
↓
use requesting device's public key
↓
securely encrypt/wrap MEK for that device
↓
upload one-time encrypted key package
```

New device:

```text
download package
↓
decrypt with local private key
↓
recover MEK
↓
store MEK in secure storage
```

Use a vetted public-key/key-agreement library and standard protocol. Do not invent a custom asymmetric crypto scheme.

Suggested later tables:

```text
trusted_devices
--------------------------------
id
user_id
device_name
public_key
key_algorithm
created_at
last_seen_at
revoked_at
```

```text
device_key_requests
--------------------------------
id
user_id
requesting_device_id
status
encrypted_key_package
created_at
expires_at
approved_at
```

Requests should expire and be single-use.

---

# 19. Error Handling

Use explicit errors such as:

```text
AUTH_REQUIRED
LOCAL_KEY_MISSING
RECOVERY_REQUIRED
INCORRECT_RECOVERY_PASSPHRASE
DECRYPTION_FAILED
CORRUPTED_CIPHERTEXT
UNSUPPORTED_ENCRYPTION_VERSION
KEY_METADATA_MISSING
```

Never silently return encrypted ciphertext as if it were valid plaintext.

Crypto failures must fail closed.

---

# 20. Logging Rules

Never log:

```text
journal plaintext
MEK
KEK
recovery passphrase
decrypted chunk text
decrypted AI context
requests containing raw secrets
```

Audit:

```text
console.log
Sentry
Supabase/Edge Function logs
analytics
crash reports
error serialization
```

Redact sensitive fields.

---

# 21. Migration of Existing Plaintext Entries

If development data already contains plaintext:

```text
obtain/generate user's MEK
↓
read plaintext entry
↓
encrypt it
↓
write ciphertext
↓
verify it decrypts correctly
↓
only then remove plaintext data
```

Do not delete plaintext before ciphertext has been verified.

---

# 22. Implementation Phases

## Phase 1 — Crypto foundation

- crypto abstraction/module
- secure random MEK generation
- AES-256-GCM encryption/decryption
- KDF implementation
- MEK wrapping/unwrapping
- SecureStore integration
- versioned ciphertext envelopes
- unit tests

## Phase 2 — Account privacy setup

- recovery-passphrase setup screen
- generate MEK
- derive KEK
- wrap MEK
- create `user_encryption_keys`
- store local MEK securely

## Phase 3 — Encrypt text entries

- encrypt before insert/update
- decrypt after fetch
- remove plaintext persistence
- audit logs/cache behavior

## Phase 4 — Reinstall/new-device recovery

- detect missing MEK
- fetch wrapped MEK metadata
- recovery-passphrase screen
- unwrap MEK locally
- save MEK securely
- unlock journals

## Phase 5 — Passphrase management

- change passphrase
- rewrap same MEK
- restore recovery while trusted device still exists

## Phase 6 — Voice/handwriting protection

- encrypt transcript text
- encrypt OCR/vision text
- decide how raw audio/images are encrypted

## Phase 7 — Search/index integration

- encrypted chunk text at rest
- controlled plaintext boundary for embeddings
- no plaintext logging
- verify semantic retrieval still works

## Phase 8 — Trusted device authorization

- device keypairs
- trusted device registry
- access request flow
- approval UI
- secure MEK wrapping for new device
- expiration/revocation

Build Phase 8 only after passphrase recovery is stable.

---

# 23. Verification Tests

## New account

1. Create account and recovery passphrase.
2. Confirm `user_encryption_keys` contains a wrapped MEK.
3. Confirm Supabase contains no plaintext MEK.
4. Confirm local secure storage contains the usable MEK.

## Text journal

1. Save `This is a secret journal entry.`
2. Inspect Supabase.
3. Confirm only ciphertext is present.
4. Reopen Qora.
5. Confirm plaintext renders correctly.

## Wrong recovery passphrase

1. Remove local MEK in development.
2. Log in.
3. Enter wrong passphrase.
4. Confirm unwrap fails.
5. Confirm no invalid MEK is saved.
6. Journals remain locked.

## Reinstall simulation

1. Create encrypted journals.
2. Delete local MEK.
3. Log in again.
4. Enter correct passphrase.
5. Confirm MEK is restored.
6. Confirm old journals decrypt.

## Second-device simulation

1. Use clean second client.
2. Log in.
3. Confirm journals cannot decrypt without MEK.
4. Enter recovery passphrase.
5. Recover MEK.
6. Confirm same journals decrypt.

## Passphrase change

1. Unlock using old passphrase.
2. Change recovery passphrase.
3. Confirm same MEK remains in use.
4. Delete local MEK.
5. Old passphrase must fail.
6. New passphrase must restore journals.
7. Existing entry ciphertext should not need to change.

## Ciphertext tampering

1. Modify ciphertext manually in Supabase.
2. Attempt decryption.
3. Authentication must fail.
4. Qora must not display garbage as journal text.

## Explicit logout

1. Confirm local MEK exists.
2. Log out.
3. Confirm local MEK is deleted.
4. Log back in.
5. Confirm recovery is required unless trusted-device transfer is used.

---

# 24. Security Invariants

The implementation is not complete unless all of these remain true:

```text
1. Supabase never stores plaintext journal text.
2. Supabase never stores the plaintext MEK.
3. Qora never stores the recovery passphrase.
4. Qora never persists the KEK.
5. Persistent journal text uses authenticated encryption.
6. Every encryption uses a fresh nonce/IV.
7. MEK is random and independent of the passphrase.
8. Passphrase derives KEK; KEK only protects MEK.
9. Changing passphrase only rewraps MEK.
10. Missing MEK means journals stay locked.
11. Crypto failures fail closed.
12. Secrets/plaintext never appear in logs.
13. RLS scopes all data to the authenticated user.
14. No hidden admin recovery key exists.
15. Forgotten passphrase + no trusted MEK copy = permanent loss of access.
```

---

# 25. Final Mental Model

```text
                 ACCOUNT CREATION

Qora generates random MEK
        ↓
User creates recovery passphrase
        ↓
Passphrase → KDF → KEK
        ↓
KEK wraps MEK
        ↓
Supabase stores:
- wrapped MEK
- salt/KDF metadata
- encrypted journals

Device stores:
- usable MEK in secure storage

Supabase does NOT store:
- plaintext MEK
- passphrase
- KEK
- plaintext journals
```

```text
                 NORMAL USE

Journal plaintext
↓
MEK encrypts locally
↓
Supabase stores ciphertext

Supabase returns ciphertext
↓
MEK decrypts locally
↓
User reads journal
```

```text
              REINSTALL / NEW DEVICE

Log in
↓
No local MEK
↓
Fetch wrapped MEK
↓
Enter recovery passphrase
↓
Passphrase derives KEK
↓
KEK unwraps MEK locally
↓
MEK saved securely on device
↓
Journals unlock
```

```text
              LATER: TRUSTED DEVICE

New device requests access
↓
Existing trusted device approves
↓
Existing device securely wraps MEK for new device
↓
New device unwraps it locally
↓
Journals unlock
```

---

# 26. MVP Definition of Done

The privacy MVP is complete when:

```text
✓ each user gets one random MEK
✓ user creates a recovery passphrase
✓ passphrase derives KEK locally
✓ KEK wraps MEK
✓ Supabase stores only wrapped MEK
✓ usable MEK is stored only on authorized device storage
✓ text entries are encrypted before persistence
✓ text entries decrypt locally
✓ Supabase admin cannot directly read journal bodies
✓ reinstall/new-device login can restore MEK with recovery passphrase
✓ wrong passphrase cannot restore MEK
✓ explicit logout removes local MEK
✓ passphrase change rewraps MEK instead of all journals
✓ no plaintext/keys/passphrases leak into logs
```

Trusted-device transfer is the next step after this MVP is proven.

The core rule is:

> **If Qora can independently recover a user's usable MEK without a trusted device or the user's recovery secret, then Qora also has a path to decrypt that user's journals. Do not add such a recovery path if the product wants the strongest privacy model.**
