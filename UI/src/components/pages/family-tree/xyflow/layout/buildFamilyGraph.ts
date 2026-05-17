import type { ApiPersonWithEdges } from '../types'
import type { FamilyUnitNodeModel, NormalizedFamilyGraph, PersonNodeModel } from './familyTreeTypes'

export function buildFamilyGraph(people: ApiPersonWithEdges[]): NormalizedFamilyGraph {
  const parentsByPersonId = new Map<string, Set<string>>()
  const childrenByPersonId = new Map<string, Set<string>>()
  const spousesByPersonId = new Map<string, Set<string>>()

  const ensure = (m: Map<string, Set<string>>, key: string) => {
    if (!m.has(key)) m.set(key, new Set())
    return m.get(key)!
  }

  for (const person of people) {
    for (const edge of person.relationshipEdges) {
      const rid = edge.relatedPerson.id
      if (edge.type === 'SPOUSE') {
        ensure(spousesByPersonId, person.id).add(rid)
      }
      if (edge.type === 'PARENT' && edge.direction === 'incoming') {
        ensure(parentsByPersonId, person.id).add(rid)
        ensure(childrenByPersonId, rid).add(person.id)
      }
      if (edge.type === 'CHILD' && edge.direction === 'outgoing') {
        ensure(childrenByPersonId, person.id).add(rid)
        ensure(parentsByPersonId, rid).add(person.id)
      }
    }
  }

  const unitByKey = new Map<string, FamilyUnitNodeModel>()
  for (const person of people) {
    const parents = Array.from(parentsByPersonId.get(person.id) ?? []).sort()
    const key = parents.length ? `fam:${parents.join('::')}` : `fam:single:${person.id}`
    if (!unitByKey.has(key)) unitByKey.set(key, { id: key, spouseIds: parents, childIds: [] })
    unitByKey.get(key)!.childIds.push(person.id)
  }

  const peopleModels: PersonNodeModel[] = people.map((p) => ({
    id: p.id,
    displayName: p.displayName || [p.firstName, p.lastName].filter(Boolean).join(' '),
    firstName: p.firstName,
    lastName: p.lastName ?? undefined,
    spouseIds: Array.from(spousesByPersonId.get(p.id) ?? []),
    parentFamilyIds: Array.from(unitByKey.values()).filter(u => u.childIds.includes(p.id)).map(u => u.id),
    childFamilyIds: Array.from(unitByKey.values()).filter(u => u.spouseIds.includes(p.id)).map(u => u.id),
  }))

  return {
    people: peopleModels,
    familyUnits: Array.from(unitByKey.values()),
    personById: new Map(peopleModels.map((p) => [p.id, p])),
    familyById: new Map(Array.from(unitByKey.values()).map((f) => [f.id, f])),
    parentsByPersonId,
    childrenByPersonId,
    spousesByPersonId,
  }
}
