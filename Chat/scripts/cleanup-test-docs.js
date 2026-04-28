/**
 * Cleanup script: Removes old test documents from ChromaDB and recreates the collection
 * with DefaultEmbeddingFunction for consistency with the retrieval service.
 * 
 * Usage: node scripts/cleanup-test-docs.js
 * 
 * This deletes the entire collection (including stale test-doc-1, doc-wife, doc-plumber)
 * and recreates it empty so that the ingestion worker can re-populate it with real documents.
 */
const { ChromaClient, DefaultEmbeddingFunction } = require('chromadb');

const CHROMA_URL = process.env.CHROMA_URL || 'http://localhost:8004';
const FAMILYSPACE_ID = process.env.FAMILYSPACE_ID || '931638b2-8341-41fc-a064-0883a9911d54';

async function cleanup() {
  const client = new ChromaClient({ path: CHROMA_URL });
  const collectionName = `familyspace_${FAMILYSPACE_ID}_documents`;

  console.log(`ChromaDB URL: ${CHROMA_URL}`);
  console.log(`Target collection: ${collectionName}\n`);

  try {
    // 1. List all collections
    const collections = await client.listCollections();
    console.log('Existing collections:', collections.map(c => c.name || c));

    // 2. Try to inspect what's in the collection before deleting
    try {
      const embedder = new DefaultEmbeddingFunction();
      const collection = await client.getCollection({ 
        name: collectionName,
        embeddingFunction: embedder
      });
      const count = await collection.count();
      console.log(`\nCollection "${collectionName}" has ${count} documents`);

      // Peek at all docs
      if (count > 0) {
        const peek = await collection.peek({ limit: Math.min(count, 20) });
        console.log('\nDocument IDs in collection:');
        peek.ids.forEach((id, i) => {
          const meta = peek.metadatas[i];
          const preview = peek.documents[i]?.substring(0, 80) || '(no content)';
          console.log(`  - ${id} | title: ${meta?.title || 'N/A'} | personId: ${meta?.personId || 'N/A'}`);
          console.log(`    preview: ${preview}...`);
        });
      }
    } catch (err) {
      console.log(`\nCollection "${collectionName}" does not exist yet — nothing to clean.`);
      return;
    }

    // 3. Delete the collection
    console.log(`\nDeleting collection "${collectionName}"...`);
    await client.deleteCollection({ name: collectionName });
    console.log('Collection deleted ✓');

    // 4. Recreate with DefaultEmbeddingFunction (matching retrieval service)
    const embedder = new DefaultEmbeddingFunction();
    await client.createCollection({
      name: collectionName,
      embeddingFunction: embedder,
    });
    console.log(`Collection "${collectionName}" recreated with DefaultEmbeddingFunction ✓`);

    console.log('\n=== NEXT STEPS ===');
    console.log('1. Start the ingestion worker:  npm run ingestion:worker');
    console.log('2. Re-upload your documents through the UI, OR');
    console.log('3. Re-trigger ingestion for existing documents via the API');

  } catch (error) {
    console.error('Error during cleanup:', error);
    process.exit(1);
  }
}

cleanup().catch(console.error);
