const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const WORKSPACE_ID = '931638b2-8341-41fc-a064-0883a9911d54';
const PERSON_ID = '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c';

async function reingest() {
  const prisma = new PrismaClient();
  const queue = new Queue('document-ingestion', { connection: { host: 'localhost', port: 6379, maxRetriesPerRequest: null } });

  try {
    // Get the two most recent documents with UPLOADED status
    const docs = await prisma.document.findMany({
      where: { 
        workspaceId: WORKSPACE_ID,
        status: 'UPLOADED',
        title: { in: ["Dad's jobs.docx", "Dad Story - addendum.docx"] }
      },
      orderBy: { createdAt: 'desc' },
      take: 2,
    });

    console.log('Found', docs.length, 'recent documents to re-ingest');

    for (const doc of docs) {
      // Find temp file
      const tempDir = path.join(process.cwd(), 'temp-ingestion', WORKSPACE_ID);
      const possibleExts = ['.docx', '.pdf', '.txt', '.doc', '.md'];
      let filePath = null;

      for (const ext of possibleExts) {
        const candidate = path.join(tempDir, `${doc.id}${ext}`);
        if (fs.existsSync(candidate)) {
          filePath = candidate;
          break;
        }
      }

      if (!filePath) {
        console.log(`Skipping ${doc.title} - no temp file found`);
        continue;
      }

      console.log(`Processing ${doc.title}: ${filePath}`);

      // Reset status
      await prisma.document.update({
        where: { id: doc.id },
        data: { status: 'PROCESSING', embeddingStatus: 'PENDING', updatedAt: new Date() }
      });

      // Delete old chunks
      await prisma.documentChunk.deleteMany({ where: { documentId: doc.id } });

      // Queue job
      const traceId = uuidv4();
      const job = await queue.add('process-document', {
        documentId: doc.id,
        filePath,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        workspaceId: WORKSPACE_ID,
        title: doc.title,
        personId: PERSON_ID,
        traceId,
      }, {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      });

      console.log('Queued job', job.id, 'for', doc.title);
    }

    console.log('\n=== Check the worker output ===');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await queue.close();
    await prisma.$disconnect();
  }
}

reingest().catch(console.error);
