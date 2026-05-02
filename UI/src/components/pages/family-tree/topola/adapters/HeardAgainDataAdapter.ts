import { DataProvider, Indi, Fam } from 'topola';

// Basic API types (copied from family-tree.tsx for now, later we can extract them to a shared types file)
export interface ApiPerson {
  id: string;
  firstName: string;
  lastName?: string | null;
  displayName?: string | null;
  avatarUrl?: string | null;
  personType?: string;
  sex?: 'M' | 'F' | 'U' | 'X';
  counts?: {
    stories?: number;
    voiceProfiles?: number;
    relationships?: number;
  };
}

export interface RelationshipEdge {
  id: string;
  type: 'SPOUSE' | 'PARENT' | 'CHILD';
  direction: 'outgoing' | 'incoming';
  isBiological: boolean;
  notes?: string | null;
  relatedPerson: {
    id: string;
    firstName: string;
    lastName: string | null;
    nickname: string | null;
    avatarAssetId: string | null;
    sex?: 'M' | 'F' | 'U' | 'X';
  };
}

export interface ApiPersonWithEdges extends ApiPerson {
  relationshipEdges: RelationshipEdge[];
}

export class HeardAgainIndi implements Indi {
  constructor(
    public readonly id: string,
    public readonly originalData: ApiPersonWithEdges,
    private readonly familiesAsSpouse: string[],
    private readonly familyAsChild: string | null
  ) {}

  getId(): string {
    return this.id;
  }

  getFamiliesAsSpouse(): string[] {
    return this.familiesAsSpouse;
  }

  getFamilyAsChild(): string | null {
    return this.familyAsChild;
  }
}

export class HeardAgainFam implements Fam {
  constructor(
    public readonly id: string,
    private readonly father: string | null,
    private readonly mother: string | null,
    private readonly children: string[]
  ) {}

  getId(): string {
    return this.id;
  }

  getFather(): string | null {
    return this.father;
  }

  getMother(): string | null {
    return this.mother;
  }

  getChildren(): string[] {
    return this.children;
  }
}

export class HeardAgainDataProvider implements DataProvider<HeardAgainIndi, HeardAgainFam> {
  private indis = new Map<string, HeardAgainIndi>();
  private fams = new Map<string, HeardAgainFam>();

  constructor(people: ApiPersonWithEdges[]) {
    this.processData(people);
  }

  private processData(people: ApiPersonWithEdges[]) {
    const peopleById = new Map<string, ApiPersonWithEdges>();
    for (const p of people) {
      peopleById.set(p.id, p);
    }

    // A map from parent ID to a set of child IDs
    const childrenByParent = new Map<string, Set<string>>();
    // A map from child ID to a set of parent IDs
    const parentsByChild = new Map<string, Set<string>>();
    // A map from person ID to a set of spouse IDs
    const spousesByPerson = new Map<string, Set<string>>();

    for (const person of people) {
      for (const edge of person.relationshipEdges) {
        if (edge.type === 'CHILD') {
          if (!childrenByParent.has(person.id)) childrenByParent.set(person.id, new Set());
          childrenByParent.get(person.id)!.add(edge.relatedPerson.id);

          if (!parentsByChild.has(edge.relatedPerson.id)) parentsByChild.set(edge.relatedPerson.id, new Set());
          parentsByChild.get(edge.relatedPerson.id)!.add(person.id);
        } else if (edge.type === 'PARENT') {
          if (!parentsByChild.has(person.id)) parentsByChild.set(person.id, new Set());
          parentsByChild.get(person.id)!.add(edge.relatedPerson.id);

          if (!childrenByParent.has(edge.relatedPerson.id)) childrenByParent.set(edge.relatedPerson.id, new Set());
          childrenByParent.get(edge.relatedPerson.id)!.add(person.id);
        } else if (edge.type === 'SPOUSE') {
          if (!spousesByPerson.has(person.id)) spousesByPerson.set(person.id, new Set());
          spousesByPerson.get(person.id)!.add(edge.relatedPerson.id);
        }
      }
    }

    // Create families based on spouses
    const familyIdsBySpousePair = new Map<string, string>(); // key: "id1_id2" (sorted), value: famId
    const families = new Map<string, { father: string | null, mother: string | null, children: Set<string> }>();
    
    let famIdCounter = 1;

    // 1. Create a family for each spouse pair
    for (const [personId, spouses] of spousesByPerson.entries()) {
      for (const spouseId of spouses) {
        const sortedPair = [personId, spouseId].sort();
        const key = `${sortedPair[0]}_${sortedPair[1]}`;
        if (!familyIdsBySpousePair.has(key)) {
          const famId = `F${famIdCounter++}`;
          familyIdsBySpousePair.set(key, famId);
          
          let father: string | null = null;
          let mother: string | null = null;
          
          const p1 = peopleById.get(sortedPair[0]);
          const p2 = peopleById.get(sortedPair[1]);
          
          if (p1?.sex === 'M') father = p1.id;
          else if (p1?.sex === 'F') mother = p1.id;
          
          if (p2?.sex === 'M' && !father) father = p2.id;
          else if (p2?.sex === 'F' && !mother) mother = p2.id;
          
          // If both have same sex or unknown, just assign them arbitrarily for Topola's sake
          if (!father && !mother) {
            father = sortedPair[0];
            mother = sortedPair[1];
          } else if (father && !mother && sortedPair[0] !== father) {
            mother = sortedPair[0];
          } else if (father && !mother && sortedPair[1] !== father) {
            mother = sortedPair[1];
          } else if (!father && mother && sortedPair[0] !== mother) {
            father = sortedPair[0];
          } else if (!father && mother && sortedPair[1] !== mother) {
            father = sortedPair[1];
          }
          
          families.set(famId, { father, mother, children: new Set() });
        }
      }
    }

    // 2. Assign children to families
    for (const [childId, parents] of parentsByChild.entries()) {
      const parentList = Array.from(parents);
      if (parentList.length === 2) {
        // Child has 2 parents, hopefully they are spouses
        const sortedPair = [parentList[0], parentList[1]].sort();
        const key = `${sortedPair[0]}_${sortedPair[1]}`;
        if (familyIdsBySpousePair.has(key)) {
          const famId = familyIdsBySpousePair.get(key)!;
          families.get(famId)!.children.add(childId);
        } else {
          // Parents are not marked as spouses, create an implicit family
          const famId = `F${famIdCounter++}`;
          familyIdsBySpousePair.set(key, famId);
          
          let father: string | null = null;
          let mother: string | null = null;
          const p1 = peopleById.get(sortedPair[0]);
          const p2 = peopleById.get(sortedPair[1]);
          if (p1?.sex === 'M') father = p1.id;
          else if (p1?.sex === 'F') mother = p1.id;
          if (p2?.sex === 'M' && !father) father = p2.id;
          else if (p2?.sex === 'F' && !mother) mother = p2.id;
          if (!father && !mother) { father = sortedPair[0]; mother = sortedPair[1]; }
          else if (father && !mother && sortedPair[0] !== father) mother = sortedPair[0];
          else if (father && !mother && sortedPair[1] !== father) mother = sortedPair[1];
          else if (!father && mother && sortedPair[0] !== mother) father = sortedPair[0];
          else if (!father && mother && sortedPair[1] !== mother) father = sortedPair[1];

          families.set(famId, { father, mother, children: new Set([childId]) });
        }
      } else if (parentList.length === 1) {
        // Single parent family
        const parentId = parentList[0];
        const key = `SINGLE_${parentId}`;
        if (!familyIdsBySpousePair.has(key)) {
          const famId = `F${famIdCounter++}`;
          familyIdsBySpousePair.set(key, famId);
          const p = peopleById.get(parentId);
          const father = p?.sex === 'M' ? parentId : null;
          const mother = p?.sex === 'F' ? parentId : (!father ? parentId : null);
          families.set(famId, { father, mother, children: new Set() });
        }
        const famId = familyIdsBySpousePair.get(key)!;
        families.get(famId)!.children.add(childId);
      } else if (parentList.length > 2) {
        // Edge case: more than 2 parents, just use the first two for Topola
        const sortedPair = [parentList[0], parentList[1]].sort();
        const key = `${sortedPair[0]}_${sortedPair[1]}`;
        // ... same logic as length === 2 ...
        if (familyIdsBySpousePair.has(key)) {
          const famId = familyIdsBySpousePair.get(key)!;
          families.get(famId)!.children.add(childId);
        }
      }
    }

    // Now populate fams and indis maps
    const familyIdAsChild = new Map<string, string>(); // childId -> famId
    for (const [famId, famData] of families.entries()) {
      this.fams.set(famId, new HeardAgainFam(famId, famData.father, famData.mother, Array.from(famData.children)));
      for (const childId of famData.children) {
        familyIdAsChild.set(childId, famId);
      }
    }

    const familiesAsSpouse = new Map<string, string[]>(); // personId -> famId[]
    for (const [key, famId] of familyIdsBySpousePair.entries()) {
      if (key.startsWith('SINGLE_')) {
        const parentId = key.substring(7);
        if (!familiesAsSpouse.has(parentId)) familiesAsSpouse.set(parentId, []);
        familiesAsSpouse.get(parentId)!.push(famId);
      } else {
        const [p1, p2] = key.split('_');
        if (!familiesAsSpouse.has(p1)) familiesAsSpouse.set(p1, []);
        familiesAsSpouse.get(p1)!.push(famId);
        if (!familiesAsSpouse.has(p2)) familiesAsSpouse.set(p2, []);
        familiesAsSpouse.get(p2)!.push(famId);
      }
    }

    for (const p of people) {
      this.indis.set(p.id, new HeardAgainIndi(
        p.id,
        p,
        familiesAsSpouse.get(p.id) || [],
        familyIdAsChild.get(p.id) || null
      ));
    }
  }

  getIndi(id: string): HeardAgainIndi | null {
    return this.indis.get(id) || null;
  }

  getFam(id: string): HeardAgainFam | null {
    return this.fams.get(id) || null;
  }
}
