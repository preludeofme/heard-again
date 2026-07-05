import { buildFamilyTreeLayout } from '../layout'

const callbacks = {
  onPersonClick: () => {},
  onAddPerson: () => {},
  onViewMemories: () => {},
  isMobile: false,
}

describe('buildFamilyTreeLayout scope regression', () => {
  test('does not throw ReferenceError for selectedPersonId', () => {
    const people: any[] = [
      { id: 'p1', firstName: 'A', lastName: '', displayName: 'A', relationshipEdges: [ { type:'SPOUSE', direction:'outgoing', isBiological:true, relatedPerson:{id:'p2'} } ] },
      { id: 'p2', firstName: 'B', lastName: '', displayName: 'B', relationshipEdges: [ { type:'SPOUSE', direction:'outgoing', isBiological:true, relatedPerson:{id:'p1'} } ] },
    ]

    expect(() => buildFamilyTreeLayout(people as any, 'p1', callbacks as any, 'p1', null)).not.toThrow()
  })

  test('does not throw for layoutMode: pedigree', () => {
    const people: any[] = [
      { id: 'p1', firstName: 'A', lastName: '', displayName: 'A', relationshipEdges: [ { type:'SPOUSE', direction:'outgoing', isBiological:true, relatedPerson:{id:'p2'} } ] },
      { id: 'p2', firstName: 'B', lastName: '', displayName: 'B', relationshipEdges: [ { type:'SPOUSE', direction:'outgoing', isBiological:true, relatedPerson:{id:'p1'} } ] },
    ]

    expect(() => buildFamilyTreeLayout(people as any, 'p1', callbacks as any, 'p1', null, 'pedigree')).not.toThrow()
  })
})
