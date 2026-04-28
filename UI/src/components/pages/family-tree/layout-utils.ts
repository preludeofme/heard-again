import { FamilyTreeData, TreePerson, TreeNodeLevel, CardPosition, ConnectorPath, FamilyTreeRelationshipEdge } from './types'

export const CONNECTOR_COLOR = 'rgba(22, 51, 74, 0.42)'
export const CONNECTOR_SPOUSE_COLOR = 'rgba(22, 51, 74, 0.34)'
export const CONNECTOR_BIOLOGICAL_COLOR = 'rgba(22, 51, 74, 0.52)'
export const CONNECTOR_NON_BIO_COLOR = 'rgba(22, 51, 74, 0.35)'
export const CONNECTOR_THICKNESS = 3

export const GRANDPARENT_CARD_WIDTH = 256
export const GRANDPARENT_GAP = 64
export const PARENT_CARD_WIDTH = 288
export const PARENT_GAP = 48
export const CHILD_CARD_WIDTH = 240
export const CHILD_GAP = 64

export const GRANDPARENT_CARD_HEIGHT = 100
export const PARENT_CARD_HEIGHT = 290
export const CHILD_CARD_HEIGHT = 85

export const getGenerationWidth = (count: number, cardWidth: number, gap: number) => {
  if (count <= 0) return 0
  return count * cardWidth + (count - 1) * gap
}

export function calculateCardPositions(
  familyData: FamilyTreeData,
  isMobile: boolean,
  treeCanvasWidth: number
): CardPosition[] {
  const cardW = {
    grandparent: isMobile ? 140 : GRANDPARENT_CARD_WIDTH,
    parent: isMobile ? 160 : PARENT_CARD_WIDTH,
    child: isMobile ? 130 : CHILD_CARD_WIDTH,
  }
  const cardGap = {
    grandparent: isMobile ? 16 : GRANDPARENT_GAP,
    parent: isMobile ? 16 : PARENT_GAP,
    child: isMobile ? 16 : CHILD_GAP,
  }
  const cardH = {
    grandparent: isMobile ? 60 : GRANDPARENT_CARD_HEIGHT,
    parent: isMobile ? 80 : PARENT_CARD_HEIGHT,
    child: isMobile ? 56 : CHILD_CARD_HEIGHT,
  }

  const GRANDPARENT_ROW_Y = 20
  const PARENT_ROW_Y = isMobile ? 160 : 260
  const CHILD_ROW_Y = isMobile ? 300 : 630

  const buildRow = (
    generationPeople: TreePerson[],
    level: TreeNodeLevel,
    rowY: number,
    cardWidth: number,
    gap: number,
    cardHeight: number
  ): CardPosition[] => {
    const rowWidth = getGenerationWidth(generationPeople.length, cardWidth, gap)
    const rowStartX = (treeCanvasWidth - rowWidth) / 2

    return generationPeople.map((person, index) => ({
      id: String(person.id),
      person,
      level,
      x: rowStartX + index * (cardWidth + gap),
      y: rowY,
      width: cardWidth,
      estimatedHeight: cardHeight,
    }))
  }

  return [
    ...buildRow(familyData.grandparents, 'grandparent', GRANDPARENT_ROW_Y, cardW.grandparent, cardGap.grandparent, cardH.grandparent),
    ...buildRow(familyData.parents, 'parent', PARENT_ROW_Y, cardW.parent, cardGap.parent, cardH.parent),
    ...buildRow(familyData.children, 'child', CHILD_ROW_Y, cardW.child, cardGap.child, cardH.child),
  ]
}

export function calculateConnectorPaths(
  familyData: FamilyTreeData,
  cardPositions: CardPosition[]
): ConnectorPath[] {
  const paths: ConnectorPath[] = []
  const cardById = new Map(cardPositions.map((c) => [c.id, c]))

  const getConnectorStyle = (kind: FamilyTreeRelationshipEdge['relationshipKind']) => {
    if (kind === 'biological') {
      return { stroke: CONNECTOR_BIOLOGICAL_COLOR, strokeWidth: CONNECTOR_THICKNESS }
    }
    return { stroke: CONNECTOR_NON_BIO_COLOR, strokeWidth: CONNECTOR_THICKNESS, strokeDasharray: '6 4' }
  }

  // Spouse connectors
  const spouseEdges = familyData.relationshipEdges.filter((e) => e.type === 'SPOUSE')
  for (const edge of spouseEdges) {
    const a = cardById.get(edge.sourceId)
    const b = cardById.get(edge.targetId)
    if (!a || !b) continue

    const left = a.x < b.x ? a : b
    const right = a.x < b.x ? b : a
    const midY = left.y + left.estimatedHeight / 2
    const x1 = left.x + left.width
    const x2 = right.x

    paths.push({
      id: edge.id,
      d: `M ${x1} ${midY} L ${x2} ${midY}`,
      stroke: CONNECTOR_SPOUSE_COLOR,
      strokeWidth: CONNECTOR_THICKNESS,
    })
  }

  // Parent-child connectors
  const parentChildEdges = familyData.relationshipEdges
    .filter((e) => e.type === 'PARENT_CHILD')
    .filter((e) => cardById.has(e.sourceId) && cardById.has(e.targetId))

  const parentToChildren = new Map<string, Set<string>>()
  const childToParents = new Map<string, Set<string>>()
  const edgeKind = new Map<string, FamilyTreeRelationshipEdge['relationshipKind']>()

  for (const edge of parentChildEdges) {
    if (!parentToChildren.has(edge.sourceId)) parentToChildren.set(edge.sourceId, new Set())
    parentToChildren.get(edge.sourceId)!.add(edge.targetId)

    if (!childToParents.has(edge.targetId)) childToParents.set(edge.targetId, new Set())
    childToParents.get(edge.targetId)!.add(edge.sourceId)

    edgeKind.set(`${edge.sourceId}:${edge.targetId}`, edge.relationshipKind)
  }

  const spouseSet = new Set<string>()
  for (const edge of spouseEdges) {
    spouseSet.add(`${edge.sourceId}:${edge.targetId}`)
    spouseSet.add(`${edge.targetId}:${edge.sourceId}`)
  }

  const processedParents = new Set<string>()
  const familyUnits: { parentIds: string[]; childIds: string[]; isBiological: boolean }[] = []

  for (const parentId of Array.from(parentToChildren.keys())) {
    if (processedParents.has(parentId)) continue
    processedParents.add(parentId)

    const children = parentToChildren.get(parentId)!
    const unitParents = [parentId]

    for (const otherId of Array.from(parentToChildren.keys())) {
      if (otherId === parentId || processedParents.has(otherId)) continue
      const isSpouse = spouseSet.has(`${parentId}:${otherId}`)
      const otherChildren = parentToChildren.get(otherId)!
      const sharedChildren = Array.from(children).filter((c) => otherChildren.has(c))
      if (isSpouse || sharedChildren.length > 0) {
        unitParents.push(otherId)
        processedParents.add(otherId)
        Array.from(otherChildren).forEach((c) => children.add(c))
      }
    }

    let bioCount = 0
    let totalCount = 0
    for (const pid of unitParents) {
      for (const cid of Array.from(children)) {
        const kind = edgeKind.get(`${pid}:${cid}`)
        if (kind) {
          totalCount++
          if (kind === 'biological') bioCount++
        }
      }
    }

    familyUnits.push({
      parentIds: unitParents,
      childIds: Array.from(children),
      isBiological: totalCount > 0 ? (bioCount >= totalCount / 2) : true,
    })
  }

  for (const unit of familyUnits) {
    const parentCards = unit.parentIds.map((id) => cardById.get(id)).filter(Boolean) as CardPosition[]
    const childCards = unit.childIds.map((id) => cardById.get(id)).filter(Boolean) as CardPosition[]

    if (parentCards.length === 0 || childCards.length === 0) continue

    const style = getConnectorStyle(unit.isBiological ? 'biological' : 'nonBiological')

    const allParentCentersX = parentCards.map((c) => c.x + c.width / 2)
    const anchorX = allParentCentersX.reduce((s, x) => s + x, 0) / allParentCentersX.length
    const anchorY = Math.max(...parentCards.map((c) => c.y + c.estimatedHeight))

    const childAnchors = childCards
      .map((c) => ({ x: c.x + c.width / 2, y: c.y }))
      .sort((a, b) => a.x - b.x)

    const childTopY = Math.min(...childAnchors.map((a) => a.y))
    const busY = Math.round((anchorY + childTopY) / 2)

    paths.push({
      id: `stem-down-${unit.parentIds.join('-')}`,
      d: `M ${anchorX} ${anchorY} L ${anchorX} ${busY}`,
      ...style,
    })

    if (childAnchors.length === 1) {
      paths.push({
        id: `stem-child-${unit.childIds[0]}`,
        d: `M ${anchorX} ${busY} L ${childAnchors[0].x} ${busY} L ${childAnchors[0].x} ${childAnchors[0].y}`,
        ...style,
      })
    } else {
      const leftX = Math.min(...childAnchors.map((a) => a.x))
      const rightX = Math.max(...childAnchors.map((a) => a.x))

      paths.push({
        id: `bus-${unit.parentIds.join('-')}`,
        d: `M ${leftX} ${busY} L ${rightX} ${busY}`,
        ...style,
      })

      for (const child of childAnchors) {
        const childId = childCards.find((c) => Math.abs(c.x + c.width / 2 - child.x) < 1)?.id || 'unknown'
        const childKind = unit.parentIds
          .map((pid) => edgeKind.get(`${pid}:${childId}`))
          .find((k) => k !== undefined) || (unit.isBiological ? 'biological' : 'nonBiological')
        const childStyle = getConnectorStyle(childKind)

        paths.push({
          id: `stem-child-${childId}`,
          d: `M ${child.x} ${busY} L ${child.x} ${child.y}`,
          ...childStyle,
        })
      }
    }

    if (parentCards.length > 1) {
      for (const pc of parentCards) {
        const pcCenterX = pc.x + pc.width / 2
        const pcBottomY = pc.y + pc.estimatedHeight
        if (Math.abs(pcCenterX - anchorX) > 2) {
          paths.push({
            id: `stem-parent-${pc.id}`,
            d: `M ${pcCenterX} ${pcBottomY} L ${pcCenterX} ${anchorY} L ${anchorX} ${anchorY}`,
            ...style,
          })
        }
      }
    }
  }

  return paths
}
