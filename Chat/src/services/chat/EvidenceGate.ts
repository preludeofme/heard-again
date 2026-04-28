import {
  EvidenceGate,
  EvidencePacket,
  EvidenceThresholds,
  ResponseCitation,
  RetrievedDocument,
  SearchContext,
} from '@/types'

const DEFAULT_EVIDENCE_THRESHOLDS: EvidenceThresholds = {
  minTopScore: 0.2,
  minAvgTop3: 0.15,
  minSources: 1,
}

export class EvidenceGateImpl implements EvidenceGate {
  buildEvidencePacket(
    query: string,
    context: SearchContext,
    retrievedDocuments: RetrievedDocument[],
    thresholds?: Partial<EvidenceThresholds>
  ): EvidencePacket {
    const appliedThresholds: EvidenceThresholds = {
      ...DEFAULT_EVIDENCE_THRESHOLDS,
      ...thresholds,
    }

    const deduplicated = this.deduplicateByChunkId(retrievedDocuments)
    const sorted = deduplicated.sort(
      (a, b) => b.metadata.relevanceScore - a.metadata.relevanceScore
    )

    const packetItems = sorted.map((doc) => ({
      documentId: doc.documentId,
      chunkId: doc.chunkId,
      title: doc.metadata.title,
      content: doc.content,
      relevanceScore: doc.metadata.relevanceScore,
      chunkIndex: doc.metadata.chunkIndex,
      totalChunks: doc.metadata.totalChunks,
      source: doc.metadata.source,
    }))

    const topScore = packetItems[0]?.relevanceScore ?? 0
    const avgTop3 = this.average(
      packetItems.slice(0, 3).map((item) => item.relevanceScore)
    )
    const distinctSources = new Set(packetItems.map((item) => item.source)).size

    const passed =
      packetItems.length > 0 &&
      topScore >= appliedThresholds.minTopScore &&
      avgTop3 >= appliedThresholds.minAvgTop3 &&
      distinctSources >= appliedThresholds.minSources

    return {
      familyspaceId: context.familyspaceId,
      personId: context.personId ?? '',
      query,
      retrievedAt: new Date(),
      topK: context.maxResults ?? packetItems.length,
      items: packetItems,
      thresholds: appliedThresholds,
      passed,
    }
  }

  toCitations(packet: EvidencePacket, limit: number = 3): ResponseCitation[] {
    return packet.items.slice(0, limit).map((item) => ({
      documentId: item.documentId,
      chunkId: item.chunkId,
      title: item.title,
      excerpt: this.createExcerpt(item.content),
      relevanceScore: item.relevanceScore,
    }))
  }

  private deduplicateByChunkId(documents: RetrievedDocument[]): RetrievedDocument[] {
    const uniqueByChunkId = new Map<string, RetrievedDocument>()

    for (const doc of documents) {
      if (!uniqueByChunkId.has(doc.chunkId)) {
        uniqueByChunkId.set(doc.chunkId, doc)
      }
    }

    return Array.from(uniqueByChunkId.values())
  }

  private average(values: number[]): number {
    if (values.length === 0) {
      return 0
    }

    const sum = values.reduce((total, value) => total + value, 0)
    return sum / values.length
  }

  private createExcerpt(content: string, maxLength: number = 240): string {
    const normalized = content.replace(/\s+/g, ' ').trim()

    if (normalized.length <= maxLength) {
      return normalized
    }

    return `${normalized.slice(0, maxLength)}...`
  }
}
