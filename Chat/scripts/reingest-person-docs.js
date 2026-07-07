/**
 * Re-ingest only the documents linked to the person
 */
const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');
const { v4: uuidv4 } = require('uuid');

const path = require('path');
const FAMILYSPACE_ID = process.env.FAMILYSPACE_ID || 'your-familyspace-uuid';
const PERSON_ID = process.env.PERSON_ID || 'your-person-uuid';

async function reingest() {
  const prisma = new PrismaClient();
  const queue = new Queue('document-ingestion', { connection: { host: 'localhost', port: 6379, maxRetriesPerRequest: null } });

  try {
    // Get the two documents linked to the person
    const docs = await prisma.document.findMany({
      where: { 
        familyspaceId: FAMILYSPACE_ID,
        personId: PERSON_ID,
        title: { in: ["Dad's jobs.docx", "Dad Story - addendum.docx"] }
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log('Found', docs.length, 'documents to re-ingest');

    for (const doc of docs) {
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
        filePath: path.resolve(__dirname, `../temp-ingestion/${FAMILYSPACE_ID}/${doc.id}.docx`),
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        familyspaceId: FAMILYSPACE_ID,
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
