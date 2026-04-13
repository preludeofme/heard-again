const { ChromaClient, DefaultEmbeddingFunction } = require('chromadb');

async function listDocuments() {
  const client = new ChromaClient({ path: 'http://localhost:8004' });
  const embedder = new DefaultEmbeddingFunction();
  
  try {
    const collection = await client.getCollection({ 
      name: 'workspace_931638b2-8341-41fc-a064-0883a9911d54_documents',
      embeddingFunction: embedder
    });

    const results = await collection.get({
      where: { personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c' }
    });

    console.log('Total documents:', results.ids.length);
    results.documents.forEach((doc, i) => {
      console.log('\n--- Document', i+1, '---');
      console.log('Content:', doc);
    });
    
  } catch (error) {
    console.error('Error:', error);
  }
}

listDocuments();
