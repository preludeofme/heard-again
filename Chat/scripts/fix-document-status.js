const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixStatus() {
  // Update documents that have content but wrong status
  const result = await prisma.document.updateMany({
    where: {
      workspaceId: '931638b2-8341-41fc-a064-0883a9911d54',
      personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c',
      content: {
        not: ''
      },
      status: 'PROCESSING'
    },
    data: {
      status: 'PROCESSED',
      embeddingStatus: 'COMPLETED'
    }
  });

  console.log(`Updated ${result.count} documents to PROCESSED status`);

  // Show updated documents
  const docs = await prisma.document.findMany({
    where: {
      workspaceId: '931638b2-8341-41fc-a064-0883a9911d54',
      personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c',
      status: 'PROCESSED'
    },
    select: {
      id: true,
      title: true,
      content: true,
      status: true,
      embeddingStatus: true
    }
  });

  console.log('\nProcessed documents:');
  docs.forEach(d => {
    console.log(`- ${d.title}: ${d.content?.length || 0} chars, status: ${d.status}/${d.embeddingStatus}`);
  });

  await prisma.$disconnect();
}

fixStatus().catch(console.error);
