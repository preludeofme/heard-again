import type { Node, Edge } from '@xyflow/react'
import type { TreePerson } from '../types'
import type { ApiPersonWithEdges, TreeLayoutPerson, PersonNodeData, TreeNodeLevel } from './types'

// ─── Layout constants ────────────────────────────────────────────────────────

const PARENT_WIDTH = 288
const STUB_WIDTH = 144
const STUB_HEIGHT = 32
const STUB_GAP = 20
const STUB_EDGE_COLOR = 'rgba(22, 51, 74, 0.28)'
const STUB_EDGE_WIDTH = 2
const PARENT_HEIGHT = 290
const GRANDPARENT_WIDTH = 256
const GRANDPARENT_HEIGHT = 100
const CHILD_WIDTH = 240
const CHILD_HEIGHT = 85
const H_GAP = 48
const V_ROW_GAP = 350
const FAMILY_NODE_SIZE = 1

// Connector colours
const SPOUSE_COLOR = 'rgba(22, 51, 74, 0.34)'
const BIO_COLOR = 'rgba(22, 51, 74, 0.52)'
const NON_BIO_COLOR = 'rgba(22, 51, 74, 0.52)'
const CONNECTOR_WIDTH = 3

// ─── Types local to layout ────────────────────────────────────────────────────

interface FamilyUnit {
  key: string
  parentIds: string[]
  childIds: string[]
}

interface LayoutCallbacks {
  onPersonClick: (person: TreePerson) => void
  onAddPerson: () => void
  onViewArchive: (person: TreePerson) => void
  onSetRoot?: (id: string) => void
  onLoadMore?: (direction: 'up' | 'down') => void
  isMobile: boolean
}

// ─── Step 1: Build relationship maps ─────────────────────────────────────────

function buildRelationshipMaps(people: ApiPersonWithEdges[]) {
  const childrenByParent = new Map<string, Set<string>>()
  const parentsByChild = new Map<string, Set<string>>()
  const spousesByPerson = new Map<string, Set<string>>()

  for (const person of people) {
    for (const edge of person.relationshipEdges) {
      const relId = edge.relatedPerson.id

      if (edge.type === 'CHILD' && edge.direction === 'outgoing') {
        // person is parent, relId is child
        if (!childrenByParent.has(person.id)) childrenByParent.set(person.id, new Set())
        childrenByParent.get(person.id)!.add(relId)

        if (!parentsByChild.has(relId)) parentsByChild.set(relId, new Set())
        parentsByChild.get(relId)!.add(person.id)
      }

      if (edge.type === 'PARENT' && edge.direction === 'incoming') {
        // relId is parent, person is child
        if (!childrenByParent.has(relId)) childrenByParent.set(relId, new Set())
        childrenByParent.get(relId)!.add(person.id)

        if (!parentsByChild.has(person.id)) parentsByChild.set(person.id, new Set())
        parentsByChild.get(person.id)!.add(relId)
      }

      if (edge.type === 'SPOUSE') {
        if (!spousesByPerson.has(person.id)) spousesByPerson.set(person.id, new Set())
        spousesByPerson.get(person.id)!.add(relId)

        if (!spousesByPerson.has(relId)) spousesByPerson.set(relId, new Set())
        spousesByPerson.get(relId)!.add(person.id)
      }
    }
  }

  return { childrenByParent, parentsByChild, spousesByPerson }
}

// ─── Step 2: BFS generation assignment ───────────────────────────────────────

function assignGenerations(
  people: ApiPersonWithEdges[],
  rootPersonId: string,
): Map<string, number> {
  const peopleById = new Map(people.map((p) => [p.id, p]))
  const generationById = new Map<string, number>([[rootPersonId, 0]])
  const queue: string[] = [rootPersonId]

  while (queue.length > 0) {
    const currentId = queue.shift()!
    const currentGen = generationById.get(currentId)!
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

  return generationById
}

// ─── Step 3: Sort generation rows (spouses adjacent) ─────────────────────────

function sortGenerationRow(
  ids: string[],
  spousesByPerson: Map<string, Set<string>>,
): string[] {
  const remaining = new Set(ids)
  const ordered: string[] = []

  while (remaining.size > 0) {
    // Pick first remaining
    const seed = Array.from(remaining)[0]!
    remaining.delete(seed)
    ordered.push(seed)

    // Immediately place all same-generation spouses
    const spouses = spousesByPerson.get(seed)
    if (spouses) {
      Array.from(spouses).forEach((spouseId) => {
        if (remaining.has(spouseId)) {
          remaining.delete(spouseId)
          ordered.push(spouseId)
        }
      })
    }
  }

  return ordered
}

// ─── Step 4: Identify family units ───────────────────────────────────────────

function buildFamilyUnits(parentsByChild: Map<string, Set<string>>): FamilyUnit[] {
  const byKey = new Map<string, FamilyUnit>()

  Array.from(parentsByChild.entries()).forEach(([childId, parents]) => {
    const key = Array.from(parents).sort().join('::')
    if (!byKey.has(key)) {
      byKey.set(key, { key, parentIds: Array.from(parents), childIds: [] })
    }
    byKey.get(key)!.childIds.push(childId)
  })

  return Array.from(byKey.values())
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function cardDimensions(gen: number): { width: number; height: number } {
  if (gen > 0) return { width: GRANDPARENT_WIDTH, height: GRANDPARENT_HEIGHT }
  if (gen < 0) return { width: CHILD_WIDTH, height: CHILD_HEIGHT }
  return { width: PARENT_WIDTH, height: PARENT_HEIGHT }
}

function levelFromGen(gen: number): TreeNodeLevel {
  if (gen > 0) return 'grandparent'
  if (gen < 0) return 'child'
  return 'parent'
}

function buildDisplayName(person: ApiPersonWithEdges): string {
  if (person.displayName) return person.displayName
  const parts = [person.firstName, person.lastName].filter(Boolean)
  return parts.join(' ')
}

// ─── Main layout function ─────────────────────────────────────────────────────

export interface LayoutResult {
  nodes: Node[]
  edges: Edge[]
}

export function buildFamilyTreeLayout(
  people: ApiPersonWithEdges[],
  rootPersonId: string,
  callbacks: LayoutCallbacks,
): LayoutResult {
  if (people.length === 0) return { nodes: [], edges: [] }

  const { childrenByParent, parentsByChild, spousesByPerson } = buildRelationshipMaps(people)
  const generationById = assignGenerations(people, rootPersonId)

  // Group people by generation
  const byGeneration = new Map<number, string[]>()
  for (const person of people) {
    const gen = generationById.get(person.id) ?? 0
    if (!byGeneration.has(gen)) byGeneration.set(gen, [])
    byGeneration.get(gen)!.push(person.id)
  }

  // Sort each generation row
  const sortedByGeneration = new Map<number, string[]>()
  Array.from(byGeneration.entries()).forEach(([gen, ids]) => {
    sortedByGeneration.set(gen, sortGenerationRow(ids, spousesByPerson))
  })

  // Assign Y positions: newest generation at top
  const sortedGens = Array.from(byGeneration.keys()).sort((a, b) => a - b)
  const rowY = new Map<number, number>()
  sortedGens.forEach((gen, index) => {
    rowY.set(gen, index * V_ROW_GAP)
  })

  // Compute canvas width per row and total
  const rowWidths = new Map<number, number>()
  Array.from(sortedByGeneration.entries()).forEach(([gen, ids]) => {
    const { width } = cardDimensions(gen)
    rowWidths.set(gen, ids.length * width + Math.max(0, ids.length - 1) * H_GAP)
  })
  const canvasWidth = Math.max(...Array.from(rowWidths.values()), PARENT_WIDTH)

  // Build person lookup
  const peopleById = new Map(people.map((p) => [p.id, p]))

  // Build nodes
  const nodes: Node[] = []
  const personPositions = new Map<string, { x: number; y: number; width: number; height: number }>()

  Array.from(sortedByGeneration.entries()).forEach(([gen, ids]) => {
    const { width, height } = cardDimensions(gen)
    const rowWidth = ids.length * width + Math.max(0, ids.length - 1) * H_GAP
    const rowStartX = (canvasWidth - rowWidth) / 2
    const y = rowY.get(gen) ?? 0

    ids.forEach((personId: string, index: number) => {
      const person = peopleById.get(personId)
      if (!person) return

      const x = rowStartX + index * (width + H_GAP)
      personPositions.set(personId, { x, y, width, height })

      const level = levelFromGen(gen)
      const isSelf = personId === rootPersonId

      const layoutPerson: TreeLayoutPerson = {
        id: person.id,
        name: buildDisplayName(person),
        role: isSelf ? 'Self' : 'Family Member',
        avatar: person.avatarUrl ?? '',
        birthDate: person.birthDate,
        deathDate: person.deathDate,
        memories: person.counts?.stories ?? 0,
        selected: isSelf,
        width,
        height,
      }

      const nodeData: PersonNodeData = {
        person: layoutPerson,
        level,
        isSelf,
        isMobile: callbacks.isMobile,
        onPersonClick: callbacks.onPersonClick,
        onAddPerson: callbacks.onAddPerson,
        onViewArchive: callbacks.onViewArchive,
        onSetRoot: callbacks.onSetRoot,
      }

      nodes.push({
        id: personId,
        type: 'personNode',
        position: { x, y },
        data: nodeData as unknown as Record<string, unknown>,
        draggable: false,
        style: { width, height, pointerEvents: 'all' },
      })
    })
  })

  // Build family units and junction nodes
  const familyUnits = buildFamilyUnits(parentsByChild)
  const edges: Edge[] = []

  // Collect spouse pairs that participate in a family unit (to avoid duplicate spouse edges)
  const unitParentPairs = new Set<string>()
  for (const unit of familyUnits) {
    for (let i = 0; i < unit.parentIds.length; i++) {
      for (let j = i + 1; j < unit.parentIds.length; j++) {
        const [a, b] = [unit.parentIds[i], unit.parentIds[j]].sort()
        unitParentPairs.add(`${a}::${b}`)
      }
    }
  }

  for (const unit of familyUnits) {
    const parentPositions = unit.parentIds
      .map((id) => personPositions.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p)

    const childPositionsArr = unit.childIds
      .map((id) => personPositions.get(id))
      .filter((p): p is NonNullable<typeof p> => !!p)

    if (parentPositions.length === 0 || childPositionsArr.length === 0) continue

    // Family junction position
    const junctionX =
      parentPositions.reduce((s, p) => s + p.x + p.width / 2, 0) / parentPositions.length
    const parentTopY = Math.min(...parentPositions.map((p) => p.y))
    const childBottomY = Math.max(...childPositionsArr.map((p) => p.y + p.height))
    const junctionY = (parentTopY + childBottomY) / 2

    const junctionId = `family::${unit.key}`
    nodes.push({
      id: junctionId,
      type: 'familyNode',
      position: { x: junctionX, y: junctionY },
      data: {},
      draggable: false,
      style: { width: FAMILY_NODE_SIZE, height: FAMILY_NODE_SIZE },
    })

    // Parent → junction edges
    for (const parentId of unit.parentIds) {
      edges.push({
        id: `edge-parent-${parentId}-${junctionId}`,
        source: parentId,
        target: junctionId,
        sourceHandle: 'top',
        targetHandle: 'bottom',
        type: 'smoothstep',
        style: { stroke: BIO_COLOR, strokeWidth: CONNECTOR_WIDTH },
        animated: false,
      })
    }

    // Junction → child edges
    for (const childId of unit.childIds) {
      // Determine biological status: look at edges from any parent to this child
      let isBiological = true
      for (const parentId of unit.parentIds) {
        const parent = peopleById.get(parentId)
        if (!parent) continue
        const edge = parent.relationshipEdges.find(
          (e) =>
            e.relatedPerson.id === childId &&
            (e.type === 'CHILD' || (e.type === 'PARENT' && e.direction === 'outgoing')),
        )
        if (edge) {
          isBiological = edge.isBiological
          break
        }
        // Also check from child perspective
        const child = peopleById.get(childId)
        if (child) {
          const childEdge = child.relationshipEdges.find(
            (e) =>
              e.relatedPerson.id === parentId &&
              (e.type === 'PARENT' || (e.type === 'CHILD' && e.direction === 'incoming')),
          )
          if (childEdge) {
            isBiological = childEdge.isBiological
            break
          }
        }
      }

      const edgeColor = isBiological ? BIO_COLOR : NON_BIO_COLOR
      edges.push({
        id: `edge-family-${junctionId}-${childId}`,
        source: junctionId,
        target: childId,
        sourceHandle: 'top',
        targetHandle: 'bottom',
        type: 'smoothstep',
        style: {
          stroke: edgeColor,
          strokeWidth: CONNECTOR_WIDTH,
          strokeDasharray: isBiological ? undefined : '6 4',
        },
        animated: false,
      })
    }
  }

  // ─── Step 5: Pagination Stubs ───────────────────────────────────────────────
  
  for (const person of people) {
    const pos = personPositions.get(person.id)
    if (!pos) continue

    let hasMissingParent = false
    let hasMissingChild = false

    const gen = generationById.get(person.id) ?? 0

    for (const edge of person.relationshipEdges) {
      if (peopleById.has(edge.relatedPerson.id)) continue

      const isParentEdge = (edge.type === 'PARENT' && edge.direction === 'incoming') || (edge.type === 'CHILD' && edge.direction === 'incoming')
      const isChildEdge = (edge.type === 'CHILD' && edge.direction === 'outgoing') || (edge.type === 'PARENT' && edge.direction === 'outgoing')

      if (isParentEdge && gen >= 0) hasMissingParent = true
      if (isChildEdge && gen <= 0) hasMissingChild = true
    }

    if (hasMissingParent) {
      const stubId = `stub-up-${person.id}`
      const stubX = pos.x + pos.width / 2 - STUB_WIDTH / 2
      const stubY = pos.y + pos.height + STUB_GAP

      nodes.push({
        id: stubId,
        type: 'stubNode',
        position: { x: stubX, y: stubY },
        data: {
          targetId: person.id,
          direction: 'up',
          onSetRoot: callbacks.onSetRoot,
          onLoadMore: callbacks.onLoadMore,
        } as unknown as Record<string, unknown>,
        draggable: false,
        style: { width: STUB_WIDTH, height: STUB_HEIGHT, pointerEvents: 'all' },
      })

      edges.push({
        id: `edge-${stubId}`,
        source: person.id,
        target: stubId,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'straight',
        style: { stroke: STUB_EDGE_COLOR, strokeWidth: STUB_EDGE_WIDTH, strokeDasharray: '4 4' },
        animated: false,
      })
    }

    if (hasMissingChild) {
      const stubId = `stub-down-${person.id}`
      const stubX = pos.x + pos.width / 2 - STUB_WIDTH / 2
      const stubY = pos.y - STUB_GAP - STUB_HEIGHT

      nodes.push({
        id: stubId,
        type: 'stubNode',
        position: { x: stubX, y: stubY },
        data: {
          targetId: person.id,
          direction: 'down',
          onSetRoot: callbacks.onSetRoot,
          onLoadMore: callbacks.onLoadMore,
        } as unknown as Record<string, unknown>,
        draggable: false,
        style: { width: STUB_WIDTH, height: STUB_HEIGHT, pointerEvents: 'all' },
      })

      edges.push({
        id: `edge-${stubId}`,
        source: stubId,
        target: person.id,
        sourceHandle: 'bottom',
        targetHandle: 'top',
        type: 'straight',
        style: { stroke: STUB_EDGE_COLOR, strokeWidth: STUB_EDGE_WIDTH, strokeDasharray: '4 4' },
        animated: false,
      })
    }
  }

  // Spouse edges (only for pairs NOT already connected via a family unit)
  const seenSpousePairs = new Set<string>()
  for (const person of people) {
    for (const edge of person.relationshipEdges) {
      if (edge.type !== 'SPOUSE') continue

      const [a, b] = [person.id, edge.relatedPerson.id].sort()
      const pairKey = `${a}::${b}`
      if (seenSpousePairs.has(pairKey)) continue
      seenSpousePairs.add(pairKey)

      // Skip if these two co-parents are already represented by a family unit junction
      if (unitParentPairs.has(pairKey)) continue

      const posA = personPositions.get(a)
      const posB = personPositions.get(b)
      if (!posA || !posB) continue

      // Determine left/right for handles
      const leftId = posA.x <= posB.x ? a : b
      const rightId = posA.x <= posB.x ? b : a

      edges.push({
        id: `edge-spouse-${pairKey}`,
        source: leftId,
        target: rightId,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'straight',
        style: { stroke: SPOUSE_COLOR, strokeWidth: CONNECTOR_WIDTH },
        animated: false,
      })
    }
  }

  return { nodes, edges }
}
