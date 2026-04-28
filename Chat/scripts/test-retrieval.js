const { ChromaClient, DefaultEmbeddingFunction } = require('chromadb');

async function testRetrieval() {
  const client = new ChromaClient({ path: 'http://localhost:8004' });
  
  try {
    const embedder = new DefaultEmbeddingFunction();
    const collection = await client.getCollection({ 
      name: 'familyspace_931638b2-8341-41fc-a064-0883a9911d54_documents',
      embeddingFunction: embedder
    });
    
    const results = await collection.query({
      queryTexts: ['when I was 5 years old'],
      nResults: 1,
      where: { personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c' }
    });
    
    console.log('Query successful!');
    console.log('Document:', results.documents[0][0]);
    console.log('Distance:', results.distances[0][0]);
  } catch (error) {
    console.error('Error:', error);
  }
}

testRetrieval();
