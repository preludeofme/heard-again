export interface ChatSafetyOutcome {
  retrievedDocumentCount: number
  refusalApplied: boolean
  hadViolations: boolean
  citationCount: number
}

export interface RuntimeSafetyMetricsSnapshot {
  totalResponses: number
  refusalResponses: number
  violationResponses: number
  retrievalEmptyResponses: number
  citationMissingResponses: number
  refusalRate: number
  violationRate: number
  retrievalEmptyRate: number
  citationMissingRate: number
  lastUpdatedAt: string | null
}

function safeDivide(numerator: number, denominator: number): number {
  if (denominator === 0) {
    return 0
  }

  return numerator / denominator
}

class RuntimeSafetyMetricsCollector {
  private totalResponses = 0
  private refusalResponses = 0
  private violationResponses = 0
  private retrievalEmptyResponses = 0
  private citationMissingResponses = 0
  private lastUpdatedAt: Date | null = null

  recordOutcome(outcome: ChatSafetyOutcome): void {
    this.totalResponses += 1

    if (outcome.refusalApplied) {
      this.refusalResponses += 1
    }

    if (outcome.hadViolations) {
      this.violationResponses += 1
    }

    if (outcome.retrievedDocumentCount === 0) {
      this.retrievalEmptyResponses += 1
    }

    if (!outcome.refusalApplied && outcome.citationCount === 0) {
      this.citationMissingResponses += 1
    }

    this.lastUpdatedAt = new Date()
  }

  getSnapshot(): RuntimeSafetyMetricsSnapshot {
    return {
      totalResponses: this.totalResponses,
      refusalResponses: this.refusalResponses,
      violationResponses: this.violationResponses,
      retrievalEmptyResponses: this.retrievalEmptyResponses,
      citationMissingResponses: this.citationMissingResponses,
      refusalRate: safeDivide(this.refusalResponses, this.totalResponses),
      violationRate: safeDivide(this.violationResponses, this.totalResponses),
      retrievalEmptyRate: safeDivide(this.retrievalEmptyResponses, this.totalResponses),
      citationMissingRate: safeDivide(this.citationMissingResponses, this.totalResponses),
      lastUpdatedAt: this.lastUpdatedAt?.toISOString() || null,
    }
  }

  reset(): void {
    this.totalResponses = 0
    this.refusalResponses = 0
    this.violationResponses = 0
    this.retrievalEmptyResponses = 0
    this.citationMissingResponses = 0
    this.lastUpdatedAt = null
  }
}

const globalScope = globalThis as typeof globalThis & {
  __heardAgainRuntimeSafetyMetrics?: RuntimeSafetyMetricsCollector
}

export const runtimeSafetyMetricsCollector =
  globalScope.__heardAgainRuntimeSafetyMetrics ||
  (globalScope.__heardAgainRuntimeSafetyMetrics =
    new RuntimeSafetyMetricsCollector())
