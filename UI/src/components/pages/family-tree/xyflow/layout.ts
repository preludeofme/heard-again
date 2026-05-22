import type { Node, Edge } from '@xyflow/react'
import type { TreePerson } from '../types'
import type { ApiPersonWithEdges, TreeLayoutPerson, PersonNodeData, TreeNodeLevel } from './types'
import { getRelationshipDescriptor } from '@/lib/relationship-utils'
import { buildFamilyGraph } from './layout/buildFamilyGraph'
import { getRelationshipHighlightMap } from './utils/relationshipHighlighting'

// ─── Layout constants ────────────────────────────────────────────────────────

const COMPACT_WIDTH = 220
const COMPACT_HEIGHT = 300

const PARENT_WIDTH = COMPACT_WIDTH
const STUB_WIDTH = 160
const STUB_HEIGHT = 40
const STUB_GAP = 48
const STUB_EDGE_COLOR = 'rgba(22, 51, 74, 0.28)'
const STUB_EDGE_WIDTH = 2
const PARENT_HEIGHT = COMPACT_HEIGHT
const GRANDPARENT_WIDTH = COMPACT_WIDTH
const GRANDPARENT_HEIGHT = COMPACT_HEIGHT
const CHILD_WIDTH = COMPACT_WIDTH
const CHILD_HEIGHT = COMPACT_HEIGHT
const H_GAP = 120
const V_ROW_GAP = 460
const FAMILY_NODE_SIZE = 1

// Connector colours
const SPOUSE_COLOR = 'rgba(22, 51, 74, 0.34)'
const BIO_COLOR = 'rgba(22, 51, 74, 0.52)'
const NON_BIO_COLOR = 'rgba(168, 85, 52, 0.52)' // More brownish/distinct
const CONNECTOR_WIDTH = 3

const FAMILY_COLORS = [
  '#16334a', // Dark blue (primary)
  '#1a6b5a', // Teal
  '#7d5a50', // Brown
  '#5a1a6b', // Purple
  '#6b5a1a', // Olive
  '#1a3a6b', // Blue
  '#6b1a3a', // Maroon
  '#3a6b1a', // Forest
]

function getFamilyColor(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash)
  }
  const index = Math.abs(hash) % FAMILY_COLORS.length
  return FAMILY_COLORS[index]
}

function getFamilyYOffset(key: string): number {
  let hash = 0
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash)
  }
  // Return an offset between -30 and 30
  return (Math.abs(hash) % 61) - 30
}

// ─── Types local to layout ────────────────────────────────────────────────────

interface FamilyUnit {
  key: string
  parentIds: string[]
  childIds: string[]
}

interface LayoutCallbacks {
  onPersonClick: (person: TreeLayoutPerson) => void
  onAddPerson: (personId?: string) => void
  onViewMemories: (person: TreeLayoutPerson) => void
  onViewFullProfile?: (personId: string) => void
  onSetRoot?: (id: string) => void
  onLoadMore?: (direction: 'up' | 'down' | 'left' | 'right', personId: string) => void
  onEditRelationships?: (personId: string) => void
  isMobile: boolean
}

// ─── Step 1: Build relationship maps ─────────────────────────────────────────

function buildRelationshipMaps(people: ApiPersonWithEdges[]) {
  const childrenByParent = new Map<string, Set<string>>()
  const parentsByChild = new Map<string, Set<string>>()
  const spousesByPerson = new Map<string, Set<string>>()
  const siblingsByPerson = new Map<string, Set<string>>()

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

      if (edge.type === 'SIBLING') {
        if (!siblingsByPerson.has(person.id)) siblingsByPerson.set(person.id, new Set())
        siblingsByPerson.get(person.id)!.add(relId)

        if (!siblingsByPerson.has(relId)) siblingsByPerson.set(relId, new Set())
        siblingsByPerson.get(relId)!.add(person.id)
      }
    }
  }

  // Treat co-parents as spouses for layout even if no explicit spouse edge
  parentsByChild.forEach((parents) => {
    const parentIds = Array.from(parents)
    for (let i = 0; i < parentIds.length; i++) {
      for (let j = i + 1; j < parentIds.length; j++) {
        const pA = parentIds[i]
        const pB = parentIds[j]
        if (!spousesByPerson.has(pA)) spousesByPerson.set(pA, new Set())
        spousesByPerson.get(pA)!.add(pB)
        if (!spousesByPerson.has(pB)) spousesByPerson.set(pB, new Set())
        spousesByPerson.get(pB)!.add(pA)
      }
    }
  })

  // Treat shared parents as siblings
  parentsByChild.forEach((parents, childA) => {
    parents.forEach(parentId => {
      const children = childrenByParent.get(parentId)
      if (children) {
        children.forEach(childB => {
          if (childA !== childB) {
            if (!siblingsByPerson.has(childA)) siblingsByPerson.set(childA, new Set())
            siblingsByPerson.get(childA)!.add(childB)
            
            if (!siblingsByPerson.has(childB)) siblingsByPerson.set(childB, new Set())
            siblingsByPerson.get(childB)!.add(childA)
          }
        })
      }
    })
  })

  return { childrenByParent, parentsByChild, spousesByPerson, siblingsByPerson }
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
        delta = 1
      } else if (edge.type === 'CHILD') {
        delta = -1
      }

      const candidate = currentGen + delta
      const existing = generationById.get(relId)

      if (existing === undefined) {
        generationById.set(relId, candidate)
        queue.push(relId)
      }
    }
  }

  // Assign unvisited people generation 0
  for (const person of people) {
    if (!generationById.has(person.id)) generationById.set(person.id, 0)
  }

  // If >80% of people ended up at gen 0, the root likely had no traversable edges.
  // Re-run BFS from the person with the most PARENT+CHILD connections.
  const gen0Count = Array.from(generationById.values()).filter(g => g === 0).length
  if (people.length > 1 && gen0Count / people.length > 0.8) {
    let bestId = rootPersonId
    let bestCount = -1
    for (const person of people) {
      const count = person.relationshipEdges.filter(
        e => e.type === 'PARENT' || e.type === 'CHILD'
      ).length
      if (count > bestCount) {
        bestCount = count
        bestId = person.id
      }
    }
    if (bestId !== rootPersonId) {
      const retried = new Map<string, number>([[bestId, 0]])
      const retryQueue: string[] = [bestId]
      while (retryQueue.length > 0) {
        const currentId = retryQueue.shift()!
        const currentGen = retried.get(currentId)!
        const current = peopleById.get(currentId)
        if (!current) continue
        for (const edge of current.relationshipEdges) {
          const relId = edge.relatedPerson.id
          if (!peopleById.has(relId) || retried.has(relId)) continue
          let delta = 0
          if (edge.type === 'PARENT') delta = 1
          else if (edge.type === 'CHILD') delta = -1
          retried.set(relId, currentGen + delta)
          retryQueue.push(relId)
        }
      }
      for (const person of people) {
        if (!retried.has(person.id)) retried.set(person.id, 0)
      }
      return retried
    }
  }

  return generationById
}

// ─── Step 3: Sort generation rows (spouses adjacent) ─────────────────────────

function sortGenerationRow(
  ids: string[],
  spousesByPerson: Map<string, Set<string>>,
  siblingsByPerson: Map<string, Set<string>>,
  ranks?: Map<string, number>,
): string[] {
  // Sort initial IDs by rank then by ID for determinism
  const sortedIds = [...ids].sort((a, b) => {
    if (ranks) {
      const rA = ranks.get(a) ?? Infinity
      const rB = ranks.get(b) ?? Infinity
      if (rA !== rB) return rA - rB
    }
    return a.localeCompare(b)
  })

  const remaining = new Set(sortedIds)
  const ordered: string[] = []

  while (remaining.size > 0) {
    const seed = Array.from(remaining)[0]!
    const queue = [seed]
    const cluster = new Set<string>()

    while (queue.length > 0) {
      const current = queue.shift()!
      if (!remaining.has(current)) continue
      
      const isFirstInCluster = cluster.size === 0
      remaining.delete(current)
      cluster.add(current)

      // Always enqueue spouses first so they stay adjacent to the person
      const spouses = spousesByPerson.get(current)
      const spousesToInsert: string[] = []
      if (spouses) {
        Array.from(spouses).sort((a,b) => a.localeCompare(b)).forEach(spouseId => {
          if (remaining.has(spouseId)) {
            remaining.delete(spouseId)
            cluster.add(spouseId)
            spousesToInsert.push(spouseId)
            queue.push(spouseId)
          }
        })
      }

      // To keep siblings visually adjacent, we place the spouses of the first sibling
      // on the LEFT (before them), and all subsequent spouses on the RIGHT (after them).
      if (isFirstInCluster) {
        ordered.push(...spousesToInsert, current)
      } else {
        ordered.push(current, ...spousesToInsert)
      }

      // Then enqueue siblings
      const siblings = siblingsByPerson.get(current)
      if (siblings) {
        const inQueue = new Set(queue)
        Array.from(siblings).sort((a,b) => a.localeCompare(b)).forEach(siblingId => {
          if (remaining.has(siblingId) && !inQueue.has(siblingId)) {
            queue.push(siblingId)
            inQueue.add(siblingId)
          }
        })
      }
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

// ─── Helper: resolve overlaps in a row (left-to-right sweep) ─────────────────

function resolveOverlaps(
  sortedIds: string[],
  desiredX: Map<string, number>,
  nodeWidth: number,
  gap: number,
): Map<string, number> {
  const result = new Map<string, number>()
  for (let i = 0; i < sortedIds.length; i++) {
    const id = sortedIds[i]
    let x = desiredX.get(id) ?? 0
    if (i > 0) {
      const prevX = result.get(sortedIds[i - 1])!
      x = Math.max(x, prevX + nodeWidth + gap)
    }
    result.set(id, x)
  }
  return result
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
  selectedPersonId: string | null = null,
  userPersonId: string | null = null,
): LayoutResult {
  if (people.length === 0) return { nodes: [], edges: [] }

  const peopleById = new Map(people.map((p) => [p.id, p]))
  const normalizedGraph = buildFamilyGraph(people)
  const highlightById = getRelationshipHighlightMap(normalizedGraph, selectedPersonId)
  const { childrenByParent, parentsByChild, spousesByPerson, siblingsByPerson } = buildRelationshipMaps(people)
  const generationById = assignGenerations(people, rootPersonId)

  // Group people by generation
  const byGeneration = new Map<number, string[]>()
  for (const person of people) {
    const gen = generationById.get(person.id) ?? 0
    if (!byGeneration.has(gen)) byGeneration.set(gen, [])
    byGeneration.get(gen)!.push(person.id)
  }

  // Assign Y positions: newest generation at top
  const sortedGens = Array.from(byGeneration.keys()).sort((a, b) => a - b)
  const rowY = new Map<number, number>()
  sortedGens.forEach((gen, index) => {
    rowY.set(gen, index * V_ROW_GAP)
  })

  const personPositions = new Map<string, { x: number; y: number; width: number; height: number }>()
  const personRanks = new Map<string, number>()

  // ─── Step 1: Layout Gen 0 (Reference) ───────────────────────────────────────
  {
    const ids = sortGenerationRow(byGeneration.get(0) ?? [], spousesByPerson, siblingsByPerson)
    const { width, height } = cardDimensions(0)
    const y = rowY.get(0) ?? 0
    const totalW = ids.length * width + Math.max(0, ids.length - 1) * H_GAP
    ids.forEach((id, i) => {
      personPositions.set(id, { x: -totalW / 2 + i * (width + H_GAP), y, width, height })
      personRanks.set(id, i)
    })
  }

  // Build family units early — needed for tree-aware position assignment
  const familyUnits = buildFamilyUnits(parentsByChild)

  // ─── Step 2: Layout Ancestors (1, 2, 3...) ──────────────────────────────────
  for (const gen of sortedGens.filter(g => g > 0)) {
    const rawIds = byGeneration.get(gen) ?? []
    // Inherit rank from children in previous gen (gen-1)
    const inheritedRanks = new Map<string, number>()
    rawIds.forEach(id => {
      const children = Array.from(childrenByParent.get(id) ?? [])
      const r = children.length > 0 
        ? children.reduce((s, cid) => s + (personRanks.get(cid) ?? 0), 0) / children.length
        : Infinity
      inheritedRanks.set(id, r)
    })
    
    const ids = sortGenerationRow(rawIds, spousesByPerson, siblingsByPerson, inheritedRanks)
    const { width, height } = cardDimensions(gen)
    const y = rowY.get(gen)!
    const desiredX = new Map<string, number>()
    const xVotes = new Map<string, number[]>()

    const addVote = (id: string, x: number) => {
      if (!xVotes.has(id)) xVotes.set(id, [])
      xVotes.get(id)!.push(x)
    }

    for (const unit of familyUnits) {
      const parentsInGen = unit.parentIds.filter(pid => generationById.get(pid) === gen)
      const childrenBelow = unit.childIds.filter(cid => generationById.get(cid) === gen - 1)
      if (parentsInGen.length === 0 || childrenBelow.length === 0) continue

      const childPos = childrenBelow
        .map(id => personPositions.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p)
      if (childPos.length === 0) continue

      const midX = (Math.min(...childPos.map(p => p.x)) + Math.max(...childPos.map(p => p.x + p.width))) / 2
      const totalW = parentsInGen.length * width + Math.max(0, parentsInGen.length - 1) * H_GAP
      parentsInGen.forEach((pid, i) => addVote(pid, midX - totalW / 2 + i * (width + H_GAP)))
    }

    // Average votes and fallback
    for (const id of ids) {
      const votes = xVotes.get(id)
      if (votes && votes.length > 0) {
        desiredX.set(id, votes.reduce((s, v) => s + v, 0) / votes.length)
      } else {
        // Fallback: center above any visible children
        const childPos = Array.from(childrenByParent.get(id) ?? [])
          .map(cid => personPositions.get(cid))
          .filter((p): p is NonNullable<typeof p> => !!p)
        desiredX.set(id, childPos.length > 0
          ? childPos.reduce((s, p) => s + p.x + p.width / 2, 0) / childPos.length - width / 2
          : 0)
      }
    }

    // --- Group spouses and sort by group-average desiredX ---
    const groups: string[][] = []
    const processed = new Set<string>()
    for (const id of ids) {
      if (processed.has(id)) continue
      const group = [id]
      processed.add(id)
      const spouses = spousesByPerson.get(id)
      if (spouses) {
        for (const sid of spouses) {
          if (ids.includes(sid) && !processed.has(sid)) {
            group.push(sid)
            processed.add(sid)
          }
        }
      }
      groups.push(group)
    }

    const sortedGroups = [...groups].sort((ga, gb) => {
      const avgA = ga.reduce((s, id) => s + (desiredX.get(id) ?? 0), 0) / ga.length
      const avgB = gb.reduce((s, id) => s + (desiredX.get(id) ?? 0), 0) / gb.length
      return avgA - avgB
    })
    const sorted = sortedGroups.flat()

    // Capture desired center before overlap resolution so we can re-center after
    const dxValsAnc = sorted.map(id => desiredX.get(id) ?? 0)
    const desiredCenterAnc = sorted.length > 0
      ? (Math.min(...dxValsAnc) + Math.max(...dxValsAnc) + width) / 2
      : 0

    const resolved = resolveOverlaps(sorted, desiredX, width, H_GAP)

    // resolveOverlaps only shifts right; re-center the row around the desired center
    const resolvedMinAnc = sorted.length > 0 ? (resolved.get(sorted[0]) ?? 0) : 0
    const resolvedMaxAnc = sorted.length > 0 ? (resolved.get(sorted[sorted.length - 1]) ?? 0) + width : 0
    const centerShiftAnc = desiredCenterAnc - (resolvedMinAnc + resolvedMaxAnc) / 2

    sorted.forEach((id, i) => {
      personPositions.set(id, { x: (resolved.get(id) ?? 0) + centerShiftAnc, y, width, height })
      personRanks.set(id, i)
    })
  }

  // ─── Step 3: Layout Descendants (-1, -2...) ─────────────────────────────────
  for (const gen of sortedGens.filter(g => g < 0).sort((a, b) => b - a)) {
    const rawIds = byGeneration.get(gen) ?? []
    // Inherit rank from parents in previous gen (gen+1)
    const inheritedRanks = new Map<string, number>()
    rawIds.forEach(id => {
      const parents = Array.from(parentsByChild.get(id) ?? [])
      const r = parents.length > 0
        ? parents.reduce((s, pid) => s + (personRanks.get(pid) ?? 0), 0) / parents.length
        : Infinity
      inheritedRanks.set(id, r)
    })

    const ids = sortGenerationRow(rawIds, spousesByPerson, siblingsByPerson, inheritedRanks)
    const { width, height } = cardDimensions(gen)
    const y = rowY.get(gen)!
    const desiredX = new Map<string, number>()
    const xVotes = new Map<string, number[]>()

    const addVote = (id: string, x: number) => {
      if (!xVotes.has(id)) xVotes.set(id, [])
      xVotes.get(id)!.push(x)
    }

    for (const unit of familyUnits) {
      const childrenInGen = unit.childIds.filter(cid => generationById.get(cid) === gen)
      const parentsAbove = unit.parentIds.filter(pid => generationById.get(pid) === gen + 1)
      if (childrenInGen.length === 0 || parentsAbove.length === 0) continue

      const parentPos = parentsAbove
        .map(id => personPositions.get(id))
        .filter((p): p is NonNullable<typeof p> => !!p)
      if (parentPos.length === 0) continue

      const midX = (Math.min(...parentPos.map(p => p.x)) + Math.max(...parentPos.map(p => p.x + p.width))) / 2
      const totalW = childrenInGen.length * width + Math.max(0, childrenInGen.length - 1) * H_GAP
      childrenInGen.forEach((cid, i) => addVote(cid, midX - totalW / 2 + i * (width + H_GAP)))
    }

    // Average votes and fallback
    for (const id of ids) {
      const votes = xVotes.get(id)
      if (votes && votes.length > 0) {
        desiredX.set(id, votes.reduce((s, v) => s + v, 0) / votes.length)
      } else {
        // Fallback: center below any visible parents
        const parentPos = Array.from(parentsByChild.get(id) ?? [])
          .map(pid => personPositions.get(pid))
          .filter((p): p is NonNullable<typeof p> => !!p)
        desiredX.set(id, parentPos.length > 0
          ? parentPos.reduce((s, p) => s + p.x + p.width / 2, 0) / parentPos.length - width / 2
          : 0)
      }
    }

    // --- Group spouses and sort by group-average desiredX ---
    const groups: string[][] = []
    const processed = new Set<string>()
    for (const id of ids) {
      if (processed.has(id)) continue
      const group = [id]
      processed.add(id)
      const spouses = spousesByPerson.get(id)
      if (spouses) {
        for (const sid of spouses) {
          if (ids.includes(sid) && !processed.has(sid)) {
            group.push(sid)
            processed.add(sid)
          }
        }
      }
      groups.push(group)
    }

    const sortedGroups = [...groups].sort((ga, gb) => {
      const avgA = ga.reduce((s, id) => s + (desiredX.get(id) ?? 0), 0) / ga.length
      const avgB = gb.reduce((s, id) => s + (desiredX.get(id) ?? 0), 0) / gb.length
      return avgA - avgB
    })
    const sorted = sortedGroups.flat()

    // Capture desired center before overlap resolution so we can re-center after
    const dxValsDesc = sorted.map(id => desiredX.get(id) ?? 0)
    const desiredCenterDesc = sorted.length > 0
      ? (Math.min(...dxValsDesc) + Math.max(...dxValsDesc) + width) / 2
      : 0

    const resolved = resolveOverlaps(sorted, desiredX, width, H_GAP)

    // resolveOverlaps only shifts right; re-center the row around the desired center
    const resolvedMinDesc = sorted.length > 0 ? (resolved.get(sorted[0]) ?? 0) : 0
    const resolvedMaxDesc = sorted.length > 0 ? (resolved.get(sorted[sorted.length - 1]) ?? 0) + width : 0
    const centerShiftDesc = desiredCenterDesc - (resolvedMinDesc + resolvedMaxDesc) / 2

    sorted.forEach((id, i) => {
      personPositions.set(id, { x: (resolved.get(id) ?? 0) + centerShiftDesc, y, width, height })
      personRanks.set(id, i)
    })
  }

  // Shift all positions so minX = 0
  const allMinX = Math.min(...Array.from(personPositions.values()).map(p => p.x))
  if (isFinite(allMinX) && allMinX !== 0) {
    for (const [id, pos] of personPositions) {
      personPositions.set(id, { ...pos, x: pos.x - allMinX })
    }
  }

  // Compute blood-relative set via BFS through parent/child edges only.
  // Everyone reachable from root through PARENT/CHILD connections is a blood relative;
  // anyone whose only path to the tree is via a SPOUSE edge is an in-law.
  const bloodRelativeIds = new Set<string>()
  {
    const bloodQueue: string[] = [rootPersonId]
    bloodRelativeIds.add(rootPersonId)
    while (bloodQueue.length > 0) {
      const currentId = bloodQueue.shift()!
      const current = peopleById.get(currentId)
      if (!current) continue
      for (const edge of current.relationshipEdges) {
        const relId = edge.relatedPerson.id
        if (bloodRelativeIds.has(relId)) continue
        if (!personPositions.has(relId)) continue // not in visible tree
        if (edge.type === 'PARENT' || edge.type === 'CHILD' || edge.type === 'SIBLING') {
          bloodRelativeIds.add(relId)
          bloodQueue.push(relId)
        }
      }
    }
  }

  // Build nodes
  const nodes: Node[] = []
  for (const [personId, pos] of personPositions) {
    const person = peopleById.get(personId)
    if (!person) continue

    const gen = generationById.get(personId) ?? 0
    const { width, height } = pos
    const level = levelFromGen(gen)
    const isSelf = personId === rootPersonId
    // A person is an in-law when they are not reachable from the root via blood/sibling edges
    const isInLaw = !bloodRelativeIds.has(personId)

    // Calculate missing relative flags
    let missingUp = false
    let missingDown = false
    let missingLeft = false
    let missingRight = false

    for (const edge of person.relationshipEdges) {
      if (peopleById.has(edge.relatedPerson.id)) continue

      const isParentEdge = (edge.type === 'PARENT' && edge.direction === 'incoming') || (edge.type === 'CHILD' && edge.direction === 'incoming')
      const isChildEdge = (edge.type === 'CHILD' && edge.direction === 'outgoing') || (edge.type === 'PARENT' && edge.direction === 'outgoing')
      const isSiblingEdge = (edge.type === 'SIBLING')

      if (isParentEdge && gen >= 0) missingUp = true
      if (isChildEdge && gen <= 0) missingDown = true
      if (isSiblingEdge) {
        // Decide left or right based on some deterministic property, or just use one for now
        // For simplicity, let's put missing siblings on the left
        missingLeft = true
      }
    }

    const layoutPerson: TreeLayoutPerson = {
      id: person.id,
      name: buildDisplayName(person),
      role: isSelf ? 'Self' : 'Family Member',
      avatar: person.avatarUrl ?? '',
      birthDate: person.birthDate,
      deathDate: person.deathDate,
      memories: person.counts?.stories ?? 0,
      selected: isSelf || personId === selectedPersonId,
      width,
      height,
      relationship: getRelationshipDescriptor(personId, userPersonId, people)
    }

    const nodeData: PersonNodeData = {
      person: layoutPerson,
      level,
      isSelf,
      isSelected: personId === selectedPersonId,
      isInLaw,
      levelIndex: gen,
      isMobile: callbacks.isMobile,
      onPersonClick: callbacks.onPersonClick,
      onAddPerson: callbacks.onAddPerson,
      onViewMemories: callbacks.onViewMemories,
      onViewFullProfile: callbacks.onViewFullProfile,
      onSetRoot: callbacks.onSetRoot,
      onEditRelationships: callbacks.onEditRelationships,
      onLoadMore: callbacks.onLoadMore,
      missingUp,
      missingDown,
      missingLeft,
      missingRight,
    }

    nodes.push({
      id: personId,
      type: 'personNode',
      position: { x: pos.x, y: pos.y },
      data: nodeData as unknown as Record<string, unknown>,
      draggable: false,
      style: { width, height, pointerEvents: 'all' },
    })
  }

  // Build junction nodes and edges
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
    
    // Add deterministic Y offset to prevent overlapping horizontal lines
    const baseJunctionY = (parentTopY + childBottomY) / 2
    const junctionY = baseJunctionY + getFamilyYOffset(unit.key)

    const familyColor = getFamilyColor(unit.key)
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
        style: { stroke: familyColor, strokeWidth: CONNECTOR_WIDTH, opacity: 0.7 },
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

      const edgeColor = isBiological ? familyColor : NON_BIO_COLOR
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
          opacity: isBiological ? 0.8 : 0.6
        },
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
