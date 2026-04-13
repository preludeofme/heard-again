const { ChromaClient } = require('chromadb');

async function testChroma() {
  const client = new ChromaClient({ path: 'http://localhost:8004' });
  
  try {
    // Create collection
    const collectionName = 'workspace_931638b2-8341-41fc-a064-0883a9911d54_documents';
    console.log('Creating collection:', collectionName);
    
    const collection = await client.createCollection({ name: collectionName });
    
    // Add a test document
    await collection.add({
      ids: ['test-doc-1'],
      embeddings: [0.1, 0.2, 0.3, 0.4, 0.5], // Dummy embedding
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
    
    console.log('Test document added successfully!');
    
    // Test query
    const results = await collection.query({
      queryTexts: ['childhood story'],
      nResults: 1
    });
    
    console.log('Query results:', results);
  } catch (error) {
    console.error('Error:', error);
  }
}

testChroma();
