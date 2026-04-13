const { ChromaClient, DefaultEmbeddingFunction } = require('chromadb');

async function testRAG() {
  const chroma = new ChromaClient({ path: 'http://localhost:8004' });
  const collection = await chroma.getCollection({
    name: 'workspace_931638b2-8341-41fc-a064-0883a9911d54_documents',
    embeddingFunction: new DefaultEmbeddingFunction()
  });

  const results = await collection.query({
    queryTexts: ['did you have any pets'],
    nResults: 3,
    where: { personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c' }
  });

  console.log('Found', results.ids[0].length, 'documents');
  results.ids[0].forEach((id, i) => {
    console.log('\nDocument', i+1, ':');
    console.log('ID:', id);
    const content = results.documents[0][i];
    if (content) {
      console.log('Content:', content.substring(0, 200) + '...');
    } else {
      console.log('Content: [null]');
    }
  });
}

testRAG().catch(console.error);
