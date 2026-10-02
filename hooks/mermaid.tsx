import type { ElementTable, RenderElement } from 'claude-code'

import type { Style } from './theme'
import { renderMermaidAscii, setChartSize } from './vendor/mermaid-text.js'

const MAX_LINES = 80
const textCache = new Map<string, string | null>()

export const chartSize = (columns: number) => {
  const width = Math.max(24, Math.min(60, Math.floor(columns / 6)))
  return { width, height: Math.max(8, Math.min(20, Math.round(width * 0.3))) }
}

export const mermaidText = (source: string, ascii: boolean, columns: number): string | null => {
  if (source.split('\n').length > MAX_LINES) return null
  const isChart = /^\s*xychart/.test(source)
  const size = chartSize(columns)
  const key = `${ascii}:${isChart ? size.width : 0}:${source}`
  if (!textCache.has(key)) {
    try {
      if (isChart) setChartSize(size.width, size.height)
      const art = renderMermaidAscii(source, { useAscii: ascii, colorMode: 'none', paddingX: 3, paddingY: 1 }).replace(/[ \t]+$/gm, '').trimEnd()
      textCache.set(key, isChart ? art : art.split('\n').filter(l => !/^[\s│|]*$/.test(l)).join('\n'))
    } catch {
      textCache.set(key, null)
    }
  }
  return textCache.get(key) ?? null
}

const LINE = /[─-╿◇]/
const ARROW = /[►◄▲▼▶◀]/

const paint = (art: string, style: Style): (string | undefined)[][] => {
  const t = style.theme
  const grid = art.split('\n').map(l => [...l])
  const cell = (r: number, c: number) => grid[r]?.[c] ?? ''
  const color: (string | undefined)[][] = grid.map(row => row.map(() => undefined))
  const palette = [...new Set([t.link, t.number, t.heading, t.emphasis, t.path, t.codeFlag, t.accent])].filter((c): c is string => c !== undefined)
  const next = (i: number) => palette[i % palette.length]
  const labels = new Map<string, string | undefined>()

  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < (grid[r]?.length ?? 0); c++) {
      if (cell(r, c) !== '┌') continue
      let c2 = c + 1
      while (/[─┬┴]/.test(cell(r, c2))) c2++
      if (cell(r, c2) !== '┐') continue
      let r2 = r + 1
      while (/[│├┤]/.test(cell(r2, c))) r2++
      if (cell(r2, c) !== '└' || cell(r2, c2) !== '┘') continue
      const label = grid.slice(r + 1, r2).map(row => row.slice(c + 1, c2).join('')).join(' ').trim()
      if (!labels.has(label)) labels.set(label, next(labels.size))
      const hue = labels.get(label)
      for (let y = r; y <= r2; y++) for (let x = c; x <= c2; x++) if (cell(y, x).trim()) color[y]![x] = hue
    }
  }

  const bars = [...new Set(grid.flatMap(row => row.flatMap((ch, c) => (ch === '█' && row[c - 1] !== '█' ? [c] : []))))].sort((a, b) => a - b)
  grid.forEach((row, r) =>
    row.forEach((ch, c) => {
      if (color[r]![c] !== undefined) return
      if (ch === '█') {
        let start = c
        while (row[start - 1] === '█') start--
        color[r]![c] = next(bars.indexOf(start))
      } else if (ch === '·') color[r]![c] = t.rule
      else if (ARROW.test(ch)) color[r]![c] = t.accent
      else if (LINE.test(ch)) color[r]![c] = t.diagram
      else if (/^\d+[┤┼]/.test(row.slice(c).join(''))) color[r]![c] = t.number
      else color[r]![c] = t.diagramText
    }),
  )
  return color
}

export const boxArt = ({ Box, Text }: ElementTable, style: Style, art: string, key: string): RenderElement => {
  const colors = paint(art, style)
  return (
    <Box key={key} flexDirection="column" paddingLeft={2}>
      {art.split('\n').map((line, i) => {
        const chars = [...line]
        const parts: RenderElement[] = []
        let at = 0
        while (at < chars.length) {
          const hue = colors[i]?.[at]
          let end = at + 1
          while (end < chars.length && colors[i]?.[end] === hue) end++
          parts.push(<Text key={`t${parts.length}`} color={hue}>{chars.slice(at, end).join('')}</Text>)
          at = end
        }
        return <Text key={`${key}.${i}`}>{parts.length ? parts : ' '}</Text>
      })}
    </Box>
  )
}
