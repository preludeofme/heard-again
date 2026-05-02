const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const familyspaceId = 'b5c94274-ff2c-43df-89fc-4175b3084ab0'; // from previous db check
  
  // mock the API logic exactly
  const allPeople = await prisma.person.findMany({ where: { familyspaceId }});
  const allFamilyUnits = await prisma.familyUnit.findMany({
    where: { familyspaceId },
    include: {
      parents: { include: { parent: { select: { id: true } } } },
      children: { include: { child: { select: { id: true } } } }
    }
  });

  const familiesByPersonId = new Map();
  allFamilyUnits.forEach(unit => {
    unit.parents.forEach(p => {
      if (!familiesByPersonId.has(p.parentId)) familiesByPersonId.set(p.parentId, []);
      familiesByPersonId.get(p.parentId).push({ isParent: true, isChild: false, unit });
    });
    unit.children.forEach(c => {
      if (!familiesByPersonId.has(c.childId)) familiesByPersonId.set(c.childId, []);
      familiesByPersonId.get(c.childId).push({ isParent: false, isChild: true, unit });
    });
  });

  // Pick a root
  const rootId = allPeople[0].id;
  const results = new Set([rootId]);

  const traverseUp = (id, depth) => {
    if (depth >= 2) return;
    const families = familiesByPersonId.get(id) || [];
    families.filter(f => f.isChild).forEach(f => {
      f.unit.parents.forEach(p => {
        results.add(p.parentId);
        traverseUp(p.parentId, depth + 1);
      });
    });
  };
  traverseUp(rootId, 0);

  const traverseDown = (id, depth) => {
    if (depth >= 2) return;
    const families = familiesByPersonId.get(id) || [];
    families.filter(f => f.isParent).forEach(f => {
      f.unit.children.forEach(c => {
        results.add(c.childId);
        traverseDown(c.childId, depth + 1);
      });
    });
  };
  traverseDown(rootId, 0);

  const peopleToReturn = allPeople.filter(p => results.has(p.id));
  const peopleIdsInResult = new Set(peopleToReturn.map(p => p.id));
  
  const responseData = peopleToReturn.map(person => {
    const edges = [];
    const families = familiesByPersonId.get(person.id) || [];
    families.forEach(({ isParent, isChild, unit }) => {
      if (isParent) {
        unit.parents.forEach(p => {
          if (p.parentId !== person.id && peopleIdsInResult.has(p.parentId)) {
            edges.push({ id: `spouse`, type: 'SPOUSE', direction: 'outgoing' });
          }
        });
        unit.children.forEach(c => {
          edges.push({ id: `child`, type: 'CHILD', direction: 'outgoing', relatedPerson: c.child });
        });
      }
      if (isChild) {
        unit.parents.forEach(p => {
          edges.push({ id: `parent`, type: 'PARENT', direction: 'incoming', relatedPerson: p.parent });
        });
      }
    });
    return { id: person.id, edges };
  });

  console.log(`Root ID: ${rootId}`);
  console.log(`People returned: ${responseData.length}`);
  if (responseData.length > 0) {
    console.log(`Edges for root:`, responseData.find(p => p.id === rootId).edges);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
