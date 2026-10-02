import type { ElementTable, RenderElement } from 'claude-code'

import type { Block, Inline } from './markdown'
import { inlineText } from './markdown'
import type { Style, Theme } from './theme'
import type { PrismToken } from './vendor/prism.js'
import { languages, tokenize } from './vendor/prism.js'

const WIDE = /[\u1100-\u115F\u2E80-\uA4CF\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]|\p{Extended_Pictographic}/u
const segmenter = typeof Intl !== 'undefined' && 'Segmenter' in Intl ? new Intl.Segmenter() : undefined

export const width = (s: string): number => {
  const graphemes = segmenter ? [...segmenter.segment(s)].map(g => g.segment) : [...s]
  return graphemes.reduce((w, g) => (/^\p{M}+$/u.test(g) ? w : w + (WIDE.test(g) ? 2 : 1)), 0)
}

const renderInline = (el: ElementTable, style: Style, nodes: Inline[], keyBase: string): RenderElement[] => {
  const { Text } = el
  const t = style.theme
  return nodes.map((n, i) => {
    const key = `${keyBase}.${i}`
    switch (n.kind) {
      case 'text':
        return <Text key={key}>{n.text}</Text>
      case 'strong':
        return <Text key={key} bold color={t.strong}>{renderInline(el, style, n.children, key)}</Text>
      case 'emphasis':
        return <Text key={key} italic color={t.emphasis}>{renderInline(el, style, n.children, key)}</Text>
      case 'strike':
        return <Text key={key} strikethrough dimColor>{renderInline(el, style, n.children, key)}</Text>
      case 'code':
        return <Text key={key} color={t.inlineCode}>{n.text}</Text>
      case 'link':
        return n.text === n.href
          ? <Text key={key} color={t.link} underline>{n.href}</Text>
          : <Text key={key}><Text color={t.link} underline>{n.text}</Text><Text dimColor> ({n.href})</Text></Text>
      case 'number':
        return <Text key={key} color={t.number}>{n.text}</Text>
      case 'path':
        return <Text key={key} color={t.path}>{n.text}</Text>
    }
  })
}

const PRISM_COLORS: Record<string, keyof Theme> = {
  comment: 'codeComment', prolog: 'codeComment', doctype: 'codeComment', cdata: 'codeComment',
  string: 'codeString', char: 'codeString', 'template-string': 'codeString', 'attr-value': 'codeString', url: 'codeString',
  number: 'number', boolean: 'number', constant: 'number', symbol: 'number', inserted: 'number',
  keyword: 'codeFlag', important: 'codeFlag', atrule: 'codeFlag', rule: 'codeFlag', deleted: 'codeFlag',
  function: 'codeCommand', 'class-name': 'codeCommand', builtin: 'codeCommand', key: 'codeCommand', selector: 'codeCommand',
  property: 'link', tag: 'link', 'attr-name': 'emphasis', variable: 'emphasis', regex: 'path',
}

type Segment = { text: string; color?: string; italic: boolean }

const flatten = (tokens: PrismToken[], style: Style, color?: string, italic = false): Segment[] =>
  tokens.flatMap(token => {
    if (typeof token === 'string') return [{ text: token, color, italic }]
    const names = [token.type, ...(Array.isArray(token.alias) ? token.alias : token.alias ? [token.alias] : [])]
    const slot = names.map(n => PRISM_COLORS[n]).find(Boolean)
    const inner = Array.isArray(token.content) ? token.content : [token.content]
    return flatten(inner, style, slot ? style.theme[slot] : color, italic || token.type === 'comment')
  })

export const remember = <T,>(cache: Map<string, T>, key: string, make: () => T, limit = 200): T => {
  const hit = cache.get(key)
  if (hit !== undefined) return hit
  const value = make()
  cache.set(key, value)
  if (cache.size > limit) cache.delete(cache.keys().next().value!)
  return value
}

const highlighted = new WeakMap<Style, Map<string, Segment[][]>>()

const grammarFor = (lang: string) => {
  const name = lang.toLowerCase()
  const grammar = Object.hasOwn(languages, name) ? languages[name] : undefined
  return grammar !== null && typeof grammar === 'object' ? grammar : undefined
}

export const highlightBlock = ({ Text }: ElementTable, style: Style, lines: string[], lang: string, key: string): RenderElement[] | null => {
  const grammar = grammarFor(lang)
  if (!grammar) return null
  const code = lines.join('\n')
  const cache = highlighted.get(style) ?? new Map<string, Segment[][]>()
  highlighted.set(style, cache)
  const rows = remember(cache, `${lang}\0${code}`, () => {
    const out: Segment[][] = [[]]
    for (const seg of flatten(tokenize(code, grammar), style)) {
      seg.text.split('\n').forEach((piece, i) => {
        if (i > 0) out.push([])
        if (piece) out[out.length - 1]!.push({ ...seg, text: piece })
      })
    }
    return out
  })
  return rows.map((row, r) => (
    <Text key={`${key}.${r}`} color={style.theme.codeText}>
      {row.length ? row.map((s, i) => <Text key={`${key}.${r}.${i}`} color={s.color} italic={s.italic}>{s.text}</Text>) : ' '}
    </Text>
  ))
}

const isShellLang = (lang: string) => lang === '' || /^(sh|bash|zsh|shell|console|fish|powershell|ps1)$/i.test(lang)

export const codeLine = (el: ElementTable, style: Style, line: string, lang: string, key: string): RenderElement => {
  const { Text } = el
  const t = style.theme
  const isShell = isShellLang(lang)
  if (/[\u2500-\u257F]/.test(line)) return <Text key={key} color={t.codeText}>{line}</Text>
  if (!isShell) return <Text key={key} color={t.codeText}>{line || ' '}</Text>
  if (/^\s*#/.test(line)) return <Text key={key} color={t.codeComment}>{line}</Text>
  const parts = line.split(/("[^"]*"|'[^']*'|\s+)/).filter(p => p !== '')
  let seenCommand = false
  return (
    <Text key={key} color={t.codeText}>
      {parts.map((p, i) => {
        if (/^\s+$/.test(p)) return <Text key={`${key}.${i}`}>{p}</Text>
        if (/^["']/.test(p)) return <Text key={`${key}.${i}`} color={t.codeString}>{p}</Text>
        if (/^--?[\w-]/.test(p)) return <Text key={`${key}.${i}`} color={t.codeFlag}>{p}</Text>
        if (!seenCommand && !/^[$>|&;]+$/.test(p)) {
          seenCommand = true
          return <Text key={`${key}.${i}`} color={t.codeCommand}>{p}</Text>
        }
        if (/^(\||&&|;|\|\|)$/.test(p)) seenCommand = false
        return <Text key={`${key}.${i}`}>{p}</Text>
      })}
    </Text>
  )
}

const columnWidths = (natural: number[], available: number, gap: number): number[] => {
  const room = Math.max(natural.length, available - gap * (natural.length - 1))
  const total = natural.reduce((a, b) => a + b, 0)
  if (total <= room) return natural
  const widths = natural.map(w => Math.max(1, Math.floor((w * room) / total)))
  while (widths.reduce((a, b) => a + b, 0) > room) {
    const widest = widths.indexOf(Math.max(...widths))
    if (widths[widest]! <= 1) break
    widths[widest]!--
  }
  return widths
}

const displayText = (inline: Inline[]): string =>
  inline.map(n => (n.kind === 'link' && n.text !== n.href ? `${n.text} (${n.href})` : 'children' in n ? displayText(n.children) : n.text)).join('')

const renderTable = (el: ElementTable, style: Style, block: Extract<Block, { kind: 'table' }>, columns: number, key: string) => {
  const { Box, Text } = el
  const t = style.theme
  const gap = style.tableStyle === 'grid' ? 3 : 2
  const natural = block.header.map((h, c) =>
    Math.max(width(displayText(h)), ...block.rows.map(r => width(displayText(r[c] ?? [])))),
  )
  const widths = columnWidths(natural, columns, gap)
  const ruleChar = style.tableStyle === 'grid' ? '━' : '─'
  const justify = (c: number) =>
    block.align[c] === 'right' ? 'flex-end' : block.align[c] === 'center' ? 'center' : 'flex-start'

  const rule = (k: string, heavy: boolean) => (
    <Box key={k} flexDirection="row" columnGap={gap}>
      {widths.map((w, c) => (
        <Text key={`${k}.${c}`} color={t.tableRule} dimColor={!heavy && !t.tableRule}>
          {(heavy ? ruleChar : '─').repeat(w)}
        </Text>
      ))}
    </Box>
  )

  const row = (cells: Inline[][], k: string, isHeader: boolean) => (
    <Box key={k} flexDirection="row" columnGap={gap}>
      {widths.map((w, c) => (
        <Box key={`${k}.${c}`} width={w} flexShrink={0} justifyContent={justify(c)}>
          {isHeader
            ? <Text bold color={t.tableHeader}>{inlineText(cells[c] ?? [])}</Text>
            : <Text>{renderInline(el, style, cells[c] ?? [], `${k}.${c}`)}</Text>}
        </Box>
      ))}
    </Box>
  )

  const body: RenderElement[] = [row(block.header, `${key}.h`, true), rule(`${key}.hr`, true)]
  block.rows.forEach((r, i) => {
    body.push(row(r, `${key}.r${i}`, false))
    if (style.tableStyle !== 'minimal' && i < block.rows.length - 1) body.push(rule(`${key}.r${i}r`, false))
  })
  return <Box key={key} flexDirection="column">{body}</Box>
}

const renderHeading = (el: ElementTable, style: Style, block: Extract<Block, { kind: 'heading' }>, key: string) => {
  const { Box, Text } = el
  const t = style.theme
  const color = block.level <= 2 ? t.heading : t.accent ?? t.heading
  const label = inlineText(block.inline)
  switch (style.headingStyle) {
    case 'uppercase':
      return <Text key={key} bold color={color}>{block.level === 1 ? label.toUpperCase() : label}</Text>
    case 'underline':
      return <Text key={key} bold underline={block.level <= 2} color={color}>{label}</Text>
    case 'banner':
      return block.level <= 2
        ? <Box key={key} flexDirection="column"><Text bold color={color}>{label}</Text><Text color={t.rule} dimColor={!t.rule}>{(block.level === 1 ? '━' : '─').repeat(width(label))}</Text></Box>
        : <Text key={key} bold color={color}>{label}</Text>
    default:
      return <Text key={key} bold color={color}>{renderInline(el, style, block.inline, key)}</Text>
  }
}

export type CopyButton = (text: string, key: string, label?: string) => RenderElement | null
export type Drawn = Map<number, { element: RenderElement; art: string }>

const copySource = (block: Block): string | undefined =>
  block.kind === 'code' ? block.lines.join('\n') : block.kind === 'table' || block.kind === 'list' || block.kind === 'quote' ? block.raw : undefined

export const renderBlocks = (el: ElementTable, style: Style, blocks: Block[], columns: number, drawn: Drawn = new Map(), copy?: CopyButton): RenderElement[] => {
  const { Box, Text } = el
  const t = style.theme
  const rendered = blocks.map((block, b) => {
    const key = `b${b}`
    switch (block.kind) {
      case 'heading':
        return renderHeading(el, style, block, key)
      case 'paragraph':
        return <Text key={key}>{renderInline(el, style, block.inline, key)}</Text>
      case 'quote':
        return (
          <Box key={key} flexDirection="row">
            <Text color={t.accent}>│ </Text>
            <Text italic color={t.quote}>{renderInline(el, style, block.inline, key)}</Text>
          </Box>
        )
      case 'rule':
        return <Text key={key} color={t.rule} dimColor={!t.rule}>{'─'.repeat(Math.max(8, Math.min(columns, 80)))}</Text>
      case 'code':
        return drawn.get(b)?.element ?? (
          <Box key={key} flexDirection="column" alignSelf="flex-start">
            <Box flexDirection="row" justifyContent="space-between" columnGap={4}>
              <Text color={t.codeComment}>{`── ${block.lang || 'code'}`}</Text>
              {copy?.(block.lines.join('\n'), `copy${b}`) ?? null}
            </Box>
            <Box flexDirection="column" paddingLeft={2}>
              {(isShellLang(block.lang) ? null : highlightBlock(el, style, block.lines, block.lang, key)) ?? block.lines.map((line, i) => codeLine(el, style, line, block.lang, `${key}.${i}`))}
            </Box>
          </Box>
        )
      case 'list':
        return (
          <Box key={key} flexDirection="column">
            {block.items.map((item, i) => (
              <Box key={`${key}.${i}`} flexDirection="row" paddingLeft={item.depth * 2}>
                <Text color={t.bullet}>{/\d/.test(item.marker) ? `${item.marker} ` : item.depth ? '◦ ' : '• '}</Text>
                <Text>{renderInline(el, style, item.inline, `${key}.${i}`)}</Text>
              </Box>
            ))}
          </Box>
        )
      case 'table':
        return renderTable(el, style, block, columns, key)
    }
  })
  const copied = rendered.map((element, b) => {
    const block = blocks[b]
    const text = block ? copySource(block) : undefined
    const isPlainCode = block?.kind === 'code' && !drawn.has(b)
    const art = drawn.get(b)?.art
    const button = text === undefined || isPlainCode ? null : art === undefined ? copy?.(text, `copy${b}`) : (
      <el.Box key={`copies${b}`} flexDirection="row" columnGap={1}>
        {copy?.(text, `copy${b}`, '⧉ source')}
        {copy?.(art, `art${b}`, '⧉ art')}
      </el.Box>
    )
    if (!button) return element
    const { Box } = el
    return block?.kind === 'quote' ? (
      <Box key={`c${b}`} flexDirection="row" columnGap={2}>
        {element}
        {button}
      </Box>
    ) : (
      <Box key={`c${b}`} flexDirection="column" alignSelf="flex-start">
        <Box justifyContent="flex-end">{button}</Box>
        {element}
      </Box>
    )
  })
  const isFigure = (b: number) => blocks[b]?.kind === 'table' || drawn.has(b)
  const out: RenderElement[] = []
  for (let b = 0; b < rendered.length; b++) {
    if (!isFigure(b) || !isFigure(b + 1)) {
      out.push(copied[b]!)
      continue
    }
    const start = b
    while (isFigure(b + 1)) b++
    out.push(
      <Box key={`row${start}`} flexDirection="row" flexWrap="wrap" columnGap={4} rowGap={1}>
        {copied.slice(start, b + 1).map((figure, i) => <Box key={`f${start + i}`} flexShrink={0}>{figure}</Box>)}
      </Box>,
    )
  }
  return out
}

export type ToolRow = { tool: string; input: unknown; isRunning: boolean; isErrored: boolean; isInterrupted: boolean }

const VERBS: Record<string, string> = {
  Bash: 'Ran', PowerShell: 'Ran', Read: 'Read', Write: 'Wrote', Edit: 'Edited', MultiEdit: 'Edited', NotebookEdit: 'Edited',
  Grep: 'Searched', Glob: 'Listed', WebFetch: 'Fetched', WebSearch: 'Searched the web for', Agent: 'Delegated', Task: 'Delegated',
}

const field = (input: unknown, ...keys: string[]): string | undefined => {
  if (input === null || typeof input !== 'object') return undefined
  for (const k of keys) {
    const v = (input as Record<string, unknown>)[k]
    if (typeof v === 'string' && v.trim() !== '') return v
  }
  return undefined
}

export const renderToolRow = (el: ElementTable, style: Style, row: ToolRow): RenderElement => {
  const { Box, Text } = el
  const t = style.theme
  const isShell = row.tool === 'Bash' || row.tool === 'PowerShell'
  const verb = VERBS[row.tool] ?? row.tool.replace(/^mcp__([^_]+)__/, '$1 ')
  const target = isShell
    ? field(row.input, 'command')?.split('\n')[0]
    : field(row.input, 'file_path', 'notebook_path', 'path', 'pattern', 'url', 'query', 'description')
  const dot = row.isErrored ? t.codeFlag : row.isInterrupted ? t.codeComment : row.isRunning ? t.accent : t.number
  const isPath = target !== undefined && /^(~|\.{0,2}\/|[A-Za-z]:\\)/.test(target)

  return (
    <Box flexDirection="row">
      <Box width={2} flexShrink={0}>
        <Text color={dot}>{row.isRunning ? '◌' : '●'}</Text>
      </Box>
      <Text wrap="truncate-end">
        <Text bold>{verb}</Text>
        {target === undefined ? null : <Text> </Text>}
        {target === undefined ? null : isShell ? codeLine(el, style, target, 'bash', 'cmd') : <Text color={isPath ? t.path : t.inlineCode}>{target}</Text>}
        {row.isInterrupted ? <Text dimColor> interrupted</Text> : row.isErrored ? <Text color={t.codeFlag}> failed</Text> : null}
      </Text>
    </Box>
  )
}

const GROUPS: [RegExp, string, string][] = [
  [/^(Bash|PowerShell)$/, 'ran', 'command'],
  [/^Read$/, 'read', 'file'],
  [/^(Write|Edit|MultiEdit|NotebookEdit)$/, 'edited', 'file'],
  [/^(Grep|Glob)$/, 'searched', 'pattern'],
  [/^(WebFetch|WebSearch)$/, 'fetched', 'page'],
  [/^(Agent|Task)$/, 'delegated', 'task'],
]

export const groupSummary = (calls: readonly { tool: string }[]): string => {
  const counts = new Map<string, number>()
  for (const call of calls) {
    const [, verb, noun] = GROUPS.find(([re]) => re.test(call.tool)) ?? [, 'used', call.tool.replace(/^mcp__([^_]+)__/, '$1 ')]
    const label = `${verb} ${noun}`
    counts.set(label, (counts.get(label) ?? 0) + 1)
  }
  const parts = [...counts].map(([label, n]) => {
    const [verb, ...noun] = label.split(' ')
    const name = noun.join(' ')
    return `${verb} ${n} ${n === 1 ? name : name.endsWith('h') ? `${name}es` : `${name}s`}`
  })
  const text = parts.join(', ')
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export const renderToolGroup = (el: ElementTable, style: Style, calls: readonly ToolRow[], isActive: boolean): RenderElement => {
  const { Box, Text } = el
  const t = style.theme
  const failed = calls.filter(c => c.isErrored).length
  const running = isActive && calls.some(c => c.isRunning)
  const dot = failed ? t.codeFlag : running ? t.accent : t.number
  const last = calls[calls.length - 1]
  const lastTarget = last ? field(last.input, 'command', 'file_path', 'notebook_path', 'path', 'pattern', 'url', 'query', 'description')?.split('\n')[0] : undefined
  return (
    <Box flexDirection="row">
      <Box width={2} flexShrink={0}>
        <Text color={dot}>{running ? '◌' : '●'}</Text>
      </Box>
      <Text wrap="truncate-end">
        <Text bold>{groupSummary(calls)}</Text>
        {failed ? <Text color={t.codeFlag}>{` · ${failed} failed`}</Text> : null}
        {lastTarget ? <Text dimColor>{` · last: ${lastTarget}`}</Text> : null}
      </Text>
    </Box>
  )
}

export const formatDuration = (ms: number): string => {
  const s = Math.round(ms / 1000)
  if (s < 60) return `${Math.max(s, 0)}s`
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`
}

export const renderTurnDuration = ({ Text }: ElementTable, style: Style, word: string, durationMs: number): RenderElement => (
  <Text color={style.theme.codeComment}>
    {`✻ ${word} for `}
    <Text color={style.theme.number}>{formatDuration(durationMs)}</Text>
  </Text>
)
