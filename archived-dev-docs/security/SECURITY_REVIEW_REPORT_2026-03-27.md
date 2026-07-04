# Security Review Report — Heard Again Application

**Date:** March 27, 2026  
**Reviewer:** Senior Application Security Reviewer  
**Classification:** Internal — High Sensitivity

---

## Executive Summary

The application demonstrates **strong security architecture** in critical areas including tenant isolation, file upload security, and authentication. Most high-risk areas are properly protected. Several **medium/low risk findings** were identified that warrant attention.

**Key Strengths:**
- ✅ Proper tenant isolation at database layer
- ✅ File upload security with magic byte validation
- ✅ Path traversal protection in storage layer
- ✅ Authentication enforced consistently across API routes
- ✅ CSRF protection on state-changing operations

---

## Critical Findings (0)

**No critical exploitable vulnerabilities were identified.**

---

## High Findings (1)

### 1. MFA Implementation is Non-Functional (Placeholder Code)

| Attribute | Details |
|-----------|---------|
| **Severity** | High |
| **Status** | Exploitable |
| **File** | `@/src/lib/security/mfa.ts:80-86` |
| **classificationConfidence** | 0.95 |

**Issue:** The MFA verification function is stubbed with a TODO comment and only validates token format (6 digits), not actual TOTP values:

```typescript
// TODO: Implement TOTP verification
// For now, just check that token exists and is reasonable format
if (mfaToken.length !== 6 || !/^\d{6}$/.test(mfaToken)) {
  return false
}
return true  // ANY 6-digit code passes!
```

**Exploit Scenario:**
1. Attacker compromises user credentials via phishing or password reuse
2. Attacker calls `/api/voice/train` (voice training endpoint) which requires MFA
3. Attacker provides any 6-digit number (e.g., `000000`) as `mfaToken`
4. MFA check passes, allowing sensitive voice training operations

**Data Compromised:** Voice cloning capabilities, potentially allowing unauthorized voice synthesis of deceased family members' voices.

**Remediation:** Implement actual TOTP verification using `speakeasy` or `otplib` libraries before deploying MFA-protected features to production.

---

## Medium Findings (4)

### 2. CSRF Token Storage in Redis Without User Binding

| Attribute | Details |
|-----------|---------|
| **Severity** | Medium |
| **Status** | Risky Pattern |
| **File** | `@/src/lib/security/csrf.ts:17-20` |
| **classificationConfidence** | 0.70 |

**Issue:** CSRF tokens are stored keyed only by session ID, not bound to the specific user/session combination:

```typescript
const key = `csrf:${sessionId}`  // Any session with this ID can use the token
await redis.setex(key, 28800, token)
```

**Exploit Scenario:**
1. Attacker obtains a valid CSRF token (via XSS on another subdomain, network sniffing on HTTP connection, or physical access)
2. Attacker creates a new session (or uses session fixation)
3. If attacker can manipulate their session ID to match the token's session ID, CSRF protection is bypassed
4. Attacker can execute state-changing operations (DELETE, PUT) on victim's behalf

**Risk:** Session fixation attacks combined with CSRF token theft could bypass protection.

**Note:** This requires multiple preconditions to exploit; rated medium due to complexity of exploitation chain.

---

### 3. Missing Rate Limiting on Public Health Endpoints

| Attribute | Details |
|-----------|---------|
| **Severity** | Medium |
| **Status** | Exploitable |
| **File** | `@/tts-service/app/main.py:123-132` |
| **classificationConfidence** | 0.80 |

**Issue:** The `/api/tts/health` endpoint in the TTS service is unprotected and reveals internal system state without rate limiting:

```python
@app.get("/api/tts/health")
async def health_check():
    return {
        "status": "ok",
        "base_model_loaded": model_manager.base_loaded,
        "base_model_name": model_manager.base_model_name,
        # ...
    }
```

**Exploit Scenario:**
1. Attacker repeatedly polls `/api/tts/health` to monitor system state
2. During model loading/unloading operations, attacker detects timing windows
3. Attacker combines with other vulnerabilities to exploit race conditions
4. Information leakage about GPU status, model names, and internal configuration aids reconnaissance

**Remediation:** Add rate limiting middleware to health endpoints; consider requiring authentication for detailed health data.

---

### 4. Local Storage Provider Missing File Extension Validation

| Attribute | Details |
|-----------|---------|
| **Severity** | Medium |
| **Status** | Risky Pattern |
| **File** | `@/src/lib/storage/providers/local-provider.ts:27-43` |
| **classificationConfidence** | 0.75 |

**Issue:** While `sanitizePath()` prevents path traversal, the `uploadFile` method accepts any filename without validating the extension matches the detected MIME type:

```typescript
async uploadFile(file: Buffer | File, filename: string, mimeType: string, ...): Promise<...> {
  // filename passed directly without extension validation
  const fullPath = this.sanitizePath(storagePath)
  await fs.writeFile(fullPath, buffer)  // Could write .exe, .sh, etc.
}
```

**Exploit Scenario:**
1. Attacker uploads a file with magic bytes matching allowed type (e.g., `audio/mpeg`)
2. Attacker sets `originalName` to `malicious.exe`
3. File passes content validation but is saved as `.exe` extension
4. If local filesystem is browsable or if file is later served with `Content-Disposition: attachment`, user could be tricked into executing malicious file

**Risk:** Social engineering attack combining file upload with misleading extension.

**Remediation:** Enforce extension based on detected MIME type in `generateFilename()` method.

---

### 5. Prisma Query Logging May Expose Sensitive Data

| Attribute | Details |
|-----------|---------|
| **Severity** | Medium |
| **Status** | Risky Pattern |
| **classificationConfidence** | 0.60 |

**Issue:** Throughout the application, Prisma queries include sensitive fields without explicit filtering. If `prisma.$on('query')` logging is enabled or if error stacks are logged, sensitive data may be exposed:

```typescript
// Example from voice training
const profile = await prisma.voiceProfile.create({
  data: {
    // ...
    externalId: ttsProfileId,  // Links to external service
    // ...
  },
})
```

**Exploit Scenario:**
1. Application error occurs in production
2. Error logging captures full Prisma query with parameters
3. Logs are stored insecurely or exposed through log aggregation service
4. Attacker with log access can reconstruct voice profile mappings and familyspace relationships

**Status:** Informational/Defense in Depth — requires compromised log infrastructure to exploit.

---

## Low Findings (3)

### 6. avatarAsset Selects storagePath but Never Sanitizes in Response

| Attribute | Details |
|-----------|---------|
| **Severity** | Low |
| **Status** | Not Currently Exploitable |
| **File** | `@/src/pages/api/people/[id].ts:15-17` |
| **classificationConfidence** | 0.50 |

**Issue:** Person endpoint selects `storagePath` in the database query but the response doesn't explicitly remove it (relying on the select statement):

```typescript
avatarAsset: {
  select: { id: true, storagePath: true, mimeType: true },  // storagePath selected
},
```

The response construction (lines 129-150) doesn't include `avatarAsset` directly, but if future code modifications inadvertently expose this field, `storagePath` would leak.

**Status:** Not currently exploitable — defense in depth recommendation to remove from select.

---

### 7. TTS Service Error Messages May Leak Internal Paths

| Attribute | Details |
|-----------|---------|
| **Severity** | Low |
| **Status** | Risky Pattern |
| **File** | `@/tts-service/app/main.py:365-368` |
| **classificationConfidence** | 0.65 |

**Issue:** Voice profile creation errors return raw exception details:

```python
except Exception as e:
    await log_auth_event('VOICE_PROFILE_ERROR', auth_data, {'error': str(e)})
    raise HTTPException(status_code=500, detail=str(e))  # Raw error to client!
```

**Exploit Scenario:**
1. Attacker provides malformed audio file causing processing error
2. Error message contains Python stack trace with internal file paths:
   - `/app/tts-service/app/model_manager.py:245`
   - `/app/tts-service/data/profiles/familyspace-123/`
3. Information aids attacker in reconnaissance for further attacks

**Remediation:** Return generic error messages to clients; log detailed errors server-side only.

---

### 8. Middleware Does Not Protect API Routes

| Attribute | Details |
|-----------|---------|
| **Severity** | Low |
| **Status** | Design Decision |
| **File** | `@/src/middleware.ts:15-16` |
| **classificationConfidence** | 0.40 |

**Issue:** API routes are explicitly excluded from middleware authentication checks:

```typescript
if (pathname.startsWith('/_next') || pathname.startsWith('/api/')) {
  return NextResponse.next()  // API routes bypass middleware auth check!
}
```

**Risk:** API routes must implement their own authentication. This is architecturally sound but requires that **every** API route properly authenticates.

**Status:** Design decision, not vulnerability — but increases risk of developer error. All examined API routes properly authenticate via `getAuthUserWithFamilyspace()`.

---

## Positive Security Controls Observed

| Control | Implementation | Location |
|---------|---------------|----------|
| **Tenant Isolation** | All database queries filter by `familyspaceId` | Throughout API routes |
| **Path Traversal Prevention** | `sanitizePath()` with `path.resolve()` check | `@/lib/storage/providers/local-provider.ts:27-43` |
| **File Content Validation** | Magic byte + file-type detection | `@/lib/security/file-validator.ts:61-131` |
| **CSRF Protection** | Server-side token validation with Redis | `@/lib/security/csrf.ts:25-74` |
| **Rate Limiting** | Middleware applied to asset serving | `@/src/pages/api/assets/serve/[id].ts:10` |
| **Security Headers** | CSP, X-Content-Type-Options, etc. | `@/lib/security/security-headers.ts` |
| **TTS Service Auth** | JWT validation with NextAuth | `@/tts-service/app/auth.py:34-103` |
| **Familyspace-scoped File Storage** | Files organized by familyspace ID | `@/tts-service/app/main.py:190-192` |
| **Asset Response Sanitization** | `storagePath` removed from responses | `@/lib/api-helpers.ts:10-15` |

---

## Summary Statistics

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | ✓ |
| High | 1 | MFA stub needs implementation |
| Medium | 4 | Improvements recommended |
| Low | 3 | Defense in depth |
| **Total** | **8** | **0 exploitable without preconditions** |

---

## Risk Assessment

**Current Security Posture:** **STRONG**

The application demonstrates mature security practices with proper tenant isolation, file upload security, path traversal protection, and consistent authentication enforcement.

**Primary Concerns:**
1. **MFA is non-functional** — This is a high-priority item if MFA is advertised or required
2. **Error handling** in TTS service could leak internal paths
3. **Rate limiting gaps** on health/monitoring endpoints

**No cross-account access vulnerabilities were identified.** The application properly enforces familyspace isolation across all examined endpoints.

---

## Recommendations Priority

### Immediate (Before Production)
1. **Implement real TOTP verification** in `mfa.ts` or disable MFA requirements
2. **Sanitize TTS service error messages** — return generic messages to clients

### Short-term (1-2 Sprints)
3. **Add rate limiting** to `/api/tts/health` and other public endpoints
4. **Enforce file extensions** match detected MIME types
5. **Remove `storagePath` from avatarAsset select** in person endpoint

### Ongoing
6. **Review Prisma query logging** configuration in production
7. **Consider requiring authentication** for health check endpoints
8. **Bind CSRF tokens** to user+session combination, not just session ID
