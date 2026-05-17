import { buildFamilyGraph } from '../layout/buildFamilyGraph'
import { getAncestors, getChildren, getDescendants, getParents, getSiblings, getSpouses } from '../utils/familyTreeTraversal'
import { getRelationshipHighlightMap } from '../utils/relationshipHighlighting'

const people: any[] = [
  { id: 'p1', firstName: 'A', lastName: '', displayName: 'A', relationshipEdges: [ { type:'SPOUSE', direction:'outgoing', relatedPerson:{id:'p2'} }, { type:'CHILD', direction:'outgoing', relatedPerson:{id:'p3'} } ] },
  { id: 'p2', firstName: 'B', lastName: '', displayName: 'B', relationshipEdges: [ { type:'SPOUSE', direction:'outgoing', relatedPerson:{id:'p1'} }, { type:'CHILD', direction:'outgoing', relatedPerson:{id:'p3'} } ] },
  { id: 'p3', firstName: 'C', lastName: '', displayName: 'C', relationshipEdges: [ { type:'PARENT', direction:'incoming', relatedPerson:{id:'p1'} }, { type:'PARENT', direction:'incoming', relatedPerson:{id:'p2'} }, { type:'CHILD', direction:'outgoing', relatedPerson:{id:'p4'} } ] },
  { id: 'p4', firstName: 'D', lastName: '', displayName: 'D', relationshipEdges: [ { type:'PARENT', direction:'incoming', relatedPerson:{id:'p3'} } ] },
]

describe('family traversal utilities', () => {
  const g = buildFamilyGraph(people as any)
  test('parents/children/spouses/siblings', () => {
    expect(getParents(g, 'p3').sort()).toEqual(['p1', 'p2'])
    expect(getChildren(g, 'p3')).toEqual(['p4'])
    expect(getSpouses(g, 'p1')).toEqual(['p2'])
    expect(getSiblings(g, 'p3')).toEqual([])
  })

  test('ancestors/descendants/highlight map', () => {
    expect(Array.from(getAncestors(g, 'p4', 3)).sort()).toEqual(['p1', 'p2', 'p3'])
    expect(Array.from(getDescendants(g, 'p1', 3)).sort()).toEqual(['p3', 'p4'])
    const highlight = getRelationshipHighlightMap(g, 'p3', 3)
    expect(highlight.get('p3')).toBe('selected')
    expect(highlight.get('p1')).toBe('parent')
    expect(highlight.get('p4')).toBe('child')
  })
})
