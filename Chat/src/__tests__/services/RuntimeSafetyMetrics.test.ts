import { runtimeSafetyMetricsCollector } from '../../services/monitoring/RuntimeSafetyMetrics'

describe('RuntimeSafetyMetricsCollector', () => {
  beforeEach(() => {
    runtimeSafetyMetricsCollector.reset()
  })

  afterEach(() => {
    runtimeSafetyMetricsCollector.reset()
  })

  it('tracks refusal, violation, retrieval-empty, and citation-missing rates', () => {
    runtimeSafetyMetricsCollector.recordOutcome({
      retrievedDocumentCount: 0,
      refusalApplied: true,
      hadViolations: false,
      citationCount: 0,
    })

    runtimeSafetyMetricsCollector.recordOutcome({
      retrievedDocumentCount: 3,
      refusalApplied: false,
      hadViolations: true,
      citationCount: 0,
    })

    runtimeSafetyMetricsCollector.recordOutcome({
      retrievedDocumentCount: 2,
      refusalApplied: false,
      hadViolations: false,
      citationCount: 2,
    })

    const snapshot = runtimeSafetyMetricsCollector.getSnapshot()

    expect(snapshot.totalResponses).toBe(3)
    expect(snapshot.refusalResponses).toBe(1)
    expect(snapshot.violationResponses).toBe(1)
    expect(snapshot.retrievalEmptyResponses).toBe(1)
    expect(snapshot.citationMissingResponses).toBe(1)

    expect(snapshot.refusalRate).toBeCloseTo(1 / 3, 5)
    expect(snapshot.violationRate).toBeCloseTo(1 / 3, 5)
    expect(snapshot.retrievalEmptyRate).toBeCloseTo(1 / 3, 5)
    expect(snapshot.citationMissingRate).toBeCloseTo(1 / 3, 5)
    expect(snapshot.lastUpdatedAt).toBeTruthy()
  })

  it('does not count missing citations on refusal responses', () => {
    runtimeSafetyMetricsCollector.recordOutcome({
      retrievedDocumentCount: 1,
      refusalApplied: true,
      hadViolations: false,
      citationCount: 0,
    })

    const snapshot = runtimeSafetyMetricsCollector.getSnapshot()
    expect(snapshot.citationMissingResponses).toBe(0)
    expect(snapshot.citationMissingRate).toBe(0)
  })
})
