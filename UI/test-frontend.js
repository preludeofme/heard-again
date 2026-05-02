const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const familyspaceId = '931638b2-8341-41fc-a064-0883a9911d54'; 
  const rootId = '7478e023-d8cd-40aa-8247-eb5331b6da1e';
  
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
            edges.push({ id: `spouse`, type: 'SPOUSE', direction: 'outgoing', relatedPerson: p.parent });
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
    return { id: person.id, relationshipEdges: edges };
  });

  // Now run assignGenerations logic from layout.ts
  const people = responseData;
  const rootPersonId = rootId;

  const peopleById = new Map(people.map((p) => [p.id, p]))
  const generationById = new Map([[rootPersonId, 0]])
  const queue = [rootPersonId]

  while (queue.length > 0) {
    const currentId = queue.shift()
    const currentGen = generationById.get(currentId)
    const current = peopleById.get(currentId)
    if (!current) continue

    for (const edge of current.relationshipEdges) {
      const relId = edge.relatedPerson.id
      if (!peopleById.has(relId)) continue

      let delta = 0
      if (edge.type === 'SPOUSE') {
        delta = 0
      } else if (edge.type === 'PARENT') {
        delta = edge.direction === 'incoming' ? 1 : -1
      } else if (edge.type === 'CHILD') {
        delta = edge.direction === 'outgoing' ? -1 : 1
      }

      const candidate = currentGen + delta
      const existing = generationById.get(relId)

      if (existing === undefined || Math.abs(candidate) < Math.abs(existing)) {
        generationById.set(relId, candidate)
        queue.push(relId)
      }
    }
  }

  // Assign unvisited people generation 0
  for (const person of people) {
    if (!generationById.has(person.id)) generationById.set(person.id, 0)
  }

  const byGen = new Map();
  for (const [id, gen] of generationById.entries()) {
    if (!byGen.has(gen)) byGen.set(gen, 0);
    byGen.set(gen, byGen.get(gen) + 1);
  }
  
  console.log("Generations breakdown:", Object.fromEntries(byGen));

}

main().catch(console.error).finally(() => prisma.$disconnect());
