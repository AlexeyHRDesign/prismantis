import { build } from 'esbuild'
import { mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir, cpus } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = new URL('..', import.meta.url).pathname
const out = join(mkdtempSync(join(tmpdir(), 'prismantis-bench-')), 'bench.js')

await build({
  stdin: {
    contents: [
      "export { parse } from './hooks/markdown.ts'",
      "export { renderBlocks } from './hooks/render.tsx'",
      "export { mermaidText, boxArt } from './hooks/mermaid.tsx'",
      "export { resolveStyle } from './hooks/theme.ts'",
    ].join('\n'),
    resolveDir: ROOT,
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'node',
  jsx: 'transform',
  jsxFactory: 'h',
  jsxFragment: 'Fragment',
  outfile: out,
  logLevel: 'error',
})

globalThis.h = (type, props, ...children) => ({ type, props, children })
globalThis.Fragment = 'Fragment'
const { parse, renderBlocks, mermaidText, boxArt, resolveStyle } = await import(pathToFileURL(out).href)

const demo = readFileSync(join(ROOT, 'docs/demo.md'), 'utf8')
const el = { Box: 'Box', Text: 'Text', Button: 'Button' }
const style = resolveStyle({ theme: 'dracula' })
const columns = 200
const RUNS = Number(process.env.RUNS ?? 200)

const reply = text => {
  const blocks = parse(text, { numbers: true, paths: true })
  const drawn = new Map()
  for (const [i, block] of blocks.entries()) {
    if (block.kind !== 'code' || block.lang !== 'mermaid') continue
    const art = mermaidText(block.lines.join('\n'), false, columns)
    if (art !== null) drawn.set(i, { element: boxArt(el, style, art, `b${i}`), art })
  }
  return renderBlocks(el, style, blocks, columns, drawn, () => null)
}

const stats = samples => {
  const s = [...samples].sort((a, b) => a - b)
  const at = q => s[Math.min(s.length - 1, Math.floor(q * s.length))]
  return { median: at(0.5).toFixed(3), p95: at(0.95).toFixed(3) }
}

const time = (label, fn) => {
  const samples = []
  for (let i = 0; i < RUNS; i++) {
    const t = performance.now()
    fn(i)
    samples.push(performance.now() - t)
  }
  return { stage: label, ...stats(samples) }
}

const blocks = parse(demo, { numbers: true, paths: true })
const charts = blocks.filter(b => b.kind === 'code' && b.lang === 'mermaid').map(b => b.lines.join('\n'))
const arts = charts.map(c => mermaidText(c, false, columns))

const rows = [
  time('parse (cold)', i => parse(`${demo}\n${i}`, { numbers: true, paths: true })),
  time('mermaid layout, 4 diagrams (cold)', i => charts.forEach(c => mermaidText(`${c}\n%% ${i}`, false, columns))),
  time('mermaid paint, 4 diagrams', () => arts.forEach((a, k) => a && boxArt(el, style, a, `b${k}`))),
  time('full reply (cold caches)', i => reply(`${demo}\n${i}`)),
  time('full reply (warm caches)', () => reply(demo)),
]

console.log(`node ${process.version}, ${cpus()[0]?.model ?? 'cpu'}, ${RUNS} runs, ms per call`)
console.table(rows)
