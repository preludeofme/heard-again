import { task, logger } from "@trigger.dev/sdk/v3";
import { PrismaClient } from "@prisma/client";
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { buildFamilyTreeLayout } from "@/components/pages/family-tree/xyflow/layout";
import {
  buildTreeSvg,
  COMPACT_NODE_THRESHOLD,
} from "@/lib/export/tree-svg-renderer";
import type { ApiPersonWithEdges } from "@/components/pages/family-tree/xyflow/types";
import sharp from "sharp";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export type ExportFormat = "svg" | "png";

export interface ExportTreePayload {
  familyspaceId: string;
  rootPersonId?: string;
  userId: string;
  format: ExportFormat;
}

export interface ExportTreeOutput {
  downloadUrl: string;
  format: ExportFormat;
  nodeCount: number;
}

const prisma = new PrismaClient();

// Dummy callbacks — layout reads them from the type but never invokes them during layout computation
const DUMMY_CALLBACKS = {
  onPersonClick: () => {},
  onAddPerson: () => {},
  onViewMemories: () => {},
  onViewFullProfile: () => {},
  onSetRoot: () => {},
  onLoadMore: () => {},
  onEditRelationships: () => {},
  isMobile: false,
};

// ─── R2 client ────────────────────────────────────────────────────────────────

function buildR2Client(): { client: S3Client; bucket: string } | null {
  const bucket = process.env.R2_BUCKET_NAME;
  const accessKey = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const endpoint =
    process.env.R2_ENDPOINT ??
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  if (!bucket || !accessKey || !secretKey || !endpoint) return null;

  const client = new S3Client({
    region: "auto",
    endpoint,
    forcePathStyle: true,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
  });

  return { client, bucket };
}

// ─── Throttled concurrency pool ───────────────────────────────────────────────
// Runs `fn` over `items` with at most `concurrency` in-flight at once.
// No external dependency needed — JS single-thread guarantees index++ is atomic between awaits.

async function runThrottled<T>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  async function worker() {
    while (index < items.length) {
      const i = index++;
      await fn(items[i]!);
    }
  }
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, worker),
  );
}

// ─── SVG dimension helper ─────────────────────────────────────────────────────

function parseSvgDim(svg: string, attr: "width" | "height"): number {
  const match = svg.match(new RegExp(`${attr}="(\\d+(?:\\.\\d+)?)"`));
  return match ? parseFloat(match[1]!) : 0;
}

// ─── Avatar fetching ──────────────────────────────────────────────────────────
// Reads avatar images directly from R2 — bypasses the auth-protected HTTP asset serve route.
// Falls back gracefully (empty map) when R2 credentials are unavailable (local dev).

interface AvatarData {
  buffer: Buffer;
  mimeType: string;
}

async function fetchAvatarBuffers(
  personNodes: Array<{ nodeId: string; avatarAssetId: string }>,
  r2: { client: S3Client; bucket: string },
): Promise<Map<string, AvatarData>> {
  const result = new Map<string, AvatarData>();
  if (personNodes.length === 0) return result;

  // Single batch DB query — get storagePath + mimeType for all avatar assets at once
  const assetIds = personNodes.map((n) => n.avatarAssetId);
  const assets = await prisma.asset.findMany({
    where: { id: { in: assetIds } },
    select: { id: true, storagePath: true, mimeType: true },
  });
  const assetById = new Map(assets.map((a) => [a.id, a]));

  // Throttled reads: 20 concurrent R2 GetObject calls
  await runThrottled(personNodes, 20, async ({ nodeId, avatarAssetId }) => {
    const asset = assetById.get(avatarAssetId);
    if (!asset) return;

    try {
      const res = await r2.client.send(
        new GetObjectCommand({ Bucket: r2.bucket, Key: asset.storagePath }),
      );
      const body = res.Body;
      if (!body) return;

      const chunks: Uint8Array[] = [];
      // @ts-expect-error — Body is a Readable in Node.js runtime
      for await (const chunk of body) {
        chunks.push(chunk as Uint8Array);
      }
      result.set(nodeId, {
        buffer: Buffer.concat(chunks),
        mimeType: asset.mimeType ?? "image/jpeg",
      });
    } catch {
      // Non-fatal: card renders initials if avatar is missing
    }
  });

  return result;
}

// ─── DB fetch ────────────────────────────────────────────────────────────────

interface FetchResult {
  people: ApiPersonWithEdges[];
  /** personId → avatarAssetId — used for direct R2 avatar reads without touching the HTTP route */
  avatarAssetIds: Map<string, string>;
}

async function fetchPeopleForExport(
  familyspaceId: string,
): Promise<FetchResult> {
  const [allPeople, allFamilyUnits] = await Promise.all([
    prisma.person.findMany({
      where: { familyspaceId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        displayName: true,
        nickname: true,
        avatarAssetId: true,
        birthDate: true,
        deathDate: true,
        personType: true,
        sex: true,
        createdById: true,
        createdAt: true,
        _count: { select: { storiesAsSubject: true } },
      },
    }),
    prisma.familyUnit.findMany({
      where: { familyspaceId },
      include: {
        parents: {
          include: {
            parent: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                avatarAssetId: true,
              },
            },
          },
        },
        children: {
          include: {
            child: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                nickname: true,
                avatarAssetId: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (allPeople.length === 0) return { people: [], avatarAssetIds: new Map() };

  const familiesByPersonId = new Map<
    string,
    {
      isParent: boolean;
      isChild: boolean;
      unit: (typeof allFamilyUnits)[number];
    }[]
  >();
  for (const unit of allFamilyUnits) {
    for (const p of unit.parents) {
      if (!familiesByPersonId.has(p.parentId))
        familiesByPersonId.set(p.parentId, []);
      familiesByPersonId
        .get(p.parentId)!
        .push({ isParent: true, isChild: false, unit });
    }
    for (const c of unit.children) {
      if (!familiesByPersonId.has(c.childId))
        familiesByPersonId.set(c.childId, []);
      familiesByPersonId
        .get(c.childId)!
        .push({ isParent: false, isChild: true, unit });
    }
  }

  const allIds = new Set(allPeople.map((p) => p.id));

  const people = allPeople.map((person) => {
    const edges: ApiPersonWithEdges["relationshipEdges"] = [];
    const families = familiesByPersonId.get(person.id) ?? [];

    for (const { isParent, isChild, unit } of families) {
      if (isParent) {
        for (const p of unit.parents) {
          if (!p.parent || p.parentId === person.id || !allIds.has(p.parentId))
            continue;
          edges.push({
            id: `spouse-${person.id}-${p.parentId}`,
            type: "SPOUSE",
            direction: "outgoing",
            isBiological: true,
            notes: null,
            relatedPerson: {
              id: p.parent.id,
              firstName: p.parent.firstName,
              lastName: p.parent.lastName,
              nickname: p.parent.nickname,
              avatarAssetId: p.parent.avatarAssetId,
            },
          });
        }
        for (const c of unit.children) {
          if (!c.child || !allIds.has(c.childId)) continue;
          edges.push({
            id: `parent-${person.id}-${c.childId}`,
            type: "CHILD",
            direction: "outgoing",
            isBiological: c.relationshipType === "BIOLOGICAL",
            notes: null,
            relatedPerson: {
              id: c.child.id,
              firstName: c.child.firstName,
              lastName: c.child.lastName,
              nickname: c.child.nickname,
              avatarAssetId: c.child.avatarAssetId,
            },
          });
        }
      }
      if (isChild) {
        for (const p of unit.parents) {
          if (!p.parent || !allIds.has(p.parentId)) continue;
          edges.push({
            id: `child-${person.id}-${p.parentId}`,
            type: "PARENT",
            direction: "incoming",
            isBiological: p.relationshipType === "BIOLOGICAL",
            notes: null,
            relatedPerson: {
              id: p.parent.id,
              firstName: p.parent.firstName,
              lastName: p.parent.lastName,
              nickname: p.parent.nickname,
              avatarAssetId: p.parent.avatarAssetId,
            },
          });
        }
        for (const c of unit.children) {
          if (!c.child || c.childId === person.id || !allIds.has(c.childId))
            continue;
          edges.push({
            id: `sibling-${person.id}-${c.childId}`,
            type: "SIBLING",
            direction: "outgoing",
            isBiological: true,
            notes: null,
            relatedPerson: {
              id: c.child.id,
              firstName: c.child.firstName,
              lastName: c.child.lastName,
              nickname: c.child.nickname,
              avatarAssetId: c.child.avatarAssetId,
            },
          });
        }
      }
    }

    const sexMap: Record<string, "M" | "F" | "U" | "X"> = {
      M: "M",
      F: "F",
      U: "U",
      X: "X",
    };

    return {
      id: person.id,
      firstName: person.firstName,
      lastName: person.lastName,
      displayName: person.displayName,
      avatarUrl: person.avatarAssetId
        ? `/api/assets/serve/${person.avatarAssetId}`
        : null,
      personType: person.personType,
      sex: person.sex ? (sexMap[String(person.sex)] ?? undefined) : undefined,
      birthDate: person.birthDate?.toISOString() ?? null,
      deathDate: person.deathDate?.toISOString() ?? null,
      counts: { stories: person._count.storiesAsSubject },
      relationshipEdges: edges,
    } satisfies ApiPersonWithEdges;
  });

  const avatarAssetIds = new Map<string, string>();
  for (const person of allPeople) {
    if (person.avatarAssetId)
      avatarAssetIds.set(person.id, person.avatarAssetId);
  }

  return { people, avatarAssetIds };
}

// ─── R2 upload ────────────────────────────────────────────────────────────────

async function uploadToR2(
  r2: { client: S3Client; bucket: string },
  buffer: Buffer,
  fileName: string,
  contentType: string,
): Promise<string> {
  const key = `exports/${fileName}`;
  await r2.client.send(
    new PutObjectCommand({
      Bucket: r2.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );

  const getObjectCommand = new GetObjectCommand({
    Bucket: r2.bucket,
    Key: key,
    ResponseContentDisposition: `attachment; filename="${fileName}"`,
  });
  // Generate a pre-signed URL valid for 24 hours
  return await getSignedUrl(r2.client, getObjectCommand, {
    expiresIn: 24 * 3600,
  });
}

// ─── Local filesystem export (STORAGE_MODE=local) ─────────────────────────────
// Writes to UI/public/exports/ which Next.js serves as /exports/<file>.
// Trigger.dev dev server runs from the project root; LOCAL_EXPORT_DIR overrides the path.

async function writeLocalExport(
  buffer: Buffer,
  fileName: string,
): Promise<string> {
  const exportDir =
    process.env.LOCAL_EXPORT_DIR ??
    path.join(process.cwd(), "UI", "public", "exports");
  await fs.mkdir(exportDir, { recursive: true });
  await fs.writeFile(path.join(exportDir, fileName), buffer);
  const appBase = (process.env.NEXTAUTH_URL ?? "http://localhost:4776").replace(
    /\/$/,
    "",
  );
  return `${appBase}/exports/${fileName}`;
}

// ─── Task ─────────────────────────────────────────────────────────────────────

export const exportTreeTask = task({
  id: "export-tree",
  // Machine and maxDuration are set at dispatch time by api/export.ts based on node count.
  // The queue concurrency limit prevents resource storms under high user load.
  queue: { name: "export-tree", concurrencyLimit: 10 },
  retry: { maxAttempts: 2 },

  run: async (payload: ExportTreePayload): Promise<ExportTreeOutput> => {
    const { familyspaceId, rootPersonId, format } = payload;

    logger.info("Starting family tree export", {
      familyspaceId,
      rootPersonId,
      format,
    });

    // 1. Fetch all people with relationships
    const { people, avatarAssetIds } =
      await fetchPeopleForExport(familyspaceId);
    if (people.length === 0) throw new Error("No people found in familyspace");
    const nodeCount = people.length;
    logger.info(`Fetched ${nodeCount} people`);

    // 2. Determine root
    const rootId =
      rootPersonId && people.some((p) => p.id === rootPersonId)
        ? rootPersonId
        : people[0]!.id;

    // 3. Layout
    const { nodes, edges } = buildFamilyTreeLayout(
      people,
      rootId,
      DUMMY_CALLBACKS,
      null,
      null,
    );
    logger.info(`Layout: ${nodes.length} nodes, ${edges.length} edges`);

    // 4. Avatar fetching — direct from R2, no HTTP auth hop
    // Compact mode skips avatars: they're illegible at small card sizes and significantly
    // inflate SVG size (each avatar adds ~50–80 KB of base64 data).
    const compact = nodeCount > COMPACT_NODE_THRESHOLD;
    const r2 = buildR2Client();
    let avatarBuffers = new Map<string, AvatarData>();

    if (r2 && !compact) {
      const nodesWithAvatars = Array.from(avatarAssetIds.entries()).map(
        ([nodeId, avatarAssetId]) => ({
          nodeId,
          avatarAssetId,
        }),
      );

      if (nodesWithAvatars.length > 0) {
        logger.info(
          `Fetching ${nodesWithAvatars.length} avatars directly from R2`,
        );
        avatarBuffers = await fetchAvatarBuffers(nodesWithAvatars, r2);
        logger.info(`Fetched ${avatarBuffers.size} avatars`);
      }
    } else if (!r2) {
      logger.info("R2 not configured — skipping avatar fetch (local dev)");
    } else {
      logger.info(
        `Compact mode (${nodeCount} nodes > ${COMPACT_NODE_THRESHOLD}) — skipping avatars`,
      );
    }

    // 5. Convert avatar buffers → data URL strings (renderer is format-agnostic)
    const avatarDataUrls = new Map<string, string>();
    for (const [nodeId, { buffer, mimeType }] of avatarBuffers) {
      avatarDataUrls.set(
        nodeId,
        `data:${mimeType};base64,${buffer.toString("base64")}`,
      );
    }

    // 6. Generate SVG (pure CPU, synchronous)
    const svg = buildTreeSvg(nodes, edges, { avatarDataUrls, compact });
    logger.info(`SVG generated (${Math.round(svg.length / 1024)} KB)`);

    // Determine storage destination. STORAGE_MODE=local writes to UI/public/exports/
    // (served as Next.js static files). R2 is used for all other modes.
    const useLocal = (process.env.STORAGE_MODE ?? "r2") === "local";
    if (!useLocal && !r2)
      throw new Error("R2 credentials required for export upload");

    // 7a. SVG format — upload directly, no rasterization
    if (format === "svg") {
      const fileName = `family-tree-${crypto.randomUUID()}.svg`;
      const downloadUrl = useLocal
        ? await writeLocalExport(Buffer.from(svg), fileName)
        : await uploadToR2(r2!, Buffer.from(svg), fileName, "image/svg+xml");
      logger.info("SVG export complete", { downloadUrl, nodeCount });
      return { downloadUrl, format: "svg", nodeCount };
    }

    // 7b. PNG format — rasterize with Sharp
    // libvips/librsvg has a hard 32767×32767 px cap that limitInputPixels cannot bypass.
    // At density=72, 1 SVG user unit = 1 output pixel.
    // For trees with 500+ leaves the canvas easily hits 150,000+ units wide, far exceeding
    // the limit even at density=1. We scale the SVG itself: rewriting width/height on the
    // <svg> root (viewBox unchanged) causes librsvg to render at the target pixel size while
    // preserving layout. Non-global .replace() targets the first occurrence — the root attrs.
    const svgW = parseSvgDim(svg, "width");
    const svgH = parseSvgDim(svg, "height");
    const MAX_OUTPUT_DIM = 32000;

    let renderSvg = svg;
    if (svgW > 0 && svgH > 0 && Math.max(svgW, svgH) > MAX_OUTPUT_DIM) {
      const scale = MAX_OUTPUT_DIM / Math.max(svgW, svgH);
      const targetW = Math.floor(svgW * scale);
      const targetH = Math.floor(svgH * scale);
      renderSvg = svg
        .replace(/width="[\d.]+"/, `width="${targetW}"`)
        .replace(/height="[\d.]+"/, `height="${targetH}"`);
      logger.info(`SVG scaled: ${svgW}×${svgH} → ${targetW}×${targetH}px`);
    } else {
      logger.info(`SVG size: ${svgW}×${svgH}px — no scaling needed`);
    }

    const pngBuffer = await sharp(Buffer.from(renderSvg), {
      density: 72,
      limitInputPixels: false,
    })
      .png({ compressionLevel: 8 })
      .toBuffer();

    logger.info(
      `PNG rasterized (${Math.round((pngBuffer.length / 1024 / 1024) * 10) / 10} MB)`,
    );

    const fileName = `family-tree-${crypto.randomUUID()}.png`;
    const downloadUrl = useLocal
      ? await writeLocalExport(pngBuffer, fileName)
      : await uploadToR2(r2!, pngBuffer, fileName, "image/png");

    logger.info("PNG export complete", { downloadUrl, nodeCount });
    return { downloadUrl, format: "png", nodeCount };
  },
});
