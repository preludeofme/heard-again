# Invention #1 — Consent-First Voice Cloning Pipeline

> **Inventor:** Ryan Buck
> **Category:** Voice Cloning / Biometric Synthesis with Privacy Controls
> **Related Files:** `TTS/app/`, `UI/src/pages/api/voice/`, `TTS/app/services/`

---

## 1. Problem

Voice cloning technology has advanced rapidly (ElevenLabs, Resemble AI, etc.), but existing solutions lack **genealogical consent workflows** appropriate for cloning the voices of deceased family members. Deployments typically require a single user's consent per voice. For family use cases, **multiple stakeholders** (the subject's life partner, children, siblings, estate executor) may need to consent before a deceased person's voice is cloned from their surviving audio recordings.

Additionally, existing solutions store voice profiles as opaque model weights with no per-family encryption, no audit trail of who consented (and when), and no mechanism to **revoke** consent and delete the cloned model.

---

## 2. The Invention

A complete voice cloning pipeline with:

### 2.1 Multi-Party Consent Architecture

```
Family Member A (spouse)
  └─ Grants consent ✓
Family Member B (child)                         
  └─ Grants consent ✓              ┌─────────────────────┐
Family Member C (sibling)          │ VoiceConsent table:  │
  └─ Grants consent ✓       ─────→ │  - personId           │
                                   │  - consentType         │
                                   │  - attestationText     │
                                   │  - allowsGeneration    │
                                   │  - allowsCloudProcessing│
                                   │  - allowsSharing       │
                                   │  - revokedAt?          │
                                   │  - HMAC-signed token   │
                                   └─────────────────────┘
```

**Database Model** (`VoiceConsent` in Prisma schema):
- `familyspaceId` — scoped to a family group
- `personId` — the person whose voice is being cloned
- `voiceProfileId` — optional, specific voice profile
- `consentType` — enum for type of consent
- `grantedByUserId` — who granted this consent
- `attestationText` — optional recorded statement
- `allowsGeneration` — whether synthesis is permitted
- `allowsCloudProcessing` — whether data can leave local GPU
- `allowsSharing` — whether the voice can be shared
- `revokedAt` — nullable, consent revocation timestamp

### 2.2 HMAC-Signed Consent Tokens

The TTS service does **not** trust the UI by default. Each synthesis request must carry a valid consent token.

```python
# TTS/app/services/consent_validator.py
class ConsentValidator:
    def validate_token(self, token, familyspace_id, profile_id):
        # Token format: base64(json_payload).hex_signature
        body_b64, signature = token.split('.', 1)
        
        # HMAC-SHA256 verification
        expected = hmac.new(secret, body_b64.encode(), sha256).hexdigest()
        if not hmac.compare_digest(signature, expected):
            raise HTTPException(403, "Invalid consent token")
        
        # Check expiration, familyspace, and profile match
        payload = json.loads(base64.b64decode(body_b64))
        if payload.get('exp', 0) < time.time():
            raise HTTPException(403, "Consent token expired")
        if payload.get('familyspaceId') != familyspace_id:
            raise HTTPException(403, "Familyspace mismatch")
```

### 2.3 Per-Familyspace Voice Profile Encryption

Voice profile model weights (`.pt` files) are encrypted at rest using **AES-256-GCM** with a key derived per-familyspace:

```python
# TTS/app/services/encryption_service.py
class EncryptionService:
    def _get_familyspace_key(self, familyspace_id: str) -> bytes:
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=familyspace_id.encode('utf-8'),
            iterations=1000,
        )
        return kdf.derive(self.master_key)
    
    def encrypt_bytes(self, data: bytes, familyspace_id: str) -> bytes:
        key = self._get_familyspace_key(familyspace_id)
        aesgcm = AESGCM(key)
        nonce = os.urandom(12)
        ciphertext = aesgcm.encrypt(nonce, data, None)
        return nonce + ciphertext  # Stored format
```

This means:
- Even if the storage bucket is compromised, voice profiles are unreadable
- Revoking a familyspace-wide key renders all profiles inaccessible
- Each family group has cryptographic isolation

### 2.4 Audit Logging

Every consent grant, denial, and revocation is logged to the `AuditLog` table with:
- `actorId` — who performed the action
- `action` — e.g., "VOICE_CONSENT_GRANTED", "VOICE_CONSENT_REVOKED"
- `resourceType` / `resourceId` — which voice profile or person
- `beforeState` / `afterState` — JSON snapshots for full audit trail

### 2.5 Voice Profile Lifecycle

```
1. UPLOAD REFERENCE → Upload short audio recording (10-60 sec)
2. CREATE PROFILE → Generate .pt voice profile from reference
3. GRANT CONSENT → Multi-party attestation (optional)
4. SYNTHESIZE → Generate speech with style presets
5. REVOKE → Invalidate consent, delete profile (or encrypt-lock)
```

---

## 3. Prior Art Distinction

| Feature | Prior Art (ElevenLabs, Resemble) | Heard Again |
|---------|----------------------------------|-------------|
| Multi-party consent | None | VoiceConsent table with audit trail |
| Per-family encryption | None | AES-256-GCM with PBKDF2 per-familyspace key |
| Consent token verification | None | HMAC-signed tokens validated by TTS service |
| Revocable consent | Manual deletion only | Timestamp-based revocation with audit |
| Cloud processing opt-in | All-or-nothing | Per-profile `allowsCloudProcessing` flag |
| Open-source model | ✗ (proprietary) | Qwen3-TTS (Apache 2.0) |

---

## 4. Claims Ideas

1. **A system for multi-party consent-gated voice cloning** comprising: a database storing consent records with personId, grantorUserId, consentType, and attestationText; a consent token generator producing HMAC-signed tokens; and a TTS engine that validates the token before synthesizing speech from a cloned voice profile.

2. **The method of claim 1** wherein consent records include an `allowsCloudProcessing` flag that, when false, restricts synthesis to local GPU inference only.

3. **The method of claim 1** wherein voice profile weights are encrypted at rest using a per-family derivation key (PBKDF2 + AES-256-GCM) so that compromise of storage does not expose the cloned voice.

4. **A consent revocation workflow** wherein setting a `revokedAt` timestamp on a consent record triggers cryptographic key rotation that renders the associated voice profile inaccessible.

---

## 5. Related Source Files

| File | Purpose |
|------|---------|
| `TTS/app/services/consent_validator.py` | HMAC token validation |
| `TTS/app/services/encryption_service.py` | AES-256-GCM per-family encryption |
| `TTS/app/services/gcs_profile_storage.py` | Encrypted profile storage |
| `UI/src/pages/api/voice/profiles/index.ts` | Voice profile CRUD API |
| `UI/src/pages/api/voice/consent/*` | Consent management API routes |
| `UI/src/pages/api/voice/jobs/*` | Generation job queue with consent check |
| `prisma/schema.prisma` (VoiceConsent, VoiceProfile, VoiceGenerationJob, AuditLog) | Data models |
