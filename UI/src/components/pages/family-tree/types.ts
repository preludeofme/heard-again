export type TreeNodeLevel = 'grandparent' | 'parent' | 'child' | string | number

export interface TreePerson {
  id: string | number
  name: string
  role: string
  avatar: string
  birthDate?: string | null
  deathDate?: string | null
  memories?: number
  selected?: boolean
  spouseWithNext?: boolean
  upperGenerationLinkType?: 'biological' | 'nonBiological' | 'none'
  generation?: number // Added for multi-generation support
}

export interface FamilyTreeRelationshipEdge {
  id: string
  sourceId: string
  targetId: string
  type: 'SPOUSE' | 'PARENT_CHILD'
  relationshipKind: 'biological' | 'nonBiological'
}

export interface FamilyTreeData {
  generations: Record<number, TreePerson[]>
  relationshipEdges: FamilyTreeRelationshipEdge[]
  rootPersonId?: string
}

export interface PersonFormData {
  firstName: string
  lastName?: string
  displayName?: string
  birthDate?: string
  deathDate?: string
  bio?: string
  personType: any
}

export interface CardPosition {
  id: string
  person: TreePerson
  level: TreeNodeLevel
  x: number
  y: number
  width: number
  estimatedHeight: number
}

export interface ConnectorPath {
  id: string
  d: string
  stroke: string
  strokeWidth: number
  strokeDasharray?: string
}
