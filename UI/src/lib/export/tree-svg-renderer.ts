import type { Node, Edge } from '@xyflow/react'
import type { PersonNodeData } from '@/components/pages/family-tree/xyflow/types'

// Compact card dimensions kick in above this threshold to keep PNG output manageable.
export const COMPACT_NODE_THRESHOLD = 300

const PADDING = 80
const BG_COLOR = 'rgb(246,243,238)'

const LEVEL_COLORS = ['#16334a', '#445558', '#6d5f44']
const IN_LAW_COLORS = ['#2c3e4a', '#3d4f52', '#5a5048']
const SELF_COLOR = '#1a6b5a'

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0] ?? '')
    .join('')
    .toUpperCase()
}

function wrapText(text: string, maxWidth: number, charPx = 8): string[] {
  const maxChars = Math.floor(maxWidth / charPx)
  if (text.length <= maxChars) return [text]
  const words = text.split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (candidate.length <= maxChars) {
      line = candidate
    } else {
      if (line) lines.push(line)
      line = word
    }
  }
  if (line) lines.push(line)
  return lines.slice(0, 2)
}

function getLifespan(birthDate?: string | null, deathDate?: string | null): string {
  const year = (d?: string | null) => d?.match(/\d{4}/)?.[0] ?? null
  const b = year(birthDate)
  const d = year(deathDate)
  if (b && d) return `${b} – ${d}`
  if (b) return `b. ${b}`
  if (d) return `d. ${d}`
  return ''
}

function renderPersonCard(params: {
  id: string
  x: number
  y: number
  width: number
  height: number
  compact: boolean
  data: PersonNodeData
  avatarDataUrl?: string
}): string {
  const { id, x, y, width, height, compact, data, avatarDataUrl } = params
  const p = data.person

  const colorIdx = ((data.levelIndex % 3) + 3) % 3
  let bg = data.isInLaw ? IN_LAW_COLORS[colorIdx] : LEVEL_COLORS[colorIdx]
  if (data.isSelf) bg = SELF_COLOR

  const borderAttr = data.isInLaw
    ? `stroke="rgba(255,255,255,0.45)" stroke-width="2" stroke-dasharray="6,4"`
    : ''
  const selfRing = data.isSelf
    ? `<rect x="-4" y="-4" width="${width + 8}" height="${height + 8}" rx="20" ry="20" fill="none" stroke="rgba(26,107,90,0.3)" stroke-width="4"/>`
    : ''

  if (compact) {
    // Compact card: avatar circle top, name below, lifespan below that
    const avatarR = 20
    const avatarCx = width / 2
    const avatarCy = avatarR + 12

    const avatarClipId = `ac-${id.replace(/[^a-zA-Z0-9]/g, '_')}`
    const avatarEl = avatarDataUrl
      ? `<clipPath id="${avatarClipId}"><circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}"/></clipPath>
         <image href="${avatarDataUrl}" x="${avatarCx - avatarR}" y="${avatarCy - avatarR}" width="${avatarR * 2}" height="${avatarR * 2}" clip-path="url(#${avatarClipId})"/>`
      : `<text x="${avatarCx}" y="${avatarCy + 6}" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" font-weight="700" fill="rgba(255,255,255,0.85)">${escapeXml(getInitials(p.name))}</text>`

    const lifespan = getLifespan(p.birthDate, p.deathDate)
    const nameLines = wrapText(p.name, width - 12, 6)
    const nameBaseY = avatarCy + avatarR + 14
    const lineH = 14

    const nameText = nameLines
      .map(
        (line, i) =>
          `<text x="${width / 2}" y="${nameBaseY + i * lineH}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="10" font-weight="600" fill="white">${escapeXml(line)}</text>`,
      )
      .join('\n      ')

    const lifespanY = nameBaseY + nameLines.length * lineH + 4
    const lifespanEl = lifespan
      ? `<text x="${width / 2}" y="${lifespanY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="8" fill="rgba(255,255,255,0.80)">${escapeXml(lifespan)}</text>`
      : ''

    const shadow = `<rect x="2" y="3" width="${width}" height="${height}" rx="10" ry="10" fill="rgba(0,0,0,0.10)"/>`

    return `<g transform="translate(${x},${y})">
    ${shadow}
    ${selfRing}
    <rect x="0" y="0" width="${width}" height="${height}" rx="10" ry="10" fill="${bg}" ${borderAttr}/>
    <circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR + 2}" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.35)" stroke-width="1"/>
    ${avatarEl}
    ${nameText}
    ${lifespanEl}
  </g>`
  }

  // Full-size card
  const avatarR = 28
  const avatarCx = width / 2
  const avatarCy = 50

  const avatarClipId = `ac-${id.replace(/[^a-zA-Z0-9]/g, '_')}`
  const avatarEl = avatarDataUrl
    ? `<clipPath id="${avatarClipId}"><circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR}"/></clipPath>
       <image href="${avatarDataUrl}" x="${avatarCx - avatarR}" y="${avatarCy - avatarR}" width="${avatarR * 2}" height="${avatarR * 2}" clip-path="url(#${avatarClipId})"/>`
    : `<text x="${avatarCx}" y="${avatarCy + 8}" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="700" fill="rgba(255,255,255,0.85)">${escapeXml(getInitials(p.name))}</text>`

  const lifespan = getLifespan(p.birthDate, p.deathDate)
  const nameLines = wrapText(p.name, width - 28)
  const nameBaseY = lifespan ? 112 : 118
  const lineH = 19

  const nameText = nameLines
    .map(
      (line, i) =>
        `<text x="${width / 2}" y="${nameBaseY + i * lineH}" text-anchor="middle" font-family="Georgia,'Times New Roman',serif" font-size="14" font-weight="600" fill="white" dominant-baseline="auto">${escapeXml(line)}</text>`,
    )
    .join('\n      ')

  const lifespanY = nameBaseY + nameLines.length * lineH + 7
  const lifespanEl = lifespan
    ? `<text x="${width / 2}" y="${lifespanY}" text-anchor="middle" font-family="Arial,sans-serif" font-size="11" fill="rgba(255,255,255,0.85)">${escapeXml(lifespan)}</text>`
    : ''

  const dividerY = height - 68
  const memoriesCount = p.memories ?? 0
  const memoriesEl =
    memoriesCount > 0
      ? `<text x="${width / 2}" y="${dividerY + 26}" text-anchor="middle" font-family="Arial,sans-serif" font-size="10" fill="rgba(255,255,255,0.65)">${memoriesCount} ${memoriesCount === 1 ? 'memory' : 'memories'}</text>`
      : ''

  const shadow = `<rect x="3" y="5" width="${width}" height="${height}" rx="16" ry="16" fill="rgba(0,0,0,0.10)"/>`

  return `<g transform="translate(${x},${y})">
    ${shadow}
    ${selfRing}
    <rect x="0" y="0" width="${width}" height="${height}" rx="16" ry="16" fill="${bg}" ${borderAttr}/>
    <circle cx="${avatarCx}" cy="${avatarCy}" r="${avatarR + 2}" fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.35)" stroke-width="1.5"/>
    ${avatarEl}
    ${nameText}
    ${lifespanEl}
    <line x1="12" y1="${dividerY}" x2="${width - 12}" y2="${dividerY}" stroke="rgba(255,255,255,0.15)" stroke-width="1"/>
    ${memoriesEl}
  </g>`
}

function pathBetween(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  srcHandle: string | null | undefined,
  tgtHandle: string | null | undefined,
): string {
  if (
    (srcHandle === 'right' && tgtHandle === 'left') ||
    (srcHandle === 'left' && tgtHandle === 'right')
  ) {
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }
  const midY = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`
}

interface NodePos {
  x: number
  y: number
  w: number
  h: number
}

function nodeHandlePoint(pos: NodePos, handle: string | null | undefined): { x: number; y: number } {
  switch (handle) {
    case 'top':    return { x: pos.x + pos.w / 2, y: pos.y }
    case 'bottom': return { x: pos.x + pos.w / 2, y: pos.y + pos.h }
    case 'left':   return { x: pos.x,              y: pos.y + pos.h / 2 }
    case 'right':  return { x: pos.x + pos.w,      y: pos.y + pos.h / 2 }
    default:       return { x: pos.x + pos.w / 2,  y: pos.y + pos.h }
  }
}

export interface BuildTreeSvgOptions {
  /**
   * Pre-fetched avatar images as data URLs, keyed by node ID.
   * Accepts both server-side (converted from Buffer before calling) and
   * browser-side (fetched via browser fetch with session cookies) data URLs.
   * Renderer is pure: zero I/O, no Node.js APIs, safe to call in both environments.
   */
  avatarDataUrls?: Map<string, string>
  /**
   * When true, use compact card dimensions (set automatically for large trees).
   * Compact mode skips avatar rendering — they're sub-millimetre at this scale.
   */
  compact?: boolean
}

export function buildTreeSvg(
  nodes: Node[],
  edges: Edge[],
  options: BuildTreeSvgOptions = {},
): string {
  const { avatarDataUrls, compact = false } = options

  const personNodes = nodes.filter((n) => n.type === 'personNode')
  if (personNodes.length === 0) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="200"><rect width="800" height="200" fill="${BG_COLOR}"/><text x="400" y="105" text-anchor="middle" font-family="Arial,sans-serif" font-size="16" fill="#666">No family members to display</text></svg>`
  }

  const posMap = new Map<string, NodePos>()
  for (const n of nodes) {
    const w = (n.style?.width as number | undefined) ?? 220
    const h = (n.style?.height as number | undefined) ?? 300
    posMap.set(n.id, { x: n.position.x, y: n.position.y, w, h })
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const n of personNodes) {
    const pos = posMap.get(n.id)
    if (!pos) continue
    if (pos.x < minX) minX = pos.x
    if (pos.y < minY) minY = pos.y
    if (pos.x + pos.w > maxX) maxX = pos.x + pos.w
    if (pos.y + pos.h > maxY) maxY = pos.y + pos.h
  }

  const totalW = maxX - minX + PADDING * 2
  const totalH = maxY - minY + PADDING * 2
  const ox = -minX + PADDING
  const oy = -minY + PADDING

  const resolvedAvatarUrls = (!compact && avatarDataUrls) ? avatarDataUrls : new Map<string, string>()

  const edgeParts: string[] = []
  for (const e of edges) {
    const src = posMap.get(e.source)
    const tgt = posMap.get(e.target)
    if (!src || !tgt) continue

    const sp = nodeHandlePoint({ ...src, x: src.x + ox, y: src.y + oy }, e.sourceHandle)
    const tp = nodeHandlePoint({ ...tgt, x: tgt.x + ox, y: tgt.y + oy }, e.targetHandle)

    const style = (e.style ?? {}) as Record<string, string | number>
    const stroke = (style.stroke as string | undefined) ?? '#16334a'
    const strokeWidth = (style.strokeWidth as number | undefined) ?? 3
    const opacity = (style.opacity as number | undefined) ?? 1
    const dasharray = style.strokeDasharray ? ` stroke-dasharray="${style.strokeDasharray}"` : ''

    const d = pathBetween(sp.x, sp.y, tp.x, tp.y, e.sourceHandle, e.targetHandle)
    edgeParts.push(
      `<path d="${d}" fill="none" stroke="${escapeXml(String(stroke))}" stroke-width="${strokeWidth}"${dasharray} opacity="${opacity}"/>`,
    )
  }

  const cardParts: string[] = []
  for (const n of personNodes) {
    const pos = posMap.get(n.id)
    if (!pos) continue
    cardParts.push(
      renderPersonCard({
        id: n.id,
        x: pos.x + ox,
        y: pos.y + oy,
        width: pos.w,
        height: pos.h,
        compact,
        data: n.data as unknown as PersonNodeData,
        avatarDataUrl: resolvedAvatarUrls.get(n.id),
      }),
    )
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">
  <rect width="${totalW}" height="${totalH}" fill="${BG_COLOR}"/>
  <g id="edges">
    ${edgeParts.join('\n    ')}
  </g>
  <g id="cards">
    ${cardParts.join('\n    ')}
  </g>
</svg>`
}
