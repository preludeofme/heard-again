import { ApiPersonWithEdges } from "@/components/pages/family-tree/xyflow/types";

export type RelationshipDirection = 'outgoing' | 'incoming';
export type RelationshipType = 'SPOUSE' | 'PARENT' | 'CHILD' | 'SIBLING';

interface PathStep {
  type: RelationshipType;
  direction: RelationshipDirection;
}

/**
 * Calculates the relationship descriptor from a target person to a reference user.
 */
export function getRelationshipDescriptor(
  targetId: string,
  userId: string | null | undefined,
  allPeople: ApiPersonWithEdges[]
): string {
  if (!userId) return "";
  if (targetId === userId) return "Self";

  const peopleById = new Map(allPeople.map(p => [p.id, p]));
  
  // BFS to find the shortest path from User to Target
  // We traverse the graph formed by relationship edges
  const queue: { id: string; path: PathStep[] }[] = [{ id: userId, path: [] }];
  const visited = new Set<string>([userId]);

  while (queue.length > 0) {
    const { id, path } = queue.shift()!;
    if (id === targetId) {
      return describePath(path, peopleById.get(targetId)?.sex);
    }

    const person = peopleById.get(id);
    if (!person) continue;

    for (const edge of person.relationshipEdges) {
      const relId = edge.relatedPerson.id;
      if (!visited.has(relId)) {
        visited.add(relId);
        
        // When traversing, we record the edge as it relates to the CURRENT node being processed
        // e.g. if we are at User, and edge is PARENT (outgoing) to Rel, then Rel is a CHILD of User.
        queue.push({ 
          id: relId, 
          path: [...path, { type: edge.type, direction: edge.direction }] 
        });
      }
    }
    
    if (path.length > 10) continue; // Safety limit
  }

  return "";
}

/**
 * Describes a relationship path in natural language.
 * Note: The path is from USER to TARGET.
 */
function describePath(path: PathStep[], sex?: string): string {
  if (path.length === 0) return "";

  // Normalize sex
  const isMale = sex === 'M';
  const isFemale = sex === 'F';

  // 1-step relations
  if (path.length === 1) {
    const step = path[0];
    if (step.type === 'SPOUSE') return isMale ? 'Husband' : (isFemale ? 'Wife' : 'Spouse');
    if (step.type === 'SIBLING') return isMale ? 'Brother' : (isFemale ? 'Sister' : 'Sibling');
    
    // User -> Target: User is parent of Target
    if (step.type === 'PARENT' && step.direction === 'outgoing') return isMale ? 'Son' : (isFemale ? 'Daughter' : 'Child');
    // User -> Target: User is child of Target
    if (step.type === 'CHILD' && step.direction === 'outgoing') return isMale ? 'Father' : (isFemale ? 'Mother' : 'Parent');
    
    // Reverse handles (should be covered by outgoing if graph is bidirectional, but for safety:)
    if (step.type === 'PARENT' && step.direction === 'incoming') return isMale ? 'Father' : (isFemale ? 'Mother' : 'Parent');
    if (step.type === 'CHILD' && step.direction === 'incoming') return isMale ? 'Son' : (isFemale ? 'Daughter' : 'Child');
  }

  // Pure ancestors (all steps are "User is child of X")
  const isPureAncestor = path.every(s => s.type === 'CHILD' || (s.type === 'PARENT' && s.direction === 'incoming'));
  if (isPureAncestor) {
    const depth = path.length;
    if (depth === 2) return isMale ? 'Grandfather' : (isFemale ? 'Grandmother' : 'Grandparent');
    if (depth === 3) return isMale ? 'Great-Grandfather' : (isFemale ? 'Great-Grandmother' : 'Great-Grandparent');
    return `Great x${depth - 2} Grand${isMale ? 'father' : (isFemale ? 'mother' : 'parent')}`;
  }

  // Pure descendants (all steps are "User is parent of X")
  const isPureDescendant = path.every(s => s.type === 'PARENT' || (s.type === 'CHILD' && s.direction === 'incoming'));
  if (isPureDescendant) {
    const depth = path.length;
    if (depth === 2) return isMale ? 'Grandson' : (isFemale ? 'Granddaughter' : 'Grandchild');
    if (depth === 3) return isMale ? 'Great-Grandson' : (isFemale ? 'Great-Granddaughter' : 'Great-Grandchild');
    return `Great x${depth - 2} Grand${isMale ? 'son' : (isFemale ? 'daughter' : 'child')}`;
  }

  // Aunts/Uncles: User -> Parent -> Sibling
  if (path.length === 2 && 
      (path[0].type === 'CHILD' || (path[0].type === 'PARENT' && path[0].direction === 'incoming')) &&
      path[1].type === 'SIBLING') {
    return isMale ? 'Uncle' : (isFemale ? 'Aunt' : 'Aunt/Uncle');
  }

  // Nieces/Nephews: User -> Sibling -> Child
  if (path.length === 2 && 
      path[0].type === 'SIBLING' &&
      (path[1].type === 'PARENT' || (path[1].type === 'CHILD' && path[1].direction === 'incoming'))) {
    return isMale ? 'Nephew' : (isFemale ? 'Niece' : 'Niece/Nephew');
  }

  // Cousins: User -> Parent -> Sibling -> Child
  if (path.length === 3 && 
      (path[0].type === 'CHILD' || (path[0].type === 'PARENT' && path[0].direction === 'incoming')) &&
      path[1].type === 'SIBLING' &&
      (path[2].type === 'PARENT' || (path[2].type === 'CHILD' && path[2].direction === 'incoming'))) {
    return 'First Cousin';
  }

  // In-laws: User -> Spouse -> (Parent/Sibling)
  if (path.length >= 2 && path[0].type === 'SPOUSE') {
    const subPath = path.slice(1);
    const subRelation = describePath(subPath, sex);
    if (subRelation) return `${subRelation}-in-law`;
  }

  // Fallback: simple count-based
  let generationsUp = 0;
  let generationsDown = 0;
  for (const step of path) {
    if (step.type === 'CHILD') generationsUp++;
    else if (step.type === 'PARENT') generationsDown++;
  }

  if (generationsUp > 0 && generationsDown > 0) return "Cousin / Relative";
  
  return "Relative";
}
