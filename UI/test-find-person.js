const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const p = await prisma.person.findUnique({ where: { id: '7478e023-d8cd-40aa-8247-eb5331b6da1e' }});
  console.log(p);
}
main().catch(console.error).finally(() => prisma.$disconnect());
