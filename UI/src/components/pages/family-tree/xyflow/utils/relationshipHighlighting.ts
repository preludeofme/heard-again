import type { RelationshipHighlightType, NormalizedFamilyGraph } from '../layout/familyTreeTypes'
import { getAncestors, getChildren, getDescendants, getParents, getSiblings, getSpouses } from './familyTreeTraversal'

export function getRelationshipHighlightMap(g: NormalizedFamilyGraph, selectedPersonId?: string | null, depth = 3) {
  const m = new Map<string, RelationshipHighlightType>()
  if (!selectedPersonId) return m
  m.set(selectedPersonId, 'selected')
  getParents(g, selectedPersonId).forEach((id) => m.set(id, 'parent'))
  getChildren(g, selectedPersonId).forEach((id) => m.set(id, 'child'))
  getSpouses(g, selectedPersonId).forEach((id) => m.set(id, 'spouse'))
  getSiblings(g, selectedPersonId).forEach((id) => m.set(id, 'sibling'))
  getAncestors(g, selectedPersonId, depth).forEach((id) => !m.has(id) && m.set(id, 'ancestor'))
  getDescendants(g, selectedPersonId, depth).forEach((id) => !m.has(id) && m.set(id, 'descendant'))
  g.people.forEach((p) => { if (!m.has(p.id)) m.set(p.id, selectedPersonId ? 'unrelated' : 'related') })
  return m
}
