import { build } from 'esbuild'
import { readFileSync } from 'node:fs'

const XYCHART = /beautiful-mermaid\/src\/ascii\/xychart\.ts$/
const SIZE = ['const PLOT_WIDTH = 60', 'const PLOT_HEIGHT = 20']

const PRISM_LANGUAGES = ['clike', 'markup', 'css', 'javascript', 'typescript', 'jsx', 'tsx', 'python', 'go', 'rust', 'java', 'kotlin', 'swift', 'c', 'cpp', 'csharp', 'ruby', 'json', 'yaml', 'toml', 'sql', 'diff', 'docker', 'hcl']

await build({
  stdin: {
    contents: [
      "const Prism = require('./node_modules/prismjs/components/prism-core.js')",
      'globalThis.Prism = Prism',
      ...PRISM_LANGUAGES.map(l => `require('./node_modules/prismjs/components/prism-${l}.js')`),
      'export const languages = Prism.languages',
      'export const tokenize = (code, grammar) => Prism.tokenize(code, grammar)',
    ].join('\n'),
    resolveDir: '.',
    loader: 'js',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2023',
  minifySyntax: true,
  minifyWhitespace: true,
  outfile: 'hooks/vendor/prism.js',
  legalComments: 'none',
})

await build({
  stdin: {
    contents: [
      "export { renderMermaidAscii } from './node_modules/beautiful-mermaid/src/ascii/index.ts'",
      "export { setChartSize } from './node_modules/beautiful-mermaid/src/ascii/xychart.ts'",
    ].join('\n'),
    resolveDir: '.',
    loader: 'ts',
  },
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  target: 'es2023',
  minifySyntax: true,
  minifyWhitespace: true,
  outfile: 'hooks/vendor/mermaid-text.js',
  legalComments: 'none',
  plugins: [{
    name: 'chart-size',
    setup(api) {
      api.onLoad({ filter: XYCHART }, args => {
        let src = readFileSync(args.path, 'utf8')
        for (const line of SIZE) {
          if (!src.includes(line)) throw new Error(`xychart.ts no longer has "${line}"`)
          src = src.replace(line, line.replace('const', 'let'))
        }
        src += '\nexport const setChartSize = (width: number, height: number) => { PLOT_WIDTH = width; PLOT_HEIGHT = height }\n'
        return { contents: src, loader: 'ts' }
      })
    },
  }],
})
