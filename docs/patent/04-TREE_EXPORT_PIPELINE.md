# Invention #3 — Tile-and-Stitch Gigapixel Family Tree Export

> **Draft status note:** This file contains invention notes and may mix implemented behavior with proposed embodiments. Review [`08-PATENT_REVIEW_CRITIQUE.md`](./08-PATENT_REVIEW_CRITIQUE.md) before relying on it for attorney handoff.

> **Inventor:** Ryan Buck
> **Category:** Graph Visualization / High-Resolution Vector Export
> **Related Files:** `Exporter/`, `UI/src/components/pages/family-tree/xyflow/`, `UI/src/pages/api/export/`

---

## 1. Problem

Large family trees (500+ nodes, 6+ generations) cannot be exported at print resolution using browser-based rendering:

1. **Browser canvas limits**: `html-to-image` and similar libraries render the full SVG/DOM to a canvas element, but browsers crash or produce **blurry/artifacting output** when the canvas exceeds ~4000×4000 pixels
2. **Vector quality loss**: Fonts in exported images appear pixelated because the browser renderer downscales the vector tree to fit within GPU texture limits
3. **Memory pressure**: Rendering a large tree in the browser tab consumes 2-4GB of RAM, causing tab crashes on typical consumer hardware

---

## 2. The Invention

### 2.1 Architecture: Three-Layer Export Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                      Presentation Layer (Browser)                │
│  User clicks "Export PNG"                                        │
│  → POST /api/export { rootId }                                   │
│  → UI shows loading spinner, polls /api/export-status            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                    Orchestration Layer (Next.js API)              │
│                                                                   │
│  /api/export → routes to worker:                                  │
│    • Production: POST to RunPod Serverless endpoint               │
│    • Local: POST to puppeteer-exporter Docker container           │
│    • Returns jobId immediately (async)                            │
│                                                                   │
│  /api/export-status → polls RunPod job status:                    │
│    • COMPLETED → returns public R2 download URL                   │
│    • IN_PROGRESS → client continues polling (every 5s)           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────┐
│                      Compute Layer (Worker)                       │
│                                                                   │
│  Puppeteer (headless Chromium in Docker)                          │
│  ┌──────────────────────────────────────────────┐                │
│  │  1. Visit hidden render route:                │                │
│  │     /export-tree?rootId=...                   │                │
│  │     (UI-less, pure tree DOM)                  │                │
│  │                                              │                │
│  │  2. Wait for window.IS_TREE_READY signal     │                │
│  │     Read window.TREE_BOUNDS for canvas size  │                │
│  │                                              │                │
│  │  3. TILE CAPTURE:                            │                │
│  │     Capture 2000×2000 pixel tiles at 1:1     │                │
│  │     scale using page.screenshot()            │                │
│  │     (preserves font crispness)               │                │
│  │                                              │                │
│  │  4. SHARP STITCH:                            │                │
│  │     Math.stitch(grid of tiles)               │                │
│  │     → gigapixel PNG buffer                   │                │
│  │                                              │                │
│  │  5. STORAGE:                                  │                │
│  │     Production: Upload to Cloudflare R2       │                │
│  │     Local: Save to mapped Docker volume       │                │
│  └──────────────────────────────────────────────┘                │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 Tile Capture Algorithm (Key Innovation)

The core innovation is the **tile-and-stitch** approach:

```javascript
// Pseudocode of the puppeteer capture logic
const TILE_SIZE = 2000;  // 2000×2000 pixels per tile
const { width, height } = await page.evaluate(() => window.TREE_BOUNDS);

// Calculate grid dimensions
const cols = Math.ceil(width / TILE_SIZE);
const rows = Math.ceil(height / TILE_SIZE);

// Capture each tile at 1:1 scale
const tiles = [];
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const clip = {
      x: col * TILE_SIZE,
      y: row * TILE_SIZE,
      width: TILE_SIZE,
      height: TILE_SIZE,
    };
    const tileBuffer = await page.screenshot({ clip });
    tiles.push({ buffer: tileBuffer, row, col });
  }
}

// Stitch tiles using Sharp
// Sharp processes raw pixel buffers mathematically
// No browser rendering involved — pure image processing
const stitched = await sharp({
  create: {
    width: width,
    height: height,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 }
  }
}).composite(tilePlacements)  // Place each tile in correct position
  .png()
  .toBuffer();
```

**Why this works where browser rendering fails:**
- Each tile is within the browser's GPU texture limit (2000×2000 < 4000×4000)
- Font rendering at 1:1 scale preserves crispness — no downscaling
- Sharp's `composite()` operation is a purely mathematical pixel merge, not a re-render
- Total output can be 10,000×15,000+ pixels (100+ megapixels) without browser artifacts

### 2.3 Hidden Render Route

A dedicated UI-free route renders the tree purely for export:

```
/export-tree?rootId=<personId>
```

This route:
- Loads only the `<ReactFlowTreeCanvas>` component
- Suppresses all backgrounds, menus, controls  
- Fetches the complete tree graph at maximum depth
- Signals readiness via `window.IS_TREE_READY = true`
- Exposes bounds via `window.TREE_BOUNDS = { width, height }`

### 2.4 Dual Storage Routing

| Environment | Storage | URL |
|-------------|---------|-----|
| **Production** | Cloudflare R2 (S3-compatible) | Public CDN URL |
| **Local Dev** | Docker volume → `UI/public/exports/` | Local file serve |

### 2.5 Asynchronous Job Model

- Export is **never synchronous** — even local exports run as a job
- Client polls `/api/export-status` every 5 seconds
- Job statuses: `QUEUED → PROCESSING → COMPLETED / FAILED`
- Error details returned on failure for debugging

### 2.6 Build Family Graph Algorithm

The graph structure is built from the Prisma data model:

```typescript
function buildFamilyGraph(people: ApiPersonWithEdges[]): NormalizedFamilyGraph {
  // Map relationships: parents, children, spouses
  // Group into FamilyUnit nodes (parents + children)
  // Return typed graph model for ReactFlow rendering
  
  // Key: SPOUSE → horizontal link
  //      PARENT (incoming) → vertical link up
  //      CHILD (outgoing) → vertical link down
}
```

Relationship types: `SPOUSE`, `PARENT`, `CHILD` with directions and biological/non-biological flags.

---

## 3. Prior Art Distinction

| Feature | html-to-image | Puppeteer screenshot | Heard Again Exporter |
|---------|---------------|---------------------|---------------------|
| Tile capture | ✗ (single render) | ✗ (single screenshot) | ✓ (grid of tiles) |
| Sharp stitching | ✗ | ✗ | ✓ |
| Gigapixel output | ✗ (crashes >4K) | ✗ (blurry >4K) | ✓ (100+ MP) |
| Async job model | ✗ | ✗ | ✓ |
| R2 cloud storage | ✗ | ✗ | ✓ |
| Font crispness at scale | ✗ | ✗ (browser software renderer may still produce fuzzy results) | ✓ (1:1 scale capture) |

---

## 4. Claims Ideas

1. **A method for high-resolution graph visualization export** comprising: rendering a graph canvas within a headless browser; capturing the canvas as a grid of fixed-size tiles at 1:1 scale; and stitching the tiles into a single output image using an image processing library.

2. **The method of claim 1** wherein the tile size is selected to remain within the browser's GPU texture memory limit while preserving text rendering quality.

3. **The method of claim 1** further comprising: rendering the graph on a hidden, UI-suppressed route that loads only the visualization component without application chrome.

4. **A system for asynchronous graph export** comprising: an API endpoint that accepts a graph root identifier and triggers a remote worker; a worker that captures the graph using the method of claim 1; a status polling endpoint; and a storage adapter that routes the output to either cloud object storage or a local filesystem.

---

## 5. Related Source Files

| File | Purpose |
|------|---------|
| `Exporter/architecture.md` | Full architecture doc with Mermaid diagram |
| `Exporter/index.js` | Express.js server for Puppeteer capture |
| `Exporter/Dockerfile` | Puppeteer + Sharp Docker build |
| `UI/src/pages/api/export/` | Export trigger API |
| `UI/src/pages/api/export/jobs/[id].ts` | Job status polling |
| `UI/src/components/pages/family-tree/xyflow/` | ReactFlow tree components |
| `UI/src/components/pages/family-tree/xyflow/layout/buildFamilyGraph.ts` | Graph construction |
| `UI/src/components/pages/family-tree/xyflow/layout/familyTreeTypes.ts` | Graph type definitions |
| `UI/src/components/pages/family-tree/xyflow/utils/familyTreeTraversal.ts` | Graph traversal |
| `UI/src/components/pages/family-tree/FamilyTreePage.tsx` | Export trigger in UI |
