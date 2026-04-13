const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const docs = await prisma.document.findMany({
    where: { 
      workspaceId: '931638b2-8341-41fc-a064-0883a9911d54',
      personId: '6967b35d-a6fb-46d4-9cb5-4965c8f36c6c',
      title: { in: ["Dad's jobs.docx", "Dad Story - addendum.docx"] }
    },
    select: { id: true, title: true, content: true, status: true, embeddingStatus: true }
  });

  console.log(`Found ${docs.length} documents:`);
  docs.forEach(d => {
    console.log(`- ${d.title}:`);
    console.log(`  content length: ${d.content?.length || 0}`);
    console.log(`  status: ${d.status}/${d.embeddingStatus}`);
  });

  await prisma.$disconnect();
}

check().catch(console.error);
