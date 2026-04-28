# GDPR Data Flow and Retention Policy — Heard Again

This document outlines how personally identifiable information (PII) flows through the Heard Again platform and the mechanisms for data retention and permanent deletion.

## 1. Data Collection & Storage

| Data Type | Primary Storage | PII Content | Encryption | Retention |
| :--- | :--- | :--- | :--- | :--- |
| **User Profile** | PostgreSQL (`User`) | Email, Name, Avatar URL | None (Name/Email) | Until deletion |
| **Family Tree** | PostgreSQL (`Person`) | Names, Birth/Death dates, Bios | None | Until deletion |
| **Voice Samples** | S3 / Local Storage | Voice recordings | AES-256 (at rest) | User controlled |
| **Transcripts** | PostgreSQL / ChromaDB | Conversations, Stories | None | User controlled |
| **Audit Logs** | PostgreSQL (`AuditLog`)| IPs, Actor IDs | Hashed (Sensitive) | 1 Year |

## 2. Retention Enforcement (R7/S10)

Data retention is enforced by the `RetentionWorker`. The worker runs daily and purges data based on workspace-specific policies:

*   **Audio Retention**: Narrated stories and voice samples are purged after the configured window (default: 10 years).
*   **Transcript Retention**: Text content in Postgres and ChromaDB is purged after the window.
*   **Inactive Drafts**: Stories in `DRAFT` status with no updates for X days are purged.
*   **Revoked Consent**: When voice consent is revoked, the associated voice profile and samples are queued for deletion after X days.

## 3. Permanent Deletion Flow (S10)

Heard Again supports two levels of deletion:

### 3.1 Account Deactivation (Self-Service)
*   User status marked as `DELETED`.
*   Email address is redacted (e.g., `deleted+hash@redacted.heard-again.local`).
*   Password and OAuth links are removed.
*   **Data Persistence**: If the user was a member of a shared workspace, their contributions (stories, comments) remain, but are attributed to "Deleted User".

### 3.2 Permanent Purge / GDPR "Right to be Forgotten"
When an account is permanently purged or when an **OWNER** deletes their account without transferring ownership:

1.  **Workspace Cascade**: If the user is the sole `OWNER` of a workspace, the entire workspace and all its associated data (People, Stories, Assets, Documents) are permanently deleted from both PostgreSQL and Storage (S3/Local).
2.  **Asset Cleanup**: All physical files associated with the workspace are unlinked and removed from storage.
3.  **Vector Purge**: The ChromaDB collection for the workspace is dropped.
4.  **Audit Log Redaction**: Actor IDs in audit logs for the deleted workspace are anonymized.

## 4. Implementation Details

### Cascade on Owner Delete
The `User` to `Workspace` relationship is modeled with a strategic cascade. While Prisma's `onDelete: Cascade` is used for memberships, the workspace deletion for owners is handled in the `permanent-deletion.ts` API handler to ensure no accidental data loss for shared workspaces with multiple admins (if applicable, though currently only one owner is supported).

### Retention Worker
Location: `UI/src/workers/retentionWorker.ts`
Queue: `retention-enforcement`
Schedule: Daily at 03:00 UTC
