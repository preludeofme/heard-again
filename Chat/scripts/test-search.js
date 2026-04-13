const { ChromaClient, DefaultEmbeddingFunction } = require('chromadb');

async function testSearch() {
  const client = new ChromaClient({ path: 'http://localhost:8004' });
  const embedder = new DefaultEmbeddingFunction();
  
  try {
    const collection = await client.getCollection({ 
      name: 'workspace_931638b2-8341-41fc-a064-0883a9911d54_documents',
      embeddingFunction: embedder
    });

    // Test different queries
    const queries = ['what was your job', 'what is your wife name', 'plumber', 'Bobby'];
    
    for (const query of queries) {
      console.log('\n=== Query:', query, '===');
      const results = await collection.query({
        queryTexts: [query],
        nResults: 3,
        where: { personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c' }
      });
      
      console.log('Retrieved:', results.ids[0]?.length || 0, 'documents');
      if (results.documents[0]) {
        results.documents[0].forEach((doc, i) => {
          console.log(`  ${i+1}: ${doc.substring(0, 100)}...`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testSearch();
