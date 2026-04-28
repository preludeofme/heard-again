const { ChromaClient, DefaultEmbeddingFunction } = require('chromadb');

async function addDocuments() {
  const client = new ChromaClient({ path: 'http://localhost:8004' });
  const embedder = new DefaultEmbeddingFunction();
  
  try {
    const collection = await client.getCollection({ 
      name: 'familyspace_931638b2-8341-41fc-a064-0883a9911d54_documents',
      embeddingFunction: embedder
    });

    // Documents to add
    const documents = [
      {
        id: 'doc-plumber',
        content: 'Keith worked as a plumber for over 30 years. He took pride in his work helping people fix their pipes and plumbing issues. He owned his own plumbing business and employed several workers.',
        metadata: {
          documentId: 'doc-plumber',
          documentType: 'DOCUMENT',
          personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c',
          source: 'biography',
          title: 'Career',
          createdAt: Date.now()
        }
      },
      {
        id: 'doc-wife',
        content: 'Keith was married to Bobby for 45 years. Bobby was his high school sweetheart and they met when they were both 16 years old. She supported him throughout his plumbing career and raised their son Ryan together.',
        metadata: {
          documentId: 'doc-wife',
          documentType: 'DOCUMENT',
          personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c',
          source: 'biography',
          title: 'Marriage',
          createdAt: Date.now()
        }
      }
    ];

    // Add documents
    await collection.add({
      ids: documents.map(d => d.id),
      documents: documents.map(d => d.content),
      metadatas: documents.map(d => d.metadata)
    });

    console.log('Successfully added', documents.length, 'documents');
    
    // Verify
    const count = await collection.count();
    console.log('Total documents in collection:', count);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

addDocuments();
