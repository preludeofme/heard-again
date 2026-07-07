const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const familyspaces = await prisma.familyspace.findMany({
    include: {
      _count: {
        select: { people: true }
      }
    }
  });

  console.log('Available Familyspaces:');
  console.log('------------------------');
  familyspaces.forEach(fs => {
    console.log(`Name: ${fs.name}`);
    console.log(`ID: ${fs.id}`);
    console.log(`Slug: ${fs.slug}`);
    console.log(`Person Count: ${fs._count.people}`);
    console.log('------------------------');
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
