const { ChromaClient, DefaultEmbeddingFunction } = require('chromadb');

async function testQuery() {
  const client = new ChromaClient({ path: 'http://localhost:8004' });
  const embedder = new DefaultEmbeddingFunction();
  
  try {
    const collection = await client.getCollection({ 
      name: 'workspace_931638b2-8341-41fc-a064-0883a9911d54_documents',
      embeddingFunction: embedder
    });

    // Test with nResults=5
    console.log('=== Testing with nResults=5 ===');
    const results = await collection.query({
      queryTexts: ['what was your job'],
      nResults: 5,
      where: { personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c' }
    });
    
    console.log('Retrieved:', results.ids[0]?.length || 0, 'documents');
    console.log('nResults parameter was set to: 5');
    
    // Test with nResults=1
    console.log('\n=== Testing with nResults=1 ===');
    const results2 = await collection.query({
      queryTexts: ['what was your job'],
      nResults: 1,
      where: { personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c' }
    });
    
    console.log('Retrieved:', results2.ids[0]?.length || 0, 'documents');
    console.log('nResults parameter was set to: 1');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testQuery();
