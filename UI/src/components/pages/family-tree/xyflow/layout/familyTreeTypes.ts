export type FamilyTreeViewMode = 'full' | 'focused' | 'ancestors' | 'descendants' | 'immediate-family'

export type RelationshipHighlightType =
  | 'selected'
  | 'parent'
  | 'spouse'
  | 'child'
  | 'sibling'
  | 'ancestor'
  | 'descendant'
  | 'related'
  | 'unrelated'

export interface PersonNodeModel {
  id: string
  displayName: string
  firstName?: string
  lastName?: string
  spouseIds: string[]
  parentFamilyIds: string[]
  childFamilyIds: string[]
}

export interface FamilyUnitNodeModel {
  id: string
  spouseIds: string[]
  childIds: string[]
}

export interface NormalizedFamilyGraph {
  people: PersonNodeModel[]
  familyUnits: FamilyUnitNodeModel[]
  personById: Map<string, PersonNodeModel>
  familyById: Map<string, FamilyUnitNodeModel>
  parentsByPersonId: Map<string, Set<string>>
  childrenByPersonId: Map<string, Set<string>>
  spousesByPersonId: Map<string, Set<string>>
}
