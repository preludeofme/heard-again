import fs from 'fs'
import path from 'path'
import {
  EvalMetrics,
  EvalScorecard,
} from '../src/services/eval/EvaluationHarness'
import { LAUNCH_GO_NO_GO_THRESHOLDS } from '../src/config/releaseCandidate'

interface CliOptions {
  baselinePath: string
  candidatePath: string
  outputPath: string
}

interface ThresholdCheckResult {
  metric: string
  target: string
  actual: number
  passed: boolean
}

interface ImprovementCheckResult {
  check: string
  baseline: number
  candidate: number
  passed: boolean
}

interface GoNoGoReport {
  generatedAt: string
  baselineRunLabel: string
  candidateRunLabel: string
  thresholds: ThresholdCheckResult[]
  improvements: ImprovementCheckResult[]
  decision: 'GO' | 'NO_GO'
}

function parseCliArgs(argv: string[]): CliOptions {
  const args = [...argv]

  let baselinePath = 'evals/results/baseline-current.scorecard.json'
  let candidatePath = 'evals/results/candidate-example.scorecard.json'
  let outputPath = 'evals/results/release-candidate.go-no-go.json'

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i]

    if (token === '--baseline' && args[i + 1]) {
      baselinePath = args[i + 1]
      i += 1
      continue
    }

    if (token === '--candidate' && args[i + 1]) {
      candidatePath = args[i + 1]
      i += 1
      continue
    }

    if ((token === '--out' || token === '--output') && args[i + 1]) {
      outputPath = args[i + 1]
      i += 1
    }
  }

  return {
    baselinePath,
    candidatePath,
    outputPath,
  }
}

function resolvePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath
  }

  return path.resolve(process.cwd(), inputPath)
}

function readJsonFile<T>(filePath: string): T {
  const resolvedPath = resolvePath(filePath)
  return JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as T
}

function writeJsonFile(filePath: string, payload: unknown): void {
  const resolvedPath = resolvePath(filePath)
  const directoryPath = path.dirname(resolvedPath)

  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true })
  }

  fs.writeFileSync(resolvedPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function evaluateThresholds(metrics: EvalMetrics): ThresholdCheckResult[] {
  return [
    {
      metric: 'groundedPrecision',
      target: `>= ${LAUNCH_GO_NO_GO_THRESHOLDS.minGroundedPrecision}`,
      actual: metrics.groundedPrecision,
      passed: metrics.groundedPrecision >= LAUNCH_GO_NO_GO_THRESHOLDS.minGroundedPrecision,
    },
    {
      metric: 'unsupportedClaimRate',
      target: `<= ${LAUNCH_GO_NO_GO_THRESHOLDS.maxUnsupportedClaimRate}`,
      actual: metrics.unsupportedClaimRate,
      passed:
        metrics.unsupportedClaimRate <=
        LAUNCH_GO_NO_GO_THRESHOLDS.maxUnsupportedClaimRate,
    },
    {
      metric: 'refusalPrecision',
      target: `>= ${LAUNCH_GO_NO_GO_THRESHOLDS.minRefusalPrecision}`,
      actual: metrics.refusalPrecision,
      passed: metrics.refusalPrecision >= LAUNCH_GO_NO_GO_THRESHOLDS.minRefusalPrecision,
    },
    {
      metric: 'refusalRecall',
      target: `>= ${LAUNCH_GO_NO_GO_THRESHOLDS.minRefusalRecall}`,
      actual: metrics.refusalRecall,
      passed: metrics.refusalRecall >= LAUNCH_GO_NO_GO_THRESHOLDS.minRefusalRecall,
    },
    {
      metric: 'personaStyleConsistencyScore',
      target: `>= ${LAUNCH_GO_NO_GO_THRESHOLDS.minPersonaStyleConsistencyScore}`,
      actual: metrics.personaStyleConsistencyScore,
      passed:
        metrics.personaStyleConsistencyScore >=
        LAUNCH_GO_NO_GO_THRESHOLDS.minPersonaStyleConsistencyScore,
    },
    {
      metric: 'citationCoverage',
      target: `>= ${LAUNCH_GO_NO_GO_THRESHOLDS.minCitationCoverage}`,
      actual: metrics.citationCoverage,
      passed: metrics.citationCoverage >= LAUNCH_GO_NO_GO_THRESHOLDS.minCitationCoverage,
    },
  ]
}

function evaluateImprovements(
  baseline: EvalMetrics,
  candidate: EvalMetrics
): ImprovementCheckResult[] {
  return [
    {
      check: 'lower unsupported-claim rate',
      baseline: baseline.unsupportedClaimRate,
      candidate: candidate.unsupportedClaimRate,
      passed: candidate.unsupportedClaimRate < baseline.unsupportedClaimRate,
    },
    {
      check: 'higher refusal precision',
      baseline: baseline.refusalPrecision,
      candidate: candidate.refusalPrecision,
      passed: candidate.refusalPrecision > baseline.refusalPrecision,
    },
    {
      check: 'equal or better persona consistency',
      baseline: baseline.personaStyleConsistencyScore,
      candidate: candidate.personaStyleConsistencyScore,
      passed:
        candidate.personaStyleConsistencyScore >=
        baseline.personaStyleConsistencyScore,
    },
  ]
}

function evaluateLatencyAndCost(
  baselineScorecard: EvalScorecard,
  candidateScorecard: EvalScorecard
): ImprovementCheckResult {
  const baselineP95 = baselineScorecard.runtimeSummary?.p95LatencyMs ?? Number.POSITIVE_INFINITY
  const baselineMeanTokens =
    baselineScorecard.runtimeSummary?.meanTokensPerResponse ?? Number.POSITIVE_INFINITY

  const candidateP95 = candidateScorecard.runtimeSummary?.p95LatencyMs ?? Number.POSITIVE_INFINITY
  const candidateMeanTokens =
    candidateScorecard.runtimeSummary?.meanTokensPerResponse ?? Number.POSITIVE_INFINITY

  const meetsAbsoluteThreshold =
    candidateP95 <= LAUNCH_GO_NO_GO_THRESHOLDS.maxP95LatencyMs &&
    candidateMeanTokens <= LAUNCH_GO_NO_GO_THRESHOLDS.maxMeanTokensPerResponse

  const meetsRelativeThreshold =
    candidateP95 <= baselineP95 && candidateMeanTokens <= baselineMeanTokens

  return {
    check: 'acceptable latency/cost',
    baseline: baselineP95 + baselineMeanTokens,
    candidate: candidateP95 + candidateMeanTokens,
    passed: meetsAbsoluteThreshold && meetsRelativeThreshold,
  }
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2))

  const baselineScorecard = readJsonFile<EvalScorecard>(options.baselinePath)
  const candidateScorecard = readJsonFile<EvalScorecard>(options.candidatePath)

  const thresholdChecks = evaluateThresholds(candidateScorecard.metrics)
  const improvementChecks = evaluateImprovements(
    baselineScorecard.metrics,
    candidateScorecard.metrics
  )
  improvementChecks.push(
    evaluateLatencyAndCost(baselineScorecard, candidateScorecard)
  )

  const decision: 'GO' | 'NO_GO' =
    thresholdChecks.every(check => check.passed) &&
    improvementChecks.every(check => check.passed)
      ? 'GO'
      : 'NO_GO'

  const report: GoNoGoReport = {
    generatedAt: new Date().toISOString(),
    baselineRunLabel: baselineScorecard.runLabel,
    candidateRunLabel: candidateScorecard.runLabel,
    thresholds: thresholdChecks,
    improvements: improvementChecks,
    decision,
  }

  writeJsonFile(options.outputPath, report)

  console.log('[EvalGoNoGo] Decision:', decision)
  console.log('[EvalGoNoGo] Report path:', path.relative(process.cwd(), resolvePath(options.outputPath)))
}

main().catch(error => {
  console.error('[EvalGoNoGo] failed')
  console.error(error)
  process.exit(1)
})
