import type { FastifyInstance } from 'fastify';
import { bearerAuthHook } from '@/hooks/auth';
import { logger } from '@/lib/logger';
import { LLMGatewayImpl } from '@/services/llm/LLMGateway';
import { FirstPersonRewriter } from '@/services/rewrite/FirstPersonRewriter';
import { RELEASE_CANDIDATE_MODEL_POLICY } from '@/config/releaseCandidate';
import type { CompiledPrompt } from '@/types/llm';
import type { ChatMessage } from '@/types/chat';

const INTERVIEW_SYSTEM_PROMPT = `You are a warm, friendly assistant helping someone add a family member to their family tree app called "Heard Again."

Your goal is to gather these details through natural conversation — one topic at a time:
1. Full name (first name is required; last name, middle name, nickname, maiden name are optional)
2. How they are related (e.g. grandmother, childhood friend, uncle)
3. Birthday (YYYY-MM-DD format if known, otherwise leave empty)
4. Are they still living? If deceased, do you know when they passed?
5. A short bio or description (optional but nice to have)

Rules:
- Ask about ONE topic per turn — never stack multiple questions
- Be warm and conversational, not clinical
- Accept partial information gracefully ("That's okay if you're not sure")
- After you have collected at least a first name and one other detail, you may wrap up
- Maximum 6 turns — do not drag it out

At the end of EVERY response, output a JSON block wrapped in <extracted> tags containing the fields you have gathered so far. Use empty strings for unknown fields. Set isComplete to true only when you have enough to save (at minimum a firstName).

Example format at the end of every message:

<extracted>
{"firstName":"","lastName":"","middleName":"","nickname":"","maidenName":"","birthDate":"","deathDate":"","isDeceased":false,"bio":"","personType":"FAMILY","isComplete":false}
</extracted>

For personType use one of: FAMILY, FRIEND, MENTOR, COLLEAGUE, OTHER`;

interface InterviewMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface ExtractedPersonData {
  firstName: string;
  lastName: string;
  middleName: string;
  nickname: string;
  maidenName: string;
  birthDate: string;
  deathDate: string;
  isDeceased: boolean;
  bio: string;
  personType: string;
  isComplete: boolean;
}

const llmGateway = new LLMGatewayImpl();
const rewriter = new FirstPersonRewriter(llmGateway);

const MAX_CONTENT_CHARS = 20000;

function parseExtracted(content: string): ExtractedPersonData | null {
  const match = content.match(/<extracted>([\s\S]*?)<\/extracted>/);
  if (!match) return null;
  try {
    return JSON.parse(match[1].trim()) as ExtractedPersonData;
  } catch {
    return null;
  }
}

function stripExtractedBlock(content: string): string {
  return content.replace(/<extracted>[\s\S]*?<\/extracted>/, '').trim();
}

export function registerMiscRoutes(app: FastifyInstance): void {
  // POST /api/interview/person
  app.post('/api/interview/person', { preHandler: [bearerAuthHook] }, async (req, reply) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { messages } = req.body as { messages?: InterviewMessage[] };

    if (!Array.isArray(messages) || messages.length === 0) {
      return reply.code(400).send({ success: false, error: 'messages array is required' });
    }

    const history = messages.slice(0, -1);
    const lastMessage = messages[messages.length - 1];

    if (lastMessage.role !== 'user') {
      return reply.code(400).send({ success: false, error: 'last message must be from user' });
    }

    const prompt: CompiledPrompt = {
      systemPrompt: INTERVIEW_SYSTEM_PROMPT,
      context: '',
      history: history.map((m, i) => ({
        id: `interview-${i}`,
        sessionId: 'interview',
        role: m.role,
        content: m.content,
        metadata: {},
        createdAt: new Date(),
      })) as ChatMessage[],
      userMessage: lastMessage.content,
      metadata: {
        model: process.env.NARRATION_LLM_MODEL || RELEASE_CANDIDATE_MODEL_POLICY.primaryModel,
        temperature: 0.7,
        maxTokens: 512,
        topP: 0.9,
      },
    };

    try {
      const response = await llmGateway.generateResponse(prompt);
      const rawContent = response.content;
      const extracted = parseExtracted(rawContent);
      const message = stripExtractedBlock(rawContent);

      logger.info(
        { model: response.metadata.model, messageCount: messages.length, isComplete: extracted?.isComplete },
        '[interview] person turn complete',
      );

      return reply.code(200).send({
        success: true,
        data: {
          message,
          extractedData: extracted,
          isComplete: extracted?.isComplete ?? false,
        },
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'LLM request failed';
      logger.error({ error: msg }, '[interview] person interview failed');
      return reply.code(502).send({ success: false, error: msg });
    }
  });

  // POST /api/rewrite/first-person
  app.post('/api/rewrite/first-person', { preHandler: [bearerAuthHook] }, async (req, reply) => {
    const familyspaceId = req.headers['x-familyspace-id'] as string | undefined;
    if (!familyspaceId) {
      return reply.code(400).send({ success: false, error: 'Missing x-familyspace-id header' });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { content, subjectName, speakerName, narratorName, styleHints } = (req.body ?? {}) as any;

    if (typeof content !== 'string' || content.trim().length === 0) {
      return reply.code(400).send({ success: false, error: 'content is required' });
    }
    if (content.length > MAX_CONTENT_CHARS) {
      return reply.code(400).send({
        success: false,
        error: `content exceeds ${MAX_CONTENT_CHARS} character limit`,
      });
    }

    try {
      const result = await rewriter.rewrite({
        content,
        subjectName: typeof subjectName === 'string' ? subjectName : undefined,
        speakerName: typeof speakerName === 'string' ? speakerName : undefined,
        narratorName: typeof narratorName === 'string' ? narratorName : undefined,
        styleHints: typeof styleHints === 'string' ? styleHints : undefined,
      });

      logger.info(
        {
          familyspaceId,
          model: result.model,
          processingTimeMs: result.processingTimeMs,
          inputChars: content.length,
          outputChars: result.rewrittenContent.length,
        },
        '[rewrite] first-person rewrite complete',
      );

      return reply.code(200).send({
        success: true,
        data: {
          rewrittenContent: result.rewrittenContent,
          model: result.model,
          processingTimeMs: result.processingTimeMs,
        },
      });
    } catch (error) {
      logger.error({ familyspaceId, error }, '[rewrite] first-person rewrite failed');
      const message = error instanceof Error ? error.message : 'Rewrite failed';
      return reply.code(502).send({ success: false, error: message });
    }
  });
}
