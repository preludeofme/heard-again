# Invention #5 — Multi-Tenant Speech Consent Management

> **Draft status note:** This file contains invention notes and may mix implemented behavior with proposed embodiments. Review [`08-PATENT_REVIEW_CRITIQUE.md`](./08-PATENT_REVIEW_CRITIQUE.md) before relying on it for attorney handoff.

> **Inventor:** Ryan Buck
> **Category:** Data Privacy / Biometric Consent Management
> **Related Files:** `prisma/schema.prisma` (VoiceConsent, AuditLog, VoiceProfile), `TTS/app/services/`

---

## 1. Problem

Voice cloning is an emotionally sensitive and legally complex technology, especially in a genealogical context. Key problems:

1. **Who can authorize cloning a deceased person's voice?** Spouse? Child? Sibling? All of the above?
2. **How do you prove consent was given?** Attestation text, timestamps, and audit trails are needed
3. **How do you revoke consent?** Once a voice profile exists, can you guarantee it can't be used?
4. **Different consent levels**: Some families are comfortable with local generation only; others allow cloud processing; others allow sharing with extended family
5. **GDPR / CCPA compliance**: Users must be able to delete their data, including cloned voice models

---

## 2. The Invention

### 2.1 Consent Model (Prisma)

```prisma
model VoiceConsent {
  id                    String        @id @default(uuid())
  familyspaceId         String
  personId              String?       // Person whose voice is being cloned
  voiceProfileId        String?       // Specific profile (optional)
  consentType           ConsentType   // RECORDING | SYNTHESIS | DISTRIBUTION
  grantedByUserId       String        // Who granted this consent
  attestationText       String?       // "I, John Doe, grant consent for..."
  allowsGeneration      Boolean       @default(true)
  allowsCloudProcessing Boolean       @default(false)
  allowsSharing         Boolean       @default(false)
  recordedAt            DateTime
  updatedAt             DateTime
  revokedAt             DateTime?     // When/if consent was revoked
  metadata              Json?
}
```

### 2.2 Consent Types (Enum)

```prisma
enum ConsentType {
  RECORDING    // Consent to USE a recording for cloning
  SYNTHESIS    // Consent to GENERATE speech from a clone
  DISTRIBUTION // Consent to SHARE the clone or generated audio
}
```

### 2.3 Consent Lifecycle

```
                    ┌──────────────────────────────┐
                    │     INITIAL STATE             │
                    │  No voice profile exists       │
                    │  No consent records             │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
                    │     CONSENT GRANTED           │
                    │  User records attestation     │
                    │  - consentType                 │
                    │  - allowsGeneration            │
                    │  - allowsCloudProcessing       │
                    │  - attestationText             │
                    │  - HMAC-signed token issued    │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
                    │     ACTIVE USE                │
                    │  - Voice profile created      │
                    │  - Synthesis permitted         │
                    │  - Token validated per request │
                    │  - Audit log of each use       │
                    └──────────┬───────────────────┘
                               │
                    ┌──────────▼───────────────────┐
                    │     CONSENT REVOKED           │
                    │  - revokedAt = now()           │
                    │  - All tokens invalidated      │
                    │  - Profile encrypted/archived  │
                    │  - Audit log of revocation     │
                    │  - (Optional: delete profile)  │
                    └───────────────────────────────┘
```

### 2.4 Consent Enforcement at the Service Level

The TTS service enforces consent at the **synthesis call level**, not just at profile creation. Even if a voice profile exists:

```python
# TTS synthesis endpoint pseudocode
@app.post("/api/tts/synthesize")
async def synthesize(request, token):
    # 1. Validate HMAC consent token
    consent_validator.validate_token(token, request.familyspace_id, request.profile_id)
    
    # 2. Check profile has active consents
    profile = get_profile(request.profile_id)
    if not profile.has_active_consents:
        raise HTTPException(403, "No active consents for this voice")
    
    # 3. Check cloud processing consent
    if request.use_cloud and not profile.allows_cloud_processing:
        raise HTTPException(403, "Cloud processing not authorized")
    
    # 4. Proceed with synthesis
    audio = synthesize(profile, request.text, request.style)
    return audio
```

### 2.5 Encryption-at-Rest Enforcement

Voice profile model weights (`.pt` files) are encrypted at rest:

```python
# On write:
encrypted = encryption_service.encrypt_bytes(profile_weights, familyspace_id)
write_to_storage(encrypted)

# On read:
encrypted = read_from_storage(path)
profile_weights = encryption_service.decrypt_bytes(encrypted, familyspace_id)
```

This means:
- **Storage compromise ≠ voice profile compromise**
- **Familyspace isolation** — even with the master key, you need the familyspace-specific derived key
- **Revocation** — when consent is revoked, the key can be rotated and the old encrypted data discarded

### 2.6 Audit Trail

Every consent event is recorded in the `AuditLog`:

```prisma
model AuditLog {
  id           String
  familyspaceId String
  actorId      String?
  actorType    ActorType   // USER | SYSTEM | API_KEY
  action       String      // "VOICE_CONSENT_GRANTED" | "VOICE_CONSENT_REVOKED"
  resourceType String      // "VoiceConsent" | "VoiceProfile"
  resourceId   String?
  beforeState  Json?       // Snapshot before the change
  afterState   Json?       // Snapshot after the change
  ipAddress    String?
  userAgent    String?
  createdAt    DateTime
}
```

### 2.7 Multi-User Granular Permissions

Membership roles include voice-specific permissions:

```prisma
model Membership {
  canManageVoices  Boolean?   // Can create/manage voice profiles
  // ...
}
```

This allows family spaces to designate specific members as "voice stewards" who manage voice cloning within the group.

---

## 3. Prior Art Distinction

| Feature | ElevenLabs | Resemble AI | Play.ht | Heard Again |
|---------|-----------|-------------|---------|-------------|
| Multi-party consent | ✗ | ✗ | ✗ | ✓ |
| Per-family encryption | ✗ | ✗ | ✗ | ✓ |
| Granular consent levels | ✗ | ✗ | ✗ | ✓ (generation/cloud/sharing) |
| Consent audit trail | ✗ | ✗ | ✗ | ✓ |
| HMAC-signed consent tokens | ✗ | ✗ | ✗ | ✓ |
| Revocable consent with encryption | ✗ (manual delete) | ✗ | ✗ | ✓ (key rotation) |
| Role-based voice management | ✗ | ✗ | ✗ | ✓ (canManageVoices) |
| Open-source on-premises option | ✗ | ✗ | ✗ | ✓ |

---

## 4. Claims Ideas

1. **A multi-tenant voice consent management system** comprising: a database of consent records associating a person, a tenant group (familyspace), and a grantor user; an HMAC-signed consent token generator; and a voice synthesis engine that validates the token and checks the consent record before generating speech.

2. **The system of claim 1** wherein the consent record includes three independent permission flags: `allowsGeneration`, `allowsCloudProcessing`, and `allowsSharing`.

3. **The system of claim 1** wherein voice profile model weights are encrypted at rest using a key derived from both a master secret and a tenant-specific identifier, such that revocation of tenant access renders the voice profile unusable.

4. **A method for consent lifecycle management** comprising: recording a consent grant with user attestation; issuing a time-limited HMAC-signed token for service-to-service authentication; logging each consent-related action to an immutable audit trail; and supporting revocation that marks the consent as revoked and triggers cryptographic key rotation.

---

## 5. Related Source Files

| File | Purpose |
|------|---------|
| `TTS/app/services/consent_validator.py` | HMAC token validation |
| `TTS/app/services/encryption_service.py` | AES-256-GCM encryption |
| `TTS/app/services/gcs_profile_storage.py` | Encrypted profile storage |
| `TTS/app/auth.py` | Service authentication |
| `UI/src/pages/api/voice/consent/*` | Consent management API |
| `UI/src/pages/api/voice/profiles/index.ts` | Profile CRUD |
| `prisma/schema.prisma` (VoiceConsent, AuditLog, VoiceProfile, Membership) | Data models |
