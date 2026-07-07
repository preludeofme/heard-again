-- Remove Chat/Persona models (chat system removed from this branch; being developed
-- separately and will be reintroduced later — see CLAUDE.md project overview).

-- DropForeignKey
ALTER TABLE "ChatMessage" DROP CONSTRAINT IF EXISTS "ChatMessage_sessionId_fkey";
ALTER TABLE "ChatSession" DROP CONSTRAINT IF EXISTS "ChatSession_familyspaceId_fkey";
ALTER TABLE "ChatSession" DROP CONSTRAINT IF EXISTS "ChatSession_personId_fkey";
ALTER TABLE "ChatSession" DROP CONSTRAINT IF EXISTS "ChatSession_userId_fkey";
ALTER TABLE "PersonaProfile" DROP CONSTRAINT IF EXISTS "PersonaProfile_familyspaceId_fkey";
ALTER TABLE "PersonaProfile" DROP CONSTRAINT IF EXISTS "PersonaProfile_personId_fkey";

-- DropTable
DROP TABLE IF EXISTS "ChatMessage";
DROP TABLE IF EXISTS "ChatSession";
DROP TABLE IF EXISTS "PersonaProfile";

-- DropEnum
DROP TYPE IF EXISTS "ChatSessionStatus";
DROP TYPE IF EXISTS "MessageRole";
