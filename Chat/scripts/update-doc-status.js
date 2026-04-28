const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateStatus() {
  // Find documents with content but wrong status
  const docs = await prisma.document.findMany({
    where: {
      familyspaceId: '931638b2-8341-41fc-a064-0883a9911d54',
      content: {
        not: ''
      }
    }
  });

  console.log(`Found ${docs.length} documents with content`);

  for (const doc of docs) {
    await prisma.document.update({
      where: { id: doc.id },
      data: {
        status: 'PROCESSED',
        embeddingStatus: 'COMPLETED'
      }
    });
    console.log(`Updated: ${doc.title}`);
  }

  await prisma.$disconnect();
}

updateStatus().catch(console.error);
