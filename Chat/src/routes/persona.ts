import type { FastifyInstance } from 'fastify';
import { PersonaServiceImpl } from '@/services/persona/PersonaService';
import { DatabasePersonaRepository } from '@/services/persona/DatabasePersonaRepository';
import { StyleExtractorImpl } from '@/services/persona/StyleExtractor';
import { PersonService } from '@/services/persona/PersonService';
import { LLMGatewayImpl } from '@/services/llm/LLMGateway';
import { PrismaDocumentRepository } from '@/repositories/DocumentRepository';
import { CUSTOM_INSTRUCTION_TEMPLATES } from '@/types';
import { prisma } from '@/lib/prisma';
import { bearerAuthHook, requireContextHeadersHook } from '@/hooks/auth';
import type { PersonaGenerationOptions } from '@/types';

// Module-level singletons — mirrors original per-file pattern
const llmGateway = new LLMGatewayImpl();
const styleExtractor = new StyleExtractorImpl(llmGateway);
const documentRepository = new PrismaDocumentRepository();
const personaRepository = new DatabasePersonaRepository(prisma);
const personService = new PersonService();
const personaService = new PersonaServiceImpl(
  personaRepository,
  styleExtractor,
  documentRepository,
  personService,
  llmGateway,
);

export function registerPersonaRoutes(app: FastifyInstance): void {
  // GET+POST /api/persona/profiles  — static before /:personId
  app.get<{ Querystring: { personId?: string } }>(
    '/api/persona/profiles',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      try {
        const { personId } = req.query;
        if (personId) {
          const profile = await personaService.getPersonaProfile(personId, familyspaceId);
          if (!profile || profile.familyspaceId !== familyspaceId) {
            return reply.code(404).send({ success: false, error: 'Persona profile not found' });
          }
          return reply.code(200).send({ success: true, profile });
        }
        const profiles = await personaService.listPersonaProfiles(familyspaceId);
        return reply.code(200).send({ success: true, profiles });
      } catch (error) {
        return reply.code(500).send({ success: false, error: 'Internal server error' });
      }
    },
  );

  app.post(
    '/api/persona/profiles',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      const userId = req.headers['x-user-id'] as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { personId, options } = req.body as any;
      if (!personId) {
        return reply.code(400).send({ success: false, error: 'Missing required field: personId' });
      }

      const generationOptions = {
        documentIds: [] as string[],
        minDocumentCount: options?.minDocumentCount || 3,
        maxDocuments: options?.maxDocuments || 10,
        includeRelationships: options?.includeRelationships ?? true,
        extractStyle: options?.extractStyle ?? true,
        extractFacts: options?.extractFacts ?? true,
        extractRelationships: options?.extractRelationships ?? true,
        confidenceThreshold: options?.confidenceThreshold || 0.5,
      };

      try {
        const profile = await personaService.generatePersonaProfile(personId, familyspaceId, generationOptions);
        return reply.code(201).send({ success: true, profile });
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate persona profile',
        });
      }
    },
  );

  // GET+POST+PUT+DELETE /api/persona/instructions  — static before /:personId
  app.get<{ Querystring: { personaId?: string } }>(
    '/api/persona/instructions',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      const { personaId } = req.query;
      if (!personaId) {
        return reply.code(400).send({ success: false, error: 'Missing or invalid personaId' });
      }
      try {
        const persona = await personaService.getPersonaProfile(personaId, familyspaceId);
        if (!persona || persona.familyspaceId !== familyspaceId) {
          return reply.code(404).send({ success: false, error: 'Persona profile not found' });
        }
        return reply.code(200).send({
          success: true,
          instructions: persona.customInstructions,
          templates: CUSTOM_INSTRUCTION_TEMPLATES,
        });
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to get custom instructions',
        });
      }
    },
  );

  app.post(
    '/api/persona/instructions',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { personaId, customInstructions } = req.body as any;
      if (!personaId) {
        return reply.code(400).send({ success: false, error: 'Missing required field: personaId' });
      }
      if (!customInstructions) {
        return reply.code(400).send({ success: false, error: 'Missing required field: customInstructions' });
      }
      try {
        const existing = await personaService.getPersonaProfile(personaId, familyspaceId);
        if (!existing || existing.familyspaceId !== familyspaceId) {
          return reply.code(404).send({ success: false, error: 'Persona profile not found' });
        }
        const updatedPersona = await personaService.updatePersonaProfile(personaId, { customInstructions });
        return reply.code(200).send({ success: true, persona: updatedPersona });
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update custom instructions',
        });
      }
    },
  );

  app.put(
    '/api/persona/instructions',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { personaId, category, instruction, key } = req.body as any;
      if (!personaId || !category || !instruction) {
        return reply.code(400).send({
          success: false,
          error: 'Missing required fields: personaId, category, instruction',
        });
      }
      try {
        const persona = await personaService.getPersonaProfile(personaId, familyspaceId);
        if (!persona || persona.familyspaceId !== familyspaceId) {
          return reply.code(404).send({ success: false, error: 'Persona profile not found' });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedInstructions = { ...persona.customInstructions } as any;
        switch (category) {
          case 'relationship':
            if (!key) return reply.code(400).send({ success: false, error: 'Missing required field: key' });
            updatedInstructions.relationshipInstructions[key] = instruction;
            break;
          case 'behavior':
            updatedInstructions.behaviorInstructions.push(instruction);
            break;
          case 'topic':
            if (!key) return reply.code(400).send({ success: false, error: 'Missing required field: key' });
            updatedInstructions.topicInstructions[key] = instruction;
            break;
          case 'context':
            if (!key) return reply.code(400).send({ success: false, error: 'Missing required field: key' });
            updatedInstructions.contextInstructions[key] = instruction;
            break;
          default:
            return reply.code(400).send({
              success: false,
              error: 'Invalid category. Must be: relationship, behavior, topic, or context',
            });
        }
        const updatedPersona = await personaService.updatePersonaProfile(personaId, {
          customInstructions: updatedInstructions,
        });
        return reply.code(200).send({ success: true, persona: updatedPersona });
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to add custom instruction',
        });
      }
    },
  );

  app.delete(
    '/api/persona/instructions',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { personaId, category, key, index } = req.body as any;
      if (!personaId || !category) {
        return reply.code(400).send({ success: false, error: 'Missing required fields: personaId, category' });
      }
      try {
        const persona = await personaService.getPersonaProfile(personaId, familyspaceId);
        if (!persona || persona.familyspaceId !== familyspaceId) {
          return reply.code(404).send({ success: false, error: 'Persona profile not found' });
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const updatedInstructions = { ...persona.customInstructions } as any;
        switch (category) {
          case 'relationship':
            if (!key) return reply.code(400).send({ success: false, error: 'Missing required field: key' });
            delete updatedInstructions.relationshipInstructions[key];
            break;
          case 'behavior':
            if (index === undefined || index === null) {
              return reply.code(400).send({ success: false, error: 'Missing required field: index' });
            }
            updatedInstructions.behaviorInstructions.splice(index, 1);
            break;
          case 'topic':
            if (!key) return reply.code(400).send({ success: false, error: 'Missing required field: key' });
            delete updatedInstructions.topicInstructions[key];
            break;
          case 'context':
            if (!key) return reply.code(400).send({ success: false, error: 'Missing required field: key' });
            delete updatedInstructions.contextInstructions[key];
            break;
          default:
            return reply.code(400).send({
              success: false,
              error: 'Invalid category. Must be: relationship, behavior, topic, or context',
            });
        }
        const updatedPersona = await personaService.updatePersonaProfile(personaId, {
          customInstructions: updatedInstructions,
        });
        return reply.code(200).send({ success: true, persona: updatedPersona });
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to remove custom instruction',
        });
      }
    },
  );

  // GET /api/persona/:personId  — dynamic, after static routes
  app.get<{ Params: { personId: string } }>(
    '/api/persona/:personId',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const { personId } = req.params;
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      try {
        const persona = await personaService.getPersonaProfile(personId, familyspaceId);
        if (!persona) {
          return reply.code(404).send({ success: false, error: 'Persona profile not found' });
        }
        return reply.code(200).send({
          success: true,
          persona: {
            id: persona.id,
            personId: persona.personId,
            familyspaceId: persona.familyspaceId,
            status: persona.status,
            documentSampleCount: persona.documentSampleCount,
            confidenceScore: persona.confidenceScore,
            lastUpdated: persona.lastUpdated,
            createdAt: persona.createdAt,
          },
        });
      } catch (error) {
        return reply.code(500).send({ success: false, error: 'Failed to retrieve persona profile' });
      }
    },
  );

  // POST /api/persona/:personId/generate
  app.post<{ Params: { personId: string } }>(
    '/api/persona/:personId/generate',
    { preHandler: [bearerAuthHook, requireContextHeadersHook] },
    async (req, reply) => {
      const { personId } = req.params;
      const familyspaceId = req.headers['x-familyspace-id'] as string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { options } = req.body as any;

      try {
        const existingPersona = await personaService.getPersonaProfile(personId, familyspaceId);
        if (existingPersona) {
          return reply.code(409).send({
            success: false,
            error: 'Persona profile already exists for this person',
          });
        }

        const documents = await documentRepository.listDocuments(familyspaceId, { personId });
        if (documents.length === 0) {
          return reply.code(400).send({
            success: false,
            error: 'No documents found for this person. At least one document is required to generate a persona.',
          });
        }

        const generationOptions: PersonaGenerationOptions = {
          documentIds: documents.map(doc => doc.id),
          extractStyle: options?.extractStyle ?? true,
          extractFacts: options?.extractFacts ?? true,
          extractRelationships: options?.extractRelationships ?? true,
          minDocumentCount: options?.minDocumentCount || 1,
          confidenceThreshold: options?.confidenceThreshold || 0.5,
        };

        const persona = await personaService.generatePersonaProfile(personId, familyspaceId, generationOptions);
        return reply.code(201).send({
          success: true,
          persona: {
            id: persona.id,
            personId: persona.personId,
            familyspaceId: persona.familyspaceId,
            status: persona.status,
            documentSampleCount: persona.documentSampleCount,
            confidenceScore: persona.confidenceScore,
            lastUpdated: persona.lastUpdated,
            createdAt: persona.createdAt,
          },
          message: `Successfully generated persona profile using ${documents.length} documents`,
        });
      } catch (error) {
        return reply.code(400).send({
          success: false,
          error: error instanceof Error ? error.message : 'Failed to generate persona profile',
        });
      }
    },
  );
}
