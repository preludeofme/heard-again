const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const families = await prisma.familyUnit.findMany({
    include: {
      parents: true,
      children: true
    }
  });
  const valid = families.filter(f => f.parents.length > 0 && f.children.length > 0);
  console.log('Families with both:', valid.length);
  if (valid.length > 0) {
    console.log('Sample valid family:', JSON.stringify(valid[0], null, 2));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
