const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetFamily(familyspaceId) {
  if (!familyspaceId) {
    console.error('Error: Please provide a Familyspace ID.');
    console.log('Usage: node Scripts/reset-family.js <familyspace_id>');
    process.exit(1);
  }

  console.log(`Resetting family data for space: ${familyspaceId}...`);

  try {
    // 1. Delete all family relationships
    const families = await prisma.familyUnit.findMany({
      where: { familyspaceId },
      select: { id: true }
    });
    const familyIds = families.map(f => f.id);

    if (familyIds.length > 0) {
      console.log(`Deleting ${familyIds.length} family units and their links...`);
      await prisma.familyParent.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyChild.deleteMany({ where: { familyId: { in: familyIds } } });
      await prisma.familyUnit.deleteMany({ where: { id: { in: familyIds } } });
    }

    // 2. Delete all people and their related data
    const people = await prisma.person.findMany({
      where: { familyspaceId },
      select: { id: true }
    });
    const personIds = people.map(p => p.id);

    if (personIds.length > 0) {
      console.log(`Deleting ${personIds.length} people and their associated names/events/refs...`);
      // Use batches for very large sets to avoid SQL parameter limits
      const CHUNK_SIZE = 1000;
      for (let i = 0; i < personIds.length; i += CHUNK_SIZE) {
        const chunk = personIds.slice(i, i + CHUNK_SIZE);
        await prisma.personName.deleteMany({ where: { personId: { in: chunk } } });
        await prisma.personEvent.deleteMany({ where: { personId: { in: chunk } } });
        await prisma.personExternalRef.deleteMany({ where: { personId: { in: chunk } } });
        await prisma.chatSession.deleteMany({ where: { personId: { in: chunk } } });
      }
      
      await prisma.person.deleteMany({ where: { id: { in: personIds } } });
    }

    console.log(`\nSUCCESS: Reset complete.`);
    console.log(`Removed ${people.length} people and ${families.length} families.`);
  } catch (error) {
    console.error('\nERROR: Failed to reset family data:', error);
  }
}

// Get ID from command line argument
const TARGET_ID = process.argv[2];
resetFamily(TARGET_ID)
  .catch(console.error)
  .finally(() => prisma.$disconnect());
