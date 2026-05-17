import type { NormalizedFamilyGraph } from '../layout/familyTreeTypes'

export const getParents = (g: NormalizedFamilyGraph, id: string) => Array.from(g.parentsByPersonId.get(id) ?? [])
export const getChildren = (g: NormalizedFamilyGraph, id: string) => Array.from(g.childrenByPersonId.get(id) ?? [])
export const getSpouses = (g: NormalizedFamilyGraph, id: string) => Array.from(g.spousesByPersonId.get(id) ?? [])
export const getSiblings = (g: NormalizedFamilyGraph, id: string) => {
  const out = new Set<string>()
  for (const p of getParents(g, id)) for (const c of getChildren(g, p)) if (c !== id) out.add(c)
  return Array.from(out)
}

function walk(g: NormalizedFamilyGraph, seeds: string[], next: (id: string) => string[], depth: number) {
  const seen = new Set<string>()
  let frontier = [...seeds]
  for (let d = 0; d < depth; d++) {
    const nf: string[] = []
    for (const id of frontier) for (const n of next(id)) if (!seen.has(n)) { seen.add(n); nf.push(n) }
    frontier = nf
  }
  return seen
}

export const getAncestors = (g: NormalizedFamilyGraph, id: string, depth = 3) => walk(g, [id], (x) => getParents(g, x), depth)
export const getDescendants = (g: NormalizedFamilyGraph, id: string, depth = 3) => walk(g, [id], (x) => getChildren(g, x), depth)
