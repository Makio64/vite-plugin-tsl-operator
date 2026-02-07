import { createRequire } from 'module'
import { performance } from 'perf_hooks'
import TSLOperatorPlugin from '../src/index.js'

const require = createRequire(import.meta.url)
const { parse } = require('@babel/parser')
const traverse = require('@babel/traverse').default
const generate = require('@babel/generator').default

// --- Test input generators ---

const makeExpressions = count => {
  const ops = ['+', '-', '*', '/', '%']
  const vars = ['a', 'b', 'c', 'd', 'uv', 'normal', 'position', 'color']
  const lines = []
  for (let i = 0; i < count; i++) {
    const v1 = vars[i % vars.length]
    const v2 = vars[(i + 1) % vars.length]
    const op = ops[i % ops.length]
    if (i % 5 === 0) {
      lines.push(`  const r${i} = ${v1} ${op} ${v2} ${op} float(${i + 1})`)
    } else if (i % 5 === 1) {
      lines.push(`  ${v1} += ${v2}`)
    } else if (i % 5 === 2) {
      lines.push(`  const r${i} = (${v1} ${op} 2) ${ops[(i + 2) % ops.length]} (${v2} ${op} 3)`)
    } else if (i % 5 === 3) {
      lines.push(`  const r${i} = vec3(${v1} ${op} ${v2}, ${v2}, ${v1})`)
    } else {
      lines.push(`  const r${i} = ${v1} ${op} ${v2}`)
    }
  }
  return lines.join('\n')
}

const makeFnBlock = (exprCount, idx) => {
  const params = ['a', 'b', 'c', 'd'].slice(0, Math.min(4, Math.max(2, idx % 4 + 1)))
  return `const shader${idx} = Fn((${params.join(', ')}) => {\n${makeExpressions(exprCount)}\n  return a\n})`
}

const makeInput = (fnCount, exprsPerFn) => {
  const imports = `import { Fn, float, vec3, vec4 } from 'three/tsl'\n`
  const blocks = []
  for (let i = 0; i < fnCount; i++) {
    blocks.push(makeFnBlock(exprsPerFn, i))
  }
  return imports + blocks.join('\n\n')
}

const parserPlugins = ['jsx', 'typescript', 'classProperties', 'decorators-legacy', 'importMeta', 'topLevelAwait']

// --- Profiling ---

const profilePhases = (code, iterations) => {
  const timings = { parse: 0, directives: 0, traverse: 0, generate: 0, total: 0 }

  // Warmup
  const plugin = TSLOperatorPlugin({ logs: false })
  for (let i = 0; i < 5; i++) plugin.transform(code, 'warmup.js')

  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()

    // Phase 1: Parse
    const p0 = performance.now()
    const ast = parse(code, { sourceType: 'module', plugins: parserPlugins })
    const p1 = performance.now()
    timings.parse += p1 - p0

    // Phase 2: Directives (inline — just scan for @tsl/@js)
    const d0 = performance.now()
    const lower = code.toLowerCase()
    lower.includes('@tsl') || lower.includes('@js')
    const d1 = performance.now()
    timings.directives += d1 - d0

    // Phase 3: Traverse (use the plugin's full transform for this, minus parse/generate)
    const tr0 = performance.now()
    traverse(ast, {
      CallExpression(path) {
        // Minimal check to match the plugin's behavior
        if (!path.node.callee?.name || path.node.callee.name !== 'Fn') return
      }
    })
    const tr1 = performance.now()
    timings.traverse += tr1 - tr0

    // Phase 4: Generate
    const g0 = performance.now()
    generate(ast, { retainLines: true }, code)
    const g1 = performance.now()
    timings.generate += g1 - g0

    timings.total += performance.now() - t0
  }

  return timings
}

const profileFullTransform = (code, iterations) => {
  const plugin = TSLOperatorPlugin({ logs: false })

  // Warmup
  for (let i = 0; i < 5; i++) plugin.transform(code, 'warmup.js')

  let total = 0
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now()
    plugin.transform(code, 'bench.js')
    total += performance.now() - t0
  }
  return total
}

const formatMs = (ms) => ms.toFixed(3).padStart(8)
const formatPct = (pct) => (pct.toFixed(1) + '%').padStart(7)

const printResults = (label, timings, iterations) => {
  const phases = ['parse', 'directives', 'traverse', 'generate']
  const total = timings.total / iterations

  console.log(`\n=== ${label} — avg over ${iterations} runs ===`)
  console.log(`${'Phase'.padEnd(24)} ${'Avg (ms)'.padStart(10)} ${'% of total'.padStart(10)}`)
  console.log('-'.repeat(46))

  for (const phase of phases) {
    const avg = timings[phase] / iterations
    const pct = (avg / total) * 100
    console.log(`${phase.padEnd(24)} ${formatMs(avg)} ${formatPct(pct)}`)
  }

  console.log('-'.repeat(46))
  console.log(`${'TOTAL (phases)'.padEnd(24)} ${formatMs(total)} ${formatPct(100)}`)
}

// --- Run ---

const scenarios = [
  { label: 'Small  (1 Fn, 5 expr)',   fnCount: 1,  exprs: 5,   iterations: 500 },
  { label: 'Medium (5 Fn, 10 expr)',   fnCount: 5,  exprs: 10,  iterations: 200 },
  { label: 'Large  (20 Fn, 15 expr)',  fnCount: 20, exprs: 15,  iterations: 100 },
]

console.log('TSL Operator Plugin — Performance Profile')
console.log('==========================================')

for (const { label, fnCount, exprs, iterations } of scenarios) {
  const code = makeInput(fnCount, exprs)
  console.log(`\nInput: ${code.split('\n').length} lines, ${code.length} chars`)

  // Phase breakdown (individual Babel calls)
  const phaseTimings = profilePhases(code, iterations)
  printResults(`${label} — Phase Breakdown`, phaseTimings, iterations)

  // Full plugin transform (end-to-end including actual transformations)
  const fullTime = profileFullTransform(code, iterations)
  const avgFull = fullTime / iterations
  console.log(`\n  Full plugin transform:  ${formatMs(avgFull)} ms/call`)

  // Delta = time spent in actual TSL transformation logic
  const phaseTotal = phaseTimings.total / iterations
  const delta = avgFull - phaseTotal
  if (delta > 0) {
    console.log(`  TSL transform overhead: ${formatMs(delta)} ms/call (${formatPct((delta / avgFull) * 100)} of full)`)
  }
}

console.log('\n')
