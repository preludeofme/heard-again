// Shared types for the @xyflow/react family tree layer
import { TreePerson } from '../types'

export interface ApiPerson {
  id: string
  firstName: string
  lastName?: string | null
  displayName?: string | null
  avatarUrl?: string | null
  personType?: string
  sex?: 'M' | 'F' | 'U' | 'X'
  birthDate?: string | null
  deathDate?: string | null
  counts?: { stories?: number; voiceProfiles?: number; relationships?: number }
}

export interface RelationshipEdge {
  id: string
  type: 'SPOUSE' | 'PARENT' | 'CHILD' | 'SIBLING'
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
export interface TreeLayoutPerson extends TreePerson {
  id: string
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
  isSelected: boolean
  levelIndex: number
  isMobile: boolean
  onPersonClick: (person: TreePerson) => void
  onAddPerson: () => void
  onViewArchive: (person: TreePerson) => void
  onSetRoot?: (id: string) => void
  onEditRelationships?: (personId: string) => void
  onLoadMore?: (direction: 'up' | 'down' | 'left' | 'right', personId: string) => void
  missingUp?: boolean
  missingDown?: boolean
  missingLeft?: boolean
  missingRight?: boolean
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

/** Data attached to a stubNode in React Flow */
export interface StubNodeData {
  targetId: string
  direction: 'up' | 'down' | 'left' | 'right'
  onSetRoot?: (id: string) => void
}
