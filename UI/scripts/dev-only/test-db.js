const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const families = await prisma.familyUnit.findMany({
    include: {
      parents: true,
      children: true
    }
  });
  console.log('Total families:', families.length);
  if (families.length > 0) {
    console.log('Sample family:', JSON.stringify(families[0], null, 2));
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
