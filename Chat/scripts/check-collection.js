const { ChromaClient } = require('chromadb');

async function checkCollection() {
  const client = new ChromaClient({ path: 'http://localhost:8004' });
  
  try {
    const collections = await client.listCollections();
    console.log('Available collections:', collections);
    
    const collectionName = 'workspace_931638b2-8341-41fc-a064-0883a9911d54_documents';
    try {
      const collection = await client.getCollection({ name: collectionName });
      console.log('Collection exists:', collectionName);
      
      const count = await collection.count();
      console.log('Document count:', count);
      
      const results = await collection.get({
        ids: ['test-doc-1']
      });
      console.log('Test document:', results);
    } catch (error) {
      console.log('Collection does not exist:', collectionName);
      console.error('Error:', error.message);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCollection();
