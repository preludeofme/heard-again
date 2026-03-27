# Heard Again - Security Review Report

## A. Executive Summary

**Overall Security Posture: CRITICAL VULNERABILITIES PRESENT**

The application handles highly sensitive family history content but has several critical security flaws that make it **UNSAFE FOR PRODUCTION** in its current state. While some good security practices are implemented (workspace-based tenant isolation, proper authentication flows), there are severe vulnerabilities that could lead to complete tenant isolation bypass, file leakage, and potential server compromise.

**Top 10 Highest-Risk Findings:**
1. **CRITICAL**: No file type validation by content - MIME/extension spoofing allows malicious file uploads
2. **CRITICAL**: TTS service runs with wildcard CORS (`allow_origins=["*"]`) - complete bypass of Same-Origin Policy
3. **CRITICAL**: File optimization pipeline processes untrusted files without sandboxing
4. **HIGH**: Local storage paths potentially exposed through predictable URLs
5. **HIGH**: No malware scanning or quarantine for uploaded files
6. **HIGH**: Database credentials and secrets in plaintext environment files
7. **HIGH**: Missing rate limiting on API endpoints
8. **HIGH**: No input validation on TTS service endpoints
9. **MEDIUM**: Long-lived sessions (30 days) without re-authentication
10. **MEDIUM**: Insufficient logging and audit trails for security events

**Production Readiness: FAIL**
The application is **NOT SAFE** for highly sensitive family documents in its current state.

**Biggest Tenant Isolation Risks:**
- File upload processing could allow cross-account data exposure through path traversal
- TTS service lacks authentication/authorization boundaries
- Predictable storage URLs could be enumerated

**Biggest File Upload/Server Compromise Risks:**
- No content-based file validation - malicious files can be uploaded
- File optimization libraries process malicious content without sandboxing
- TTS service accepts and processes arbitrary audio files

---

## B. Findings by Severity

### CRITICAL

#### 1. No Content-Based File Validation
- **Severity**: Critical
- **Affected Area**: File upload pipeline (`src/pages/api/assets/upload.ts`)
- **What is wrong**: Files are validated only by MIME type and extension, not actual content
- **Why it matters**: Attackers can upload executables disguised as images/audio/documents
- **Attack scenario**: Upload PHP webshell as `.jpg` file, access via `/api/assets/[id]` endpoint
- **Root cause**: Missing file content verification using magic bytes or file type detection
- **Remediation**: 
  ```typescript
  // Add file-type library for content validation
  import { fileTypeFromBuffer } from 'file-type'
  
  // Validate actual file content
  const fileType = await fileTypeFromBuffer(optimizedBuffer)
  if (!fileType || !ALLOWED_MIME_TYPES.includes(fileType.mime)) {
    throw new Error('Invalid file type detected')
  }
  ```
- **Block Production**: YES

#### 2. TTS Service Wildcard CORS
- **Severity**: Critical  
- **Affected Area**: TTS service (`tts-service/app/main.py:42`)
- **What is wrong**: `allow_origins=["*"]` allows any origin to access TTS endpoints
- **Why it matters**: Complete bypass of browser Same-Origin Policy protections
- **Attack scenario**: Malicious website can make authenticated users' browsers call TTS endpoints
- **Root cause**: Overly permissive CORS configuration
- **Remediation**: 
  ```python
  app.add_middleware(
      CORSMiddleware,
      allow_origins=["http://localhost:3002", "https://yourdomain.com"],  # Specific domains
      allow_credentials=True,
      allow_methods=["POST"],  # Restrict to necessary methods
      allow_headers=["Content-Type", "Authorization"],
  )
  ```
- **Block Production**: YES

#### 3. Unsandboxed File Processing
- **Severity**: Critical
- **Affected Area**: File optimizers (`src/lib/file-optimizer/`)
- **What is wrong**: Image/audio/document processing libraries run directly on main server
- **Why it matters**: Vulnerable libraries can lead to RCE through malicious files
- **Attack scenario**: Upload malformed PNG that triggers buffer overflow in Sharp library
- **Root cause**: No sandboxing/isolation for file processing
- **Remediation**: 
  - Process files in isolated containers/VMs
  - Use worker processes with limited permissions
  - Implement resource limits and timeouts
- **Block Production**: YES

### HIGH

#### 4. Predictable Storage URLs
- **Severity**: High
- **Affected Area**: Local storage provider (`src/lib/storage/providers/local-provider.ts`)
- **What is wrong**: Files served via predictable URLs like `/api/assets/workspace-{id}/filename.ext`
- **Why it matters**: Attackers can enumerate and potentially access other users' files
- **Attack scenario**: Brute force workspace IDs to find and access private files
- **Root cause**: No access control on file serving endpoints
- **Remediation**: 
  - Add workspace ownership validation in asset serving endpoints
  - Use signed URLs with short expiration times
  - Implement proper authorization checks
- **Block Production**: YES

#### 5. No Malware Scanning
- **Severity**: High
- **Affected Area**: File upload pipeline
- **What is wrong**: Uploaded files are not scanned for malware
- **Why it matters**: Malicious files could be stored and served to other users
- **Attack scenario**: Upload malware-infected document, other users download and get infected
- **Root cause**: Missing security scanning layer
- **Remediation**: 
  - Integrate antivirus scanning (ClamAV, etc.)
  - Quarantine suspicious files
  - Implement file hash reputation checking
- **Block Production**: YES

#### 6. Secrets in Environment Files
- **Severity**: High
- **Affected Area**: `.env` file, Docker configuration
- **What is wrong**: Database credentials and API keys stored in plaintext
- **Why it matters**: Compromised file exposes all system secrets
- **Attack scenario**: Developer commits `.env` file to repository, all secrets exposed
- **Root cause**: Poor secrets management practices
- **Remediation**: 
  - Use proper secret management (HashiCorp Vault, AWS Secrets Manager)
  - Rotate all exposed credentials
  - Implement environment-specific secrets
- **Block Production**: YES

#### 7. Missing Rate Limiting
- **Severity**: High
- **Affected Area**: All API endpoints
- **What is wrong**: No rate limiting on API calls
- **Why it matters**: Enables DoS attacks and credential stuffing
- **Attack scenario**: Brute force login attempts, exhaust server resources
- **Root cause**: No rate limiting middleware implemented
- **Remediation**: 
  ```typescript
  // Add rate limiting middleware
  import rateLimit from 'express-rate-limit'
  
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests
  })
  ```
- **Block Production**: YES

#### 8. TTS Service Input Validation
- **Severity**: High
- **Affected Area**: TTS service endpoints
- **What is wrong**: No input validation on audio files or text parameters
- **Why it matters**: Could lead to resource exhaustion or injection attacks
- **Attack scenario**: Upload extremely large audio file, exhaust server memory/disk
- **Root cause**: Missing input validation and size limits
- **Remediation**: 
  - Validate file sizes and formats
  - Sanitize text inputs
  - Implement resource limits
- **Block Production**: YES

### MEDIUM

#### 9. Long-Lived Sessions
- **Severity**: Medium
- **Affected Area**: Authentication (`src/lib/auth.ts:12`)
- **What is wrong**: Sessions valid for 30 days without re-authentication
- **Why it matters**: Compromised session tokens give long-term access
- **Attack scenario**: Stolen session token gives 30 days of unauthorized access
- **Root cause**: Overly generous session timeout
- **Remediation**: 
  ```typescript
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // Reduce to 24 hours
  }
  ```
- **Block Production**: NO

#### 10. Insufficient Security Logging
- **Severity**: Medium
- **Affected Area**: Application-wide
- **What is wrong**: Limited security event logging and monitoring
- **Why it matters**: Difficult to detect and investigate security incidents
- **Attack scenario**: Attacker exfiltrates data, no audit trail exists
- **Root cause**: Missing comprehensive logging strategy
- **Remediation**: 
  - Log all authentication attempts
  - Log file uploads and access
  - Implement security monitoring and alerting
- **Block Production**: NO

### LOW

#### 11. Verbose Error Messages
- **Severity**: Low
- **Affected Area**: Various error handlers
- **What is wrong**: Error messages may leak internal system information
- **Why it matters**: Could help attackers understand system architecture
- **Attack scenario**: Error reveals file paths, database structure
- **Root cause**: Poor error message sanitization
- **Remediation**: Sanitize all error messages shown to users
- **Block Production**: NO

#### 12. Missing Security Headers
- **Severity**: Low
- **Affected Area**: HTTP responses
- **What is wrong**: Missing security headers like CSP, HSTS
- **Why it matters**: Reduces protection against various web attacks
- **Attack scenario**: XSS attack could be mitigated by proper CSP
- **Root cause**: Missing security header configuration
- **Remediation**: Add security headers middleware
- **Block Production**: NO

---

## C. Tenant Isolation Review

### Database Layer: GOOD
- ✅ All queries properly scoped with `workspaceId` filters
- ✅ Foreign key constraints enforce tenant boundaries
- ✅ Row-level security through consistent WHERE clauses

### API Layer: MIXED
- ✅ `getAuthUserWithWorkspace()` properly validates tenant access
- ✅ `requireWorkspaceRole()` enforces authorization
- ❌ **CRITICAL GAP**: Asset serving endpoints lack tenant validation
- ❌ **CRITICAL GAP**: TTS service has no authentication/authorization

### Object Storage: WEAK
- ✅ Files organized by workspace folders (`workspace-{id}/`)
- ❌ **CRITICAL GAP**: No access control on storage URLs
- ❌ **HIGH GAP**: Predictable file paths enable enumeration

### Background Workers: MISSING
- ❌ **CRITICAL GAP**: No sandboxing for file processing
- ❌ **HIGH GAP**: No tenant isolation in processing pipelines

### Temporary Files: MISSING
- ❌ **HIGH GAP**: No secure temporary file handling
- ❌ **MEDIUM GAP**: Potential for temp file leakage

### Cross-Account Access Assessment:
**CAN ONE USER ACCESS ANOTHER USER'S CONTENT? YES - MULTIPLE VECTORS**

1. **File Enumeration**: Predictable URLs allow guessing workspace IDs
2. **TTS Service**: No tenant boundaries - any workspace can access any voice profile
3. **File Processing**: Malicious files could escape sandbox and access other files

**Weakest Boundaries:**
1. TTS service (no authentication)
2. File serving endpoints (no tenant validation)
3. File processing pipeline (no sandboxing)

**Required Architectural Changes:**
1. Add authentication to TTS service
2. Implement tenant-aware file serving
3. Sandboxed file processing workers
4. Signed URLs for file access
5. Comprehensive audit logging

---

## D. File Upload Hardening Review

### Current Strategy: INADEQUATE
- MIME type validation only (easily spoofed)
- Extension validation (easily bypassed)
- Size limits (100MB - reasonable)
- No content validation
- No malware scanning
- No sandboxing

### Recommended Secure Pipeline:

#### 1. Content-Based Validation
```typescript
import { fileTypeFromBuffer } from 'file-type'
import { fromBuffer } from 'file-type-mime'

const validateFileContent = async (buffer: Buffer, originalName: string) => {
  // Detect actual file type
  const fileType = await fileTypeFromBuffer(buffer)
  if (!fileType || !ALLOWED_TYPES.includes(fileType.mime)) {
    throw new Error('Invalid file type')
  }
  
  // Validate file signature (magic bytes)
  const isValidSignature = validateMagicBytes(buffer, fileType.mime)
  if (!isValidSignature) {
    throw new Error('File signature mismatch')
  }
  
  // Additional format-specific validation
  await validateFormatSpecific(buffer, fileType.mime)
}
```

#### 2. Malware Scanning
```typescript
import clamd from 'clamd'

const scanFile = async (buffer: Buffer) => {
  const scanner = clamd.createScanner()
  const result = await scanner.scanBuffer(buffer)
  
  if (result.isInfected) {
    throw new Error('Malware detected')
  }
  
  return result
}
```

#### 3. Sandboxed Processing
```typescript
// Process files in isolated containers
const processInSandbox = async (file: File, options: ProcessOptions) => {
  const sandbox = await createSandbox({
    memoryLimit: '512MB',
    timeLimit: '30s',
    networkAccess: false,
    filesystem: 'tmpfs'
  })
  
  try {
    return await sandbox.process(file, options)
  } finally {
    await sandbox.cleanup()
  }
}
```

#### 4. Secure Storage Design
```
uploads/
├── workspace-{uuid}/
│   ├── original/
│   │   └── {random-uuid}-{timestamp}.ext
│   ├── processed/
│   │   └── {random-uuid}-{timestamp}.ext
│   └── thumbnails/
│       └── {random-uuid}-{timestamp}.thumb.ext
└── quarantine/
    └── {random-uuid}-{timestamp}.quarantine.ext
```

#### 5. Access Control
```typescript
// Tenant-aware file serving
app.get('/api/assets/:workspaceId/:fileId', async (req, res) => {
  const user = await getAuthUser(req)
  const { workspaceId, fileId } = req.params
  
  // Validate tenant access
  await requireWorkspaceAccess(user.id, workspaceId)
  
  // Validate file ownership
  const file = await getFile(fileId, workspaceId)
  if (!file) {
    return res.status(404).send('File not found')
  }
  
  // Serve file with security headers
  res.setHeader('X-Content-Type-Options', 'nosniff')
  res.setHeader('Content-Security-Policy', "default-src 'none'")
  return res.sendFile(file.path)
})
```

---

## E. Secure Architecture Recommendations

### Target Production Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Web Frontend  │    │   API Gateway   │    │  Auth Service   │
│   (Next.js)     │────│   (Express)     │────│  (NextAuth)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  File Service   │    │  Worker Queue   │    │  Monitoring     │
│  (Sandboxed)    │────│  (Bull/Redis)   │────│  (Prometheus)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Object Storage │    │   Database      │    │  Secret Store   │
│  (S3/R2)        │    │  (PostgreSQL)   │    │ (Vault/KMS)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Security Layers

#### 1. API Gateway
- Rate limiting per user/IP
- Request validation and sanitization
- JWT token validation
- Security headers injection
- Request/response logging

#### 2. Authentication & Authorization
- Short-lived JWT tokens (1 hour)
- Refresh tokens with secure storage
- Multi-factor authentication for admin
- Device fingerprinting
- Session management with revocation

#### 3. File Processing Pipeline
```
Upload → Validation → Scanning → Sandboxing → Processing → Storage
   │         │          │           │           │          │
   ▼         ▼          ▼           ▼           ▼          ▼
Check   Content   Malware   Isolated   Format    Tenant
Size    Magic     Scan      Container  Convert   Isolation
Limit   Bytes     (ClamAV)  (Docker)   (Sharp)   (S3)
```

#### 4. Storage Security
- Tenant-isolated buckets/prefixes
- Signed URLs with expiration
- Server-side encryption
- Access logging and monitoring
- Secure deletion policies

#### 5. Network Security
- Private subnets for internal services
- Network security groups
- VPN access for admin
- DDoS protection
- TLS 1.3 everywhere

#### 6. Monitoring & Alerting
- Security event logging
- Anomaly detection
- Failed authentication alerts
- File access monitoring
- Resource usage alerts

---

## F. Code Review Checklist

### Authentication & Authorization
- [ ] All API endpoints validate authentication
- [ ] Tenant isolation enforced on every data access
- [ ] Role-based authorization implemented
- [ ] Session tokens have reasonable expiration
- [ ] Secure token storage implemented

### File Upload Security
- [ ] Content-based file type validation
- [ ] Magic bytes verification
- [ ] File size limits enforced
- [ ] Malware scanning implemented
- [ ] Sandboxed processing
- [ ] Secure filename generation
- [ ] Tenant-isolated storage

### Input Validation
- [ ] All user inputs validated and sanitized
- [ ] SQL injection protection
- [ ] XSS prevention
- [ ] CSRF protection
- [ ] Parameterized queries used

### Error Handling
- [ ] Error messages don't leak sensitive information
- [ ] Consistent error responses
- [ ] Security events logged
- [ ] Stack traces not exposed to users

### Infrastructure Security
- [ ] Secrets properly managed
- [ ] Environment variables secured
- [ ] Container security implemented
- [ ] Network segmentation
- [ ] Backup encryption

---

## G. Security Testing Plan

### Unit Tests
```typescript
describe('File Upload Security', () => {
  it('should reject files with spoofed MIME types', async () => {
    const maliciousFile = createMaliciousFile()
    await expect(uploadFile(maliciousFile)).rejects.toThrow('Invalid file type')
  })
  
  it('should detect malware in uploads', async () => {
    const infectedFile = createInfectedFile()
    await expect(uploadFile(infectedFile)).rejects.toThrow('Malware detected')
  })
})
```

### Integration Tests
- Cross-tenant data access attempts
- File enumeration attacks
- Authentication bypass attempts
- Privilege escalation scenarios

### Penetration Testing Scenarios
1. **File Upload Attacks**
   - Executable disguised as image
   - Zip bombs and decompression attacks
   - Malicious PDF documents
   - Script injection in metadata

2. **Tenant Isolation Tests**
   - Enumerate other workspaces' files
   - Access another tenant's voice profiles
   - Cross-workspace API calls
   - Shared resource contamination

3. **Authentication Attacks**
   - JWT token manipulation
   - Session fixation
   - Password brute force
   - OAuth redirection attacks

### Fuzzing Ideas
- File format parsers (image, audio, PDF)
- API endpoint parameters
- Database query parameters
- File upload boundaries

### Security Tools
- **SAST**: SonarQube, CodeQL
- **DAST**: OWASP ZAP, Burp Suite
- **SCA**: Snyk, Dependabot
- **Container Security**: Trivy, Clair
- **Infrastructure**: Terraform security scanning

---

## H. Immediate Action Plan

### Must-Fix Before Production
1. **Implement content-based file validation** - Prevent malicious file uploads
2. **Fix TTS service CORS configuration** - Prevent cross-origin attacks
3. **Add tenant validation to asset serving** - Prevent cross-account file access
4. **Implement malware scanning** - Prevent malware distribution
5. **Add authentication to TTS service** - Prevent unauthorized voice profile access
6. **Implement rate limiting** - Prevent DoS attacks
7. **Secure secrets management** - Prevent credential exposure

### Should-Fix Soon After
1. **Sandboxed file processing** - Prevent server compromise
2. **Comprehensive security logging** - Improve incident detection
3. **Reduce session lifetime** - Limit exposure from stolen tokens
4. **Add security headers** - Improve browser security
5. **Implement backup encryption** - Protect data at rest

### Hardening Improvements for Later
1. **Multi-factor authentication** - Enhance account security
2. **Advanced monitoring** - Improve threat detection
3. **Network segmentation** - Reduce attack surface
4. **Regular security audits** - Maintain security posture
5. **Security training** - Improve developer awareness

---

## Final Assessment

### Production Readiness: FAIL

The application has **CRITICAL SECURITY VULNERABILITIES** that make it unsafe for handling sensitive family history data. The tenant isolation model is fundamentally broken in several areas, and the file upload pipeline poses a significant server compromise risk.

### Top 5 Architectural Changes Required

1. **Implement proper tenant isolation in file serving** - Add workspace validation to all file access endpoints
2. **Add authentication/authorization to TTS service** - Prevent unauthorized voice profile access
3. **Implement sandboxed file processing** - Isolate malicious file processing from main application
4. **Implement content-based file validation** - Prevent malicious file uploads
5. **Add comprehensive security monitoring** - Enable detection of security incidents

### Top 5 Code-Level Review Priorities

1. **Fix CORS configuration in TTS service** - Remove wildcard origins
2. **Add tenant validation to asset serving endpoints** - Prevent cross-account access
3. **Implement file content validation** - Add magic byte verification
4. **Add rate limiting to API endpoints** - Prevent abuse
5. **Sanitize error messages** - Prevent information leakage

**Recommendation**: Do not deploy to production until all CRITICAL and HIGH severity issues are addressed. The application requires significant security hardening before it can safely handle sensitive family history data.
