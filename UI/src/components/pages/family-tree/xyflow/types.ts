// Shared types for the @xyflow/react family tree layer

export interface ApiPerson {
  id: string
  firstName: string
  lastName?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  personType?: string
  sex?: 'M' | 'F' | 'U' | 'X'
  counts?: { stories?: number; voiceProfiles?: number; relationships?: number }
}

export interface RelationshipEdge {
  id: string
  type: 'SPOUSE' | 'PARENT' | 'CHILD'
  direction: 'outgoing' | 'incoming'
  isBiological: boolean
  notes?: string | null
  relatedPerson: {
    id: string
    firstName: string
    lastName: string | null
    nickname: string | null
    avatarAssetId: string | null
    sex?: 'M' | 'F' | 'U' | 'X'
  }
}

export interface ApiPersonWithEdges extends ApiPerson {
  relationshipEdges: RelationshipEdge[]
}

/** Generation-aware person for layout and card rendering */
export interface TreeLayoutPerson {
  id: string
  name: string
  role: string
  avatar: string
  memories?: number
  selected?: boolean
  /** Card width assigned during layout — varies by generation */
  width: number
  /** Card height assigned during layout — varies by generation */
  height: number
}

export type TreeNodeLevel = 'grandparent' | 'parent' | 'child'

/** Data attached to a personNode in React Flow */
export interface PersonNodeData {
  person: TreeLayoutPerson
  level: TreeNodeLevel
  isSelf: boolean
  isMobile: boolean
  onPersonClick: (person: TreeLayoutPerson) => void
  onAddPerson: () => void
  onViewArchive: (person: TreeLayoutPerson) => void
  onSetRoot?: (id: string) => void
}

/** Marker so TypeScript knows the node type */
export type PersonFlowNode = {
  id: string
  type: 'personNode'
  position: { x: number; y: number }
  data: PersonNodeData
  draggable?: boolean
}

export type FamilyFlowNode = {
  id: string
  type: 'familyNode'
  position: { x: number; y: number }
  data: Record<string, never>
  draggable?: boolean
}
