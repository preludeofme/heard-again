import { PassThrough } from 'node:stream';
import type { FastifyInstance } from 'fastify';
import { VoiceIntegrationServiceImpl, VoiceIntegrationService } from '@/services/voice/VoiceIntegrationService';
import { PersonaServiceImpl } from '@/services/persona/PersonaService';
import { DatabasePersonaRepository } from '@/services/persona/DatabasePersonaRepository';
import { StyleExtractorImpl } from '@/services/persona/StyleExtractor';
import { PersonService } from '@/services/persona/PersonService';
import { LLMGatewayImpl } from '@/services/llm/LLMGateway';
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository';
import { prisma } from '@/lib/prisma';

function buildPersonaService(): PersonaServiceImpl {
  const llmGateway = new LLMGatewayImpl();
  const styleExtractor = new StyleExtractorImpl(llmGateway);
  const documentRepository = new PrismaDocumentRepository();
  const personaRepository = new DatabasePersonaRepository(prisma);
  const personService = new PersonService();
  return new PersonaServiceImpl(personaRepository, styleExtractor, documentRepository, personService);
}

export function registerVoiceRoutes(app: FastifyInstance): void {
  // GET /api/voice/profiles
  app.get<{ Querystring: { personaId?: string } }>('/api/voice/profiles', async (req, reply) => {
    const familyspaceId = req.headers['x-familyspace-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    if (!familyspaceId || !userId) {
      return reply.code(400).send({ success: false, error: 'Missing required headers: x-familyspace-id, x-user-id' });
    }
    try {
      const voiceIntegration = new VoiceIntegrationServiceImpl();
      const { personaId } = req.query;
      const profiles = await voiceIntegration.listVoiceProfiles();
      const filtered = personaId ? profiles.filter(p => p.personaId === personaId) : profiles;
      return reply.code(200).send({ success: true, profiles: filtered });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to get voice profiles',
      });
    }
  });

  // POST /api/voice/profiles
  app.post('/api/voice/profiles', async (req, reply) => {
    const familyspaceId = req.headers['x-familyspace-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    if (!familyspaceId || !userId) {
      return reply.code(400).send({ success: false, error: 'Missing required headers: x-familyspace-id, x-user-id' });
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { name, personaId, description, style } = req.body as any;
    if (!name) return reply.code(400).send({ success: false, error: 'Missing required field: name' });
    if (!style) return reply.code(400).send({ success: false, error: 'Missing required field: style' });
    try {
      const voiceIntegration = new VoiceIntegrationServiceImpl();
      const profile = await voiceIntegration.createVoiceProfile({ name, personaId, description, style, isActive: true });
      return reply.code(201).send({ success: true, profile });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to create voice profile',
      });
    }
  });

  // PUT /api/voice/profiles?id=xxx
  app.put<{ Querystring: { id?: string } }>('/api/voice/profiles', async (req, reply) => {
    const familyspaceId = req.headers['x-familyspace-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    if (!familyspaceId || !userId) {
      return reply.code(400).send({ success: false, error: 'Missing required headers: x-familyspace-id, x-user-id' });
    }
    const { id } = req.query;
    if (!id) return reply.code(400).send({ success: false, error: 'Missing or invalid profile ID' });
    try {
      const voiceIntegration = new VoiceIntegrationServiceImpl();
      const profile = await voiceIntegration.updateVoiceProfile(id, req.body as object);
      return reply.code(200).send({ success: true, profile });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update voice profile',
      });
    }
  });

  // DELETE /api/voice/profiles?id=xxx
  app.delete<{ Querystring: { id?: string } }>('/api/voice/profiles', async (req, reply) => {
    const familyspaceId = req.headers['x-familyspace-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    if (!familyspaceId || !userId) {
      return reply.code(400).send({ success: false, error: 'Missing required headers: x-familyspace-id, x-user-id' });
    }
    const { id } = req.query;
    if (!id) return reply.code(400).send({ success: false, error: 'Missing or invalid profile ID' });
    try {
      const voiceIntegration = new VoiceIntegrationServiceImpl();
      await voiceIntegration.deleteVoiceProfile(id);
      return reply.code(200).send({ success: true, message: 'Voice profile deleted successfully' });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to delete voice profile',
      });
    }
  });

  // POST /api/voice/stream  (SSE)
  app.post('/api/voice/stream', async (req, reply) => {
    const familyspaceId = req.headers['x-familyspace-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    if (!familyspaceId || !userId) {
      return reply.code(400).send({ success: false, error: 'Missing required headers: x-familyspace-id, x-user-id' });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { text, personaId, voiceProfileId, options } = req.body as any;

    if (!text) return reply.code(400).send({ success: false, error: 'Missing required field: text' });
    if (!personaId && !voiceProfileId) {
      return reply.code(400).send({ success: false, error: 'Missing required field: personaId or voiceProfileId' });
    }

    const voiceIntegration = new VoiceIntegrationServiceImpl();
    let voiceProfile: Awaited<ReturnType<VoiceIntegrationServiceImpl['listVoiceProfiles']>>[number] | null | undefined;

    if (voiceProfileId) {
      const profiles = await voiceIntegration.listVoiceProfiles();
      voiceProfile = profiles.find(p => p.id === voiceProfileId);
      if (!voiceProfile) {
        return reply.code(404).send({ success: false, error: 'Voice profile not found' });
      }
    } else {
      const personaService = buildPersonaService();
      const personaProfile = await personaService.getPersonaProfile(personaId, familyspaceId);
      if (!personaProfile) {
        return reply.code(404).send({ success: false, error: 'Persona profile not found' });
      }
      voiceProfile = await voiceIntegration.selectVoiceProfile(personaProfile);
      if (!voiceProfile) {
        return reply.code(404).send({ success: false, error: 'No suitable voice profile found for persona' });
      }
    }

    // TypeScript can't narrow across both if/else branches with early returns
    if (!voiceProfile) {
      return reply.code(500).send({ success: false, error: 'Voice profile unavailable' });
    }

    const stream = new PassThrough();
    reply
      .header('Content-Type', 'text/event-stream')
      .header('Cache-Control', 'no-cache')
      .header('Connection', 'keep-alive')
      .header('Access-Control-Allow-Origin', '*')
      .header('Access-Control-Allow-Headers', 'Cache-Control')
      .send(stream);

    const synthesisOptions = {
      style: options?.style,
      speed: options?.speed,
      emotion: options?.emotion,
      priority: options?.priority || 'normal',
    };

    try {
      const streamIterator = await voiceIntegration.streamSynthesis(text, voiceProfile, synthesisOptions);
      for await (const chunk of streamIterator) {
        if (chunk.isFinal) {
          stream.write('data: [DONE]\n\n');
          break;
        }
        const bytes = new Uint8Array(chunk.audio as ArrayBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
          binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);
        stream.write(
          `data: ${JSON.stringify({
            audio: base64Audio,
            sequence: chunk.sequence,
            timestamp: chunk.timestamp,
            isFinal: chunk.isFinal,
          })}\n\n`,
        );
      }
    } catch (streamError) {
      stream.write(
        `data: ${JSON.stringify({ error: 'Streaming error occurred', isFinal: true })}\n\n`,
      );
    } finally {
      stream.end();
    }
  });

  // POST /api/voice/synthesize
  app.post('/api/voice/synthesize', async (req, reply) => {
    const familyspaceId = req.headers['x-familyspace-id'] as string;
    const userId = req.headers['x-user-id'] as string;
    if (!familyspaceId || !userId) {
      return reply.code(400).send({ success: false, error: 'Missing required headers: x-familyspace-id, x-user-id' });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { text, personaId, options } = req.body as any;
    if (!text) return reply.code(400).send({ success: false, error: 'Missing required field: text' });
    if (!personaId) return reply.code(400).send({ success: false, error: 'Missing required field: personaId' });

    try {
      const voiceIntegration: VoiceIntegrationService = new VoiceIntegrationServiceImpl();
      const personaService = buildPersonaService();
      const personaProfile = await personaService.getPersonaProfile(personaId, familyspaceId);
      if (!personaProfile) {
        return reply.code(404).send({ success: false, error: 'Persona profile not found' });
      }

      const synthesisOptions = {
        style: options?.style,
        speed: options?.speed,
        emotion: options?.emotion,
        priority: options?.priority || 'normal',
      };

      const result = await voiceIntegration.synthesizeChatResponse(text, personaProfile, synthesisOptions);
      return reply.code(200).send({ success: true, result });
    } catch (error) {
      return reply.code(400).send({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to synthesize voice',
      });
    }
  });
}
