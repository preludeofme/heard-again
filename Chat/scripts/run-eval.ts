import fs from 'fs'
import path from 'path'
import {
  compareScorecards,
  evaluateRun,
  EvalBenchmark,
  EvalRun,
} from '../src/services/eval/EvaluationHarness'

interface CliOptions {
  benchmarkPath: string
  baselinePath: string
  candidatePath?: string
  outputDir: string
}

function parseCliArgs(argv: string[]): CliOptions {
  const args = [...argv]

  let benchmarkPath = 'evals/benchmark.v1.json'
  let baselinePath = 'evals/responses/baseline.current.json'
  let candidatePath: string | undefined
  let outputDir = 'evals/results'

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i]

    if (token === '--benchmark' && args[i + 1]) {
      benchmarkPath = args[i + 1]
      i += 1
      continue
    }

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

    if ((token === '--output-dir' || token === '--out') && args[i + 1]) {
      outputDir = args[i + 1]
      i += 1
    }
  }

  return {
    benchmarkPath,
    baselinePath,
    candidatePath,
    outputDir,
  }
}

function resolvePath(inputPath: string): string {
  if (path.isAbsolute(inputPath)) {
    return inputPath
  }

  return path.resolve(process.cwd(), inputPath)
}

function ensureDirectory(directoryPath: string): void {
  if (!fs.existsSync(directoryPath)) {
    fs.mkdirSync(directoryPath, { recursive: true })
  }
}

function readJsonFile<T>(filePath: string): T {
  const resolved = resolvePath(filePath)
  const fileContents = fs.readFileSync(resolved, 'utf8')
  return JSON.parse(fileContents) as T
}

function sanitizeFileToken(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function writeJsonFile(targetPath: string, payload: unknown): void {
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
}

function writeScorecard(outputDir: string, scorecard: unknown, runLabel: string): string {
  const safeRunLabel = sanitizeFileToken(runLabel)
  const filePath = path.join(outputDir, `${safeRunLabel}.scorecard.json`)
  writeJsonFile(filePath, scorecard)
  return filePath
}

async function main(): Promise<void> {
  const options = parseCliArgs(process.argv.slice(2))

  const benchmark = readJsonFile<EvalBenchmark>(options.benchmarkPath)
  const baselineRun = readJsonFile<EvalRun>(options.baselinePath)
  const candidateRun = options.candidatePath
    ? readJsonFile<EvalRun>(options.candidatePath)
    : undefined

  const resolvedOutputDir = resolvePath(options.outputDir)
  ensureDirectory(resolvedOutputDir)

  const baselineScorecard = evaluateRun(benchmark, baselineRun)
  const baselinePath = writeScorecard(
    resolvedOutputDir,
    baselineScorecard,
    baselineRun.runLabel
  )

  console.log(`Baseline scorecard written: ${path.relative(process.cwd(), baselinePath)}`)
  console.log('Baseline metrics:', baselineScorecard.metrics)

  if (!candidateRun) {
    return
  }

  const candidateScorecard = evaluateRun(benchmark, candidateRun)
  const candidatePath = writeScorecard(
    resolvedOutputDir,
    candidateScorecard,
    candidateRun.runLabel
  )

  const comparison = compareScorecards(baselineScorecard, candidateScorecard)
  const comparisonFile = path.join(
    resolvedOutputDir,
    `${sanitizeFileToken(baselineRun.runLabel)}-vs-${sanitizeFileToken(candidateRun.runLabel)}.comparison.json`
  )

  writeJsonFile(comparisonFile, comparison)

  console.log(`Candidate scorecard written: ${path.relative(process.cwd(), candidatePath)}`)
  console.log(`Comparison written: ${path.relative(process.cwd(), comparisonFile)}`)
  console.log('Candidate metrics:', candidateScorecard.metrics)
  console.log('Metric deltas (candidate - baseline):', comparison.delta)
}

main().catch(error => {
  console.error('[EvalHarness] failed to run evaluation harness')
  console.error(error)
  process.exit(1)
})
