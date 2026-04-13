/**
 * Re-ingestion script: Re-queues all documents for a workspace through the fixed ingestion pipeline.
 * Run this AFTER cleanup-test-docs.js and AFTER starting the ingestion worker.
 * 
 * Usage: node scripts/reingest-documents.js
 * 
 * Prerequisites:
 *   1. Run: node scripts/cleanup-test-docs.js  (purge stale ChromaDB data)
 *   2. Start worker: npm run ingestion:worker
 *   3. Then run this script to re-queue all documents
 */
const { PrismaClient } = require('@prisma/client');
const { Queue } = require('bullmq');
const { v4: uuidv4 } = require('uuid');

const WORKSPACE_ID = process.env.WORKSPACE_ID || '931638b2-8341-41fc-a064-0883a9911d54';

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
};

async function reingest() {
  const prisma = new PrismaClient();

  try {
    // 1. Find all documents for this workspace
    const documents = await prisma.document.findMany({
      where: { workspaceId: WORKSPACE_ID },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${documents.length} documents in workspace ${WORKSPACE_ID}\n`);

    if (documents.length === 0) {
      console.log('No documents to re-ingest. Upload documents through the UI first.');
      return;
    }

    // 2. List documents
    documents.forEach((doc, i) => {
      console.log(`  ${i + 1}. [${doc.id}] "${doc.title}" (${doc.status}) personId=${doc.personId || 'N/A'}`);
    });

    // 3. Check if temp files still exist, and find asset storage paths
    const fs = require('fs');
    const path = require('path');
    const tempDir = path.join(process.cwd(), 'temp-ingestion', WORKSPACE_ID);

    // 4. Create ingestion queue
    const queue = new Queue('document-ingestion', {
      connection: redisConfig,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
      },
    });

    let queued = 0;
    let skipped = 0;

    for (const doc of documents) {
      // Check for temp file or asset file
      const possibleExts = ['.docx', '.pdf', '.txt', '.doc', '.md', '.csv', '.jpg', '.png', '.tiff'];
      let filePath = null;

      for (const ext of possibleExts) {
        const candidate = path.join(tempDir, `${doc.id}${ext}`);
        if (fs.existsSync(candidate)) {
          filePath = candidate;
          break;
        }
      }

      if (!filePath) {
        // Try to find by checking the asset's storage file
        const uploadsDir = path.join(process.cwd(), 'temp-uploads');
        // Check if file content is already in the DB
        if (doc.content && doc.content.trim().length > 0) {
          // We have the text content in DB — write a temp file for re-processing
          await fs.promises.mkdir(tempDir, { recursive: true });
          filePath = path.join(tempDir, `${doc.id}.txt`);
          await fs.promises.writeFile(filePath, doc.content, 'utf-8');
          console.log(`\n  [${doc.title}] Using content from DB (${doc.content.length} chars)`);
        } else {
          console.log(`\n  [${doc.title}] SKIPPED — no temp file or DB content found`);
          console.log(`    You may need to re-upload this document through the UI.`);
          skipped++;
          continue;
        }
      } else {
        console.log(`\n  [${doc.title}] Found temp file: ${filePath}`);
      }

      // Determine mime type
      const ext = path.extname(filePath).toLowerCase();
      const mimeMap = {
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.doc': 'application/msword',
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.csv': 'text/csv',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.tiff': 'image/tiff',
      };
      const mimeType = mimeMap[ext] || (doc.metadata?.mimeType) || 'text/plain';

      // Reset document status
      await prisma.document.update({
        where: { id: doc.id },
        data: {
          status: 'PROCESSING',
          embeddingStatus: 'PENDING',
          updatedAt: new Date(),
        },
      });

      // Delete old chunks from Postgres
      await prisma.documentChunk.deleteMany({
        where: { documentId: doc.id },
      });

      // Queue the job
      const traceId = uuidv4();
      const job = await queue.add('process-document', {
        documentId: doc.id,
        filePath,
        mimeType,
        workspaceId: WORKSPACE_ID,
        title: doc.title,
        personId: doc.personId || null,
        traceId,
      });

      console.log(`  Queued job ${job.id} for "${doc.title}" (traceId: ${traceId})`);
      queued++;
    }

    console.log(`\n=== Summary ===`);
    console.log(`Queued: ${queued} documents`);
    console.log(`Skipped: ${skipped} documents`);
    console.log(`\nMake sure the ingestion worker is running: npm run ingestion:worker`);

    await queue.close();
  } catch (error) {
    console.error('Error during re-ingestion:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

reingest().catch(console.error);
