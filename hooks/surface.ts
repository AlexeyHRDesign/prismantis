import { paint } from './mermaid'
import { PRESETS } from './presets'
import type { Style, Theme } from './theme'
import type { ChartColors } from './vendor/chart-svg.js'
import { layoutXYChart, parseXYChart, renderXYChartSvg } from './vendor/chart-svg.js'

type Rgb = [number, number, number]

const NAMED: Record<string, string> = {
  black: '#000000', red: '#cd3131', green: '#0dbc79', yellow: '#e5e510', blue: '#2472c8', magenta: '#bc3fbc', cyan: '#11a8cd', white: '#e5e5e5',
  gray: '#666666', grey: '#666666', blackbright: '#666666', redbright: '#f14c4c', greenbright: '#23d18b', yellowbright: '#f5f543',
  bluebright: '#3b8eea', magentabright: '#d670d6', cyanbright: '#29b8db', whitebright: '#ffffff',
}

const ANSI = [0, 95, 135, 175, 215, 255]
const ANSI16 = ['black', 'red', 'green', 'yellow', 'blue', 'magenta', 'cyan', 'white', 'blackbright', 'redbright', 'greenbright', 'yellowbright', 'bluebright', 'magentabright', 'cyanbright', 'whitebright']

export const toRgb = (color: string): Rgb | null => {
  const c = color.trim().toLowerCase()
  const named = NAMED[c]
  if (named) return toRgb(named)
  const short = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/.exec(c)
  if (short) return [parseInt(short[1]! + short[1], 16), parseInt(short[2]! + short[2], 16), parseInt(short[3]! + short[3], 16)]
  const long = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(c)
  if (long) return [parseInt(long[1]!, 16), parseInt(long[2]!, 16), parseInt(long[3]!, 16)]
  const rgb = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/.exec(c)
  if (rgb) return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])].map(v => Math.min(255, v)) as Rgb
  const ansi = /^ansi256\((\d{1,3})\)$/.exec(c)
  if (ansi) {
    const n = Number(ansi[1])
    if (n < 16) return toRgb(ANSI16[n]!)
    if (n >= 232) return [8 + (n - 232) * 10, 8 + (n - 232) * 10, 8 + (n - 232) * 10]
    const i = n - 16
    return [ANSI[Math.floor(i / 36)]!, ANSI[Math.floor(i / 6) % 6]!, ANSI[i % 6]!]
  }
  return null
}

const hex = ([r, g, b]: Rgb) => `#${[r, g, b].map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('')}`

export const luminance = ([r, g, b]: Rgb): number => {
  const lin = (v: number) => {
    const s = v / 255
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}

export const contrast = (a: Rgb, b: Rgb): number => {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p) as [number, number]
  return (x + 0.05) / (y + 0.05)
}

const toHsl = ([r, g, b]: Rgb): [number, number, number] => {
  const [R, G, B] = [r / 255, g / 255, b / 255]
  const max = Math.max(R, G, B)
  const min = Math.min(R, G, B)
  const l = (max + min) / 2
  if (max === min) return [0, 0, l]
  const d = max - min
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
  const h = max === R ? (G - B) / d + (G < B ? 6 : 0) : max === G ? (B - R) / d + 2 : (R - G) / d + 4
  return [h / 6, s, l]
}

const fromHsl = ([h, s, l]: [number, number, number]): Rgb => {
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t
    if (u < 1 / 6) return p + (q - p) * 6 * u
    if (u < 1 / 2) return q
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6
    return p
  }
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255]
}

export const LIGHT_BG: Rgb = [255, 255, 255]
export const DARK_BG: Rgb = [31, 30, 29]
const MIN_CONTRAST = 3.6

export const readable = (color: string | undefined): string | undefined => {
  if (color === undefined) return undefined
  const rgb = toRgb(color)
  if (!rgb) return color
  const ok = (c: Rgb) => contrast(c, LIGHT_BG) >= MIN_CONTRAST && contrast(c, DARK_BG) >= MIN_CONTRAST
  if (ok(rgb)) return hex(rgb)
  const [h, s, l] = toHsl(rgb)
  const sat = Math.min(1, Math.max(s, 0.45))
  let best: Rgb = fromHsl([h, sat, 0.5])
  let bestScore = -1
  for (let step = 0; step <= 100; step++) {
    const candidate = fromHsl([h, sat, step / 100])
    const score = Math.min(contrast(candidate, LIGHT_BG), contrast(candidate, DARK_BG)) - Math.abs(step / 100 - l) * 0.01
    if (score > bestScore) {
      bestScore = score
      best = candidate
    }
  }
  return hex(best)
}

const TEXT_TOKENS = new Set(['strong', 'codeText', 'diagramText'])

export const adaptTheme = (theme: Theme): Theme =>
  Object.fromEntries(Object.entries(theme).map(([k, v]) => [k, TEXT_TOKENS.has(k) ? undefined : readable(v)])) as Theme

const PAIRS: Record<string, string> = {
  'catppuccin-mocha': 'catppuccin-latte', 'gruvbox-dark': 'gruvbox-light', 'rose-pine': 'rose-pine-dawn',
  'github-dark': 'github-light', 'solarized-dark': 'solarized-light',
}

const isDark = (theme: Theme) => {
  const text = toRgb(theme.codeText ?? theme.diagramText ?? '#cdd6f4')
  return text ? luminance(text) > 0.4 : true
}

const preset = (name: string): Theme => (PRESETS as Record<string, Theme>)[name] ?? {}

export type Schemes = { light: Theme; dark: Theme }

export const schemesFor = (name: string, theme: Theme): Schemes => {
  const pair = PAIRS[name] ?? Object.entries(PAIRS).find(([, light]) => light === name)?.[0]
  if (name === 'mono' || Object.keys(theme).length === 0) return { light: preset('catppuccin-latte'), dark: preset('catppuccin-mocha') }
  if (isDark(theme)) return { dark: theme, light: pair ? { ...preset(pair) } : preset('catppuccin-latte') }
  return { light: theme, dark: pair ? { ...preset(pair) } : preset('catppuccin-mocha') }
}

export const PILL = { bg: '#2b2a29', fg: '#e8e6e3' }

const LIGHT_PAGE = { bg: '#ffffff', fg: '#3d3d3a' }
const DARK_PAGE = { bg: '#1f1e1d', fg: '#e8e6e3' }

const chartColors = (theme: Theme, page: { bg: string; fg: string }): ChartColors => ({
  bg: page.bg,
  fg: page.fg,
  accent: theme.diagram ?? theme.accent ?? '#3b82f6',
  line: theme.rule,
  muted: theme.quote,
})

const scope = (svg: string, cls: string) =>
  svg
    .replace(/@import url\([^)]*\);?/g, '')
    .replace(/<svg /, `<svg class="${cls}" `)
    .replace(/(^|\n)(\s*)svg \{/g, `$1$2svg.${cls} {`)
    .replace(/:root\s*\{/g, `svg.${cls} {`)

const pair = (light: string, dark: string, width: number, height: number) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`
  + '<style>svg.pm-dark{display:none}@media (prefers-color-scheme: dark){svg.pm-light{display:none}svg.pm-dark{display:inline}}</style>'
  + `${scope(light, 'pm-light')}${scope(dark, 'pm-dark')}</svg>`

export const chartSvg = (source: string, schemes: Schemes): string | null => {
  const lines = source.split('\n').map(l => l.trim()).filter(l => l.length > 0 && !l.startsWith('%%'))
  if (!/^xychart(-beta)?\b/.test(lines[0] ?? '')) return null
  try {
    const chart = layoutXYChart(parseXYChart(lines))
    const font = 'system-ui'
    const light = renderXYChartSvg(chart, chartColors(adaptTheme(schemes.light), LIGHT_PAGE), font, true, true)
    const dark = renderXYChartSvg(chart, chartColors(schemes.dark, DARK_PAGE), font, true, true)
    return pair(light, dark, Math.ceil(chart.width), Math.ceil(chart.height))
  } catch {
    return null
  }
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const FONT = 14
const ADVANCE = 0.6
const LINE = 1.25

export const artSvg = (art: string, style: Style, schemes: Schemes): string => {
  const rows = art.split('\n')
  const cols = Math.max(1, ...rows.map(r => [...r].length))
  const lightColors = paint(art, { ...style, theme: adaptTheme(schemes.light) })
  const darkColors = paint(art, { ...style, theme: schemes.dark })
  const classes = new Map<string, number>()
  const cls = (light: string | undefined, dark: string | undefined) => {
    const k = `${light ?? ''}|${dark ?? ''}`
    if (!classes.has(k)) classes.set(k, classes.size)
    return `c${classes.get(k)}`
  }
  const width = Math.ceil(cols * FONT * ADVANCE) + 4
  const height = Math.ceil(rows.length * FONT * LINE) + 6
  const body = rows.map((row, y) => {
    const chars = [...row]
    const spans: string[] = []
    let at = 0
    while (at < chars.length) {
      const l = lightColors[y]?.[at]
      const d = darkColors[y]?.[at]
      let end = at + 1
      while (end < chars.length && lightColors[y]?.[end] === l && darkColors[y]?.[end] === d) end++
      spans.push(`<tspan class="${cls(l, d)}">${esc(chars.slice(at, end).join(''))}</tspan>`)
      at = end
    }
    const fit = chars.length ? ` textLength="${(chars.length * FONT * ADVANCE).toFixed(1)}" lengthAdjust="spacingAndGlyphs"` : ''
    return `<text x="2" y="${Math.round((y + 1) * FONT * LINE)}"${fit}>${spans.join('')}</text>`
  }).join('')
  const rules = [...classes.entries()].map(([k, n]) => {
    const [l, d] = k.split('|')
    return { n, l: l || LIGHT_PAGE.fg, d: d || DARK_PAGE.fg }
  })
  const css = `text{font-family:ui-monospace,'Cascadia Mono',Consolas,'SF Mono',Menlo,monospace;font-size:${FONT}px;white-space:pre}`
    + rules.map(r => `.c${r.n}{fill:${r.l}}`).join('')
    + `@media (prefers-color-scheme: dark){${rules.map(r => `.c${r.n}{fill:${r.d}}`).join('')}}`
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" xml:space="preserve"><style>${css}</style>${body}</svg>`
}

const adapted = new WeakMap<Style, { theme: Theme; schemes: Schemes }>()

export const forSurface = (style: Style, surface: string): Style => {
  if (surface === 'terminal') return style
  const hit = adapted.get(style) ?? { theme: adaptTheme(style.theme), schemes: schemesFor(style.themeName, style.theme) }
  adapted.set(style, hit)
  return { ...style, theme: hit.theme, proportional: true, pill: PILL, schemes: hit.schemes }
}

export const svgWidth = (svg: string): number => Number(/width="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 480)

export type Frame = { zoom: number; x: number; y: number }

const SLOT = 4000
const MIN_WIDTH = 760
const MIN_ASPECT = 2.4

export const frame = (svg: string, view: Frame = { zoom: 1, x: 0.5, y: 0.5 }): string => {
  const w = svgWidth(svg)
  const h = Number(/height="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 300)
  const full = Math.max(w, h * MIN_ASPECT, MIN_WIDTH)
  const vw = full / view.zoom
  const vh = h / view.zoom
  const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v))
  const x = clamp(view.x * full - vw / 2, full - vw)
  const y = clamp(view.y * h - vh / 2, h - vh)
  const height = Math.round((SLOT * vh) / vw)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x.toFixed(1)} ${y.toFixed(1)} ${vw.toFixed(1)} ${vh.toFixed(1)}" width="${SLOT}" height="${height}">`
    + svg.replace(/^<svg([^>]*?)\swidth="[^"]*"\sheight="[^"]*"/, `<svg$1 x="${((full - w) / 2).toFixed(1)}" y="0" width="${w}" height="${h}"`)
    + '</svg>'
}
