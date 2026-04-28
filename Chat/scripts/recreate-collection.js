const { ChromaClient, DefaultEmbeddingFunction } = require('chromadb');

async function recreateCollection() {
  const client = new ChromaClient({ path: 'http://localhost:8004' });
  
  try {
    const collectionName = 'familyspace_931638b2-8341-41fc-a064-0883a9911d54_documents';
    
    // Delete existing collection
    try {
      await client.deleteCollection({ name: collectionName });
      console.log('Deleted existing collection');
    } catch (error) {
      console.log('Collection does not exist, continuing...');
    }
    
    // Create with default embedding function
    const embedder = new DefaultEmbeddingFunction();
    
    const collection = await client.createCollection({ 
      name: collectionName,
      embeddingFunction: embedder
    });
    
    // Add test document with proper embedding
    await collection.add({
      ids: ['test-doc-1'],
      documents: ['When Ryan was 5 years old, he fell off his bike and scraped his knee. His father Keith cleaned the wound and told him a story about bravery to make him feel better.'],
      metadatas: [{
        documentId: 'test-doc-1',
        personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c',
        documentType: 'DOCUMENT',
        title: 'Childhood Memory',
        source: 'test',
        createdAt: Date.now()
      }]
    });
    
    console.log('Collection recreated with embedding function!');
    
    // Test query
    const results = await collection.query({
      queryTexts: ['when I was 5 years old'],
      nResults: 1
    });
    
    console.log('Query results:', JSON.stringify(results, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

recreateCollection();
