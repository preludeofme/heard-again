import { PassThrough } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { ServiceFactory } from '@/services/index';
import { v4 as uuidv4 } from 'uuid';
import { bearerAuthHook, requireContextHeadersHook } from '@/hooks/auth';

function generateConversationTitle(personId: string): string {
  const now = new Date();
  const timeString = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  const dateString = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `Chat with ${personId} - ${dateString} at ${timeString}`;
}

export function registerChatRoutes(app: FastifyInstance): void {
  // GET+POST /api/chat/messages?sessionId=xxx
  app.get<{ Querystring: { sessionId?: string; limit?: string; offset?: string } }>(
    '/api/chat/messages',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const { sessionId, limit: limitStr, offset: offsetStr } = req.query;
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      const userId = req.headers['x-user-id'] as string;

      if (!sessionId || typeof sessionId !== 'string') {
        return reply.code(400).send({ error: 'Session ID is required' });
      }

      try {
        const limit = parseInt(limitStr ?? '50') || 50;
        const offset = parseInt(offsetStr ?? '0') || 0;
        const chatService = ServiceFactory.getChatService();

        // SEC-3: scope to familyspace
        const session = await chatService.getSession(sessionId, undefined, familyspaceId);
        if (!session) {
          return reply.code(404).send({ error: 'Chat session not found' });
        }

        const messages = await chatService.getHistory(sessionId, limit, offset);
        return reply.code(200).send({
          success: true,
          messages,
          session,
          pagination: { limit, offset, count: messages.length },
        });
      } catch (error) {
        return reply.code(500).send({
          error: 'Failed to retrieve chat messages',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  app.post<{ Querystring: { sessionId?: string } }>(
    '/api/chat/messages',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const { sessionId } = req.query;
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      const userId = req.headers['x-user-id'] as string;

      if (!sessionId || typeof sessionId !== 'string') {
        return reply.code(400).send({ error: 'Session ID is required' });
      }

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { message, options } = req.body as any;

        if (!message || typeof message !== 'string') {
          return reply.code(400).send({ error: 'Message is required and must be a string' });
        }
        if (message.trim().length === 0) {
          return reply.code(400).send({ error: 'Message cannot be empty' });
        }
        if (message.length > 10000) {
          return reply.code(400).send({ error: 'Message too long (max 10,000 characters)' });
        }

        const chatService = ServiceFactory.getChatService();

        // SEC-3: ownership enforced via userId + familyspaceId
        const session = await chatService.getSession(sessionId, userId, familyspaceId);
        if (!session) {
          return reply.code(404).send({ error: 'Chat session not found' });
        }

        // SEC-7: strict options allowlist
        const response = await chatService.sendMessage({
          sessionId,
          message: message.trim(),
          options: {
            maxRetrievedDocuments: Math.min(Math.max(Number(options?.maxRetrievedDocuments) || 5, 1), 10),
            temperature: Math.min(Math.max(Number(options?.temperature) || 0.7, 0.0), 1.0),
          },
        });

        return reply.code(200).send({
          success: true,
          response,
          message: 'Message sent successfully',
        });
      } catch (error) {
        return reply.code(500).send({
          error: 'Failed to send message',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // GET+POST /api/chat/sessions
  app.get(
    '/api/chat/sessions',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      const userId = req.headers['x-user-id'] as string;
      try {
        const chatService = ServiceFactory.getChatService();
        const sessions = await chatService.listSessions(familyspaceId, userId);
        return reply.code(200).send({ success: true, sessions, count: sessions.length });
      } catch (error) {
        return reply.code(500).send({
          error: 'Failed to retrieve chat sessions',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  app.post(
    '/api/chat/sessions',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      const userId = req.headers['x-user-id'] as string;
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { personId, title } = req.body as any;
        if (!personId) {
          return reply.code(400).send({ error: 'personId is required' });
        }
        const chatService = ServiceFactory.getChatService();
        const session = await chatService.createSession({
          familyspaceId,
          personId,
          userId,
          title: title || generateConversationTitle(personId),
        });
        return reply.code(201).send({
          success: true,
          session,
          message: 'Chat session created successfully',
        });
      } catch (error) {
        return reply.code(500).send({
          error: 'Failed to create chat session',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    },
  );

  // GET+PATCH+DELETE /api/chat/sessions/:sessionId
  app.get<{ Params: { sessionId: string } }>(
    '/api/chat/sessions/:sessionId',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const { sessionId } = req.params;
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      const userId = req.headers['x-user-id'] as string;
      try {
        const chatService = ServiceFactory.getChatService();
        // SEC-3: ownership enforced via userId + familyspaceId
        const session = await chatService.getSession(sessionId, userId, familyspaceId);
        if (!session) {
          return reply.code(404).send({ success: false, error: 'Session not found' });
        }
        return reply.code(200).send({ success: true, session });
      } catch (error) {
        return reply.code(500).send({ error: 'Internal server error' });
      }
    },
  );

  app.patch<{ Params: { sessionId: string } }>(
    '/api/chat/sessions/:sessionId',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const { sessionId } = req.params;
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      const userId = req.headers['x-user-id'] as string;
      try {
        const chatService = ServiceFactory.getChatService();
        const session = await chatService.getSession(sessionId, userId, familyspaceId);
        if (!session) {
          return reply.code(404).send({ success: false, error: 'Session not found' });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { status } = req.body as any;
        if (!status || !['active', 'archived'].includes(status)) {
          return reply.code(400).send({ error: 'status must be active or archived' });
        }
        const updated = await chatService.updateSession(sessionId, { status });
        return reply.code(200).send({ success: true, session: updated });
      } catch (error) {
        return reply.code(500).send({ error: 'Internal server error' });
      }
    },
  );

  app.delete<{ Params: { sessionId: string } }>(
    '/api/chat/sessions/:sessionId',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const { sessionId } = req.params;
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      const userId = req.headers['x-user-id'] as string;
      try {
        const chatService = ServiceFactory.getChatService();
        const session = await chatService.getSession(sessionId, userId, familyspaceId);
        if (!session) {
          return reply.code(404).send({ success: false, error: 'Session not found' });
        }
        await chatService.deleteSession(sessionId);
        return reply.code(200).send({ success: true });
      } catch (error) {
        return reply.code(500).send({ error: 'Internal server error' });
      }
    },
  );

  // POST /api/chat/stream?sessionId=xxx  (SSE)
  app.post<{ Querystring: { sessionId?: string } }>(
    '/api/chat/stream',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const { sessionId } = req.query;
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      const userId = req.headers['x-user-id'] as string;

      if (!sessionId || typeof sessionId !== 'string') {
        return reply.code(400).send({ error: 'Session ID is required' });
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { message, options } = req.body as any;

      if (!message || typeof message !== 'string') {
        return reply.code(400).send({ error: 'Message is required and must be a string' });
      }
      if (message.trim().length === 0) {
        return reply.code(400).send({ error: 'Message cannot be empty' });
      }
      if (message.length > 10000) {
        return reply.code(400).send({ error: 'Message too long (max 10,000 characters)' });
      }

      // Disable socket timeouts for long-running SSE streams
      req.raw.socket?.setTimeout(0);
      req.raw.socket?.setKeepAlive(true);

      const stream = new PassThrough();
      reply
        .header('Content-Type', 'text/event-stream')
        .header('Cache-Control', 'no-cache, no-transform')
        .header('Connection', 'keep-alive')
        .header('X-Accel-Buffering', 'no')
        .header('Access-Control-Allow-Origin', '*')
        .header('Access-Control-Allow-Headers', 'Cache-Control')
        .send(stream);

      const chatService = ServiceFactory.getChatService();

      // SEC-3: scope to familyspace
      const session = await chatService.getSession(sessionId, undefined, familyspaceId);
      if (!session) {
        stream.write(`event: error\ndata: ${JSON.stringify({ error: 'Chat session not found' })}\n\n`);
        stream.end();
        return;
      }

      const userMessage = await chatService.storeUserMessage(sessionId, message.trim());
      stream.write(`event: user_message\ndata: ${JSON.stringify({ message: userMessage })}\n\n`);

      try {
        // SEC-7: strict options allowlist
        const streamIterator = await chatService.streamResponse({
          sessionId,
          message: message.trim(),
          options: {
            maxRetrievedDocuments: Math.min(Math.max(Number(options?.maxRetrievedDocuments) || 5, 1), 10),
            temperature: Math.min(Math.max(Number(options?.temperature) || 0.7, 0.0), 1.0),
          },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        }) as AsyncIterable<any>;

        let fullResponse = '';
        let messageId: string | null = null;

        for await (const chunk of streamIterator) {
          try {
            if (chunk.type === 'start') {
              messageId = chunk.messageId || null;
              stream.write(`event: start\ndata: ${JSON.stringify({ type: 'start', messageId })}\n\n`);
            } else if (chunk.type === 'chunk') {
              fullResponse += chunk.content;
              const sanitizedContent = chunk.content.replace(/[ --]/g, '');
              stream.write(`event: chunk\ndata: ${JSON.stringify({ type: 'chunk', content: sanitizedContent })}\n\n`);
            } else if (chunk.type === 'metadata') {
              stream.write(`event: metadata\ndata: ${JSON.stringify({ type: 'metadata', ...chunk.metadata })}\n\n`);
            } else if (chunk.type === 'end') {
              const contentToStore = chunk.metadata?.filteredContent || fullResponse;
              if (messageId && contentToStore) {
                await chatService.updateAssistantMessage(messageId, contentToStore, chunk.metadata || {});
              }
              stream.write(
                `event: end\ndata: ${JSON.stringify({
                  type: 'end',
                  messageId,
                  processingTime: chunk.metadata?.totalProcessingTime,
                  tokensUsed: chunk.metadata?.totalTokens,
                  filteredContent: chunk.metadata?.filteredContent || null,
                })}\n\n`,
              );
              break;
            } else if (chunk.type === 'error') {
              stream.write(`event: error\ndata: ${JSON.stringify({ type: 'error', error: chunk.error })}\n\n`);
              break;
            }
          } catch (jsonError) {
            stream.write(
              `event: error\ndata: ${JSON.stringify({
                type: 'error',
                error: 'Failed to serialize response chunk',
                details: jsonError instanceof Error ? jsonError.message : 'Unknown error',
              })}\n\n`,
            );
            break;
          }
        }
        stream.end();
      } catch (streamError) {
        stream.write(
          `event: error\ndata: ${JSON.stringify({
            error: 'Failed to stream response',
            details: streamError instanceof Error ? streamError.message : 'Unknown error',
          })}\n\n`,
        );
        stream.end();
      }
    },
  );
}
