const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function addContent() {
  // Get any document with the right title
  const doc = await prisma.document.findFirst({
    where: {
      familyspaceId: '931638b2-8341-41fc-a064-0883a9911d54',
      title: { contains: "Dad Story" }
    }
  });

  if (doc) {
    // Manually add some content about the dog
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        content: `Dad's story addendum

When dad was about 6, he had a dog that was a shepherd mix, black and white called Pal. One day the dog was laid out on the ground, hardly able to move. A neighbor a few doors down was called, and he came and examined the dog closely, and said that he had rabies. Holding the dog in his arms and stroking his head, the man reached into his pocket and pulled out a small pistol. Continuing to murmur to the dog, the man put the pistol to its head and shot him. It obviously made a huge impression on Dad.`,
        status: 'PROCESSED',
        embeddingStatus: 'COMPLETED',
        personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c'
      }
    });
    console.log('Updated document with content about the dog');
    
    // Create chunks for ChromaDB
    const { ChromaClient, DefaultEmbeddingFunction } = require('chromadb');
    const chroma = new ChromaClient({ path: 'http://localhost:8004' });
    const collection = await chroma.getCollection({
      name: 'familyspace_931638b2-8341-41fc-a064-0883a9911d54_documents',
      embeddingFunction: new DefaultEmbeddingFunction()
    });
    
    // Add the document to ChromaDB
    await collection.add({
      ids: [`${doc.id}_chunk_0`],
      documents: [doc.content],
      metadatas: [{
        documentId: doc.id,
        title: doc.title,
        personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c',
        documentType: 'docx',
        createdAt: new Date().getTime()
      }]
    });
    
    console.log('Added document to ChromaDB');
  } else {
    console.log('No document found');
  }

  await prisma.$disconnect();
}

addContent().catch(console.error);
