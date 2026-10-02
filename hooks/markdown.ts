export type Inline =
  | { kind: 'text'; text: string }
  | { kind: 'strong'; children: Inline[] }
  | { kind: 'emphasis'; children: Inline[] }
  | { kind: 'strike'; children: Inline[] }
  | { kind: 'code'; text: string }
  | { kind: 'link'; text: string; href: string }
  | { kind: 'number'; text: string }
  | { kind: 'path'; text: string }

export type Block =
  | { kind: 'heading'; level: number; inline: Inline[] }
  | { kind: 'paragraph'; inline: Inline[] }
  | { kind: 'list'; ordered: boolean; items: { marker: string; depth: number; inline: Inline[] }[] }
  | { kind: 'code'; lang: string; lines: string[] }
  | { kind: 'quote'; inline: Inline[] }
  | { kind: 'rule' }
  | { kind: 'table'; header: Inline[][]; align: ('left' | 'right' | 'center')[]; rows: Inline[][][] }

export type Highlight = { numbers: boolean; paths: boolean }

const TABLE_SEP = /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/
const LIST_ITEM = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/
const FENCE = /^\s*(```|~~~)\s*([\w+-]*)/

const splitRow = (line: string): string[] => {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '')
  const cells: string[] = []
  let cell = ''
  for (let i = 0; i < trimmed.length; i++) {
    const ch = trimmed[i]
    if (ch === '\\' && trimmed[i + 1] === '|') {
      cell += '|'
      i++
    } else if (ch === '|') {
      cells.push(cell.trim())
      cell = ''
    } else {
      cell += ch
    }
  }
  cells.push(cell.trim())
  return cells
}

const INLINE = /(`+)([^`]+?)\1|\[([^\]]+)\]\(([^)\s]+)\)|\*\*([^*]+?)\*\*|__([^_]+?)__|~~([^~]+?)~~|(?<![\w*])\*([^*\s][^*]*?)\*(?!\w)|(?<![\w_])_([^_\s][^_]*?)_(?!\w)|(https?:\/\/[^\s<>()]+[^\s<>().,;:!?'"])/g
const NUMBER = /(?<![\w.#/-])(v?\d+(?:[.,:]\d+)*(?:%|ms|s|m|h|d|Gi|Mi|GB|MB|KB|x)?)(?![\w/])/g
const PATH = /(?<![\w/.:])((?:~|\.{1,2})?\/[\w.@+-]+(?:\/[\w.@+-]*)*)/g

const decorate = (text: string, hl: Highlight): Inline[] => {
  if (!hl.numbers && !hl.paths) return [{ kind: 'text', text }]
  const marks: { start: number; end: number; kind: 'number' | 'path' }[] = []
  if (hl.paths) for (const m of text.matchAll(PATH)) marks.push({ start: m.index, end: m.index + m[0].length, kind: 'path' })
  if (hl.numbers) {
    for (const m of text.matchAll(NUMBER)) {
      const start = m.index
      if (!marks.some(p => start < p.end && start + m[0].length > p.start)) {
        marks.push({ start, end: start + m[0].length, kind: 'number' })
      }
    }
  }
  marks.sort((a, b) => a.start - b.start)
  const out: Inline[] = []
  let at = 0
  for (const m of marks) {
    if (m.start > at) out.push({ kind: 'text', text: text.slice(at, m.start) })
    out.push({ kind: m.kind, text: text.slice(m.start, m.end) })
    at = m.end
  }
  if (at < text.length) out.push({ kind: 'text', text: text.slice(at) })
  return out
}

export const parseInline = (text: string, hl: Highlight): Inline[] => {
  const out: Inline[] = []
  let at = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > at) out.push(...decorate(text.slice(at, m.index), hl))
    if (m[2] !== undefined) out.push({ kind: 'code', text: m[2] })
    else if (m[3] !== undefined) out.push({ kind: 'link', text: m[3], href: m[4] ?? "" })
    else if (m[5] !== undefined || m[6] !== undefined) out.push({ kind: 'strong', children: parseInline(m[5] ?? m[6] ?? "", hl) })
    else if (m[7] !== undefined) out.push({ kind: 'strike', children: parseInline(m[7], hl) })
    else if (m[8] !== undefined || m[9] !== undefined) out.push({ kind: 'emphasis', children: parseInline(m[8] ?? m[9] ?? "", hl) })
    else if (m[10] !== undefined) out.push({ kind: 'link', text: m[10], href: m[10] })
    at = m.index + m[0].length
  }
  if (at < text.length) out.push(...decorate(text.slice(at), hl))
  return out
}

export const inlineText = (inline: Inline[]): string =>
  inline.map(n => ('children' in n ? inlineText(n.children) : n.text)).join('')

export const parse = (source: string, hl: Highlight): Block[] => {
  const lines = source.replace(/\r\n?/g, '\n').split('\n')
  const at = (n: number) => lines[n] ?? ''
  const blocks: Block[] = []
  let para: string[] = []

  const flush = () => {
    if (para.length) blocks.push({ kind: 'paragraph', inline: parseInline(para.join(' '), hl) })
    para = []
  }

  for (let i = 0; i < lines.length; i++) {
    const line = at(i)
    const fence = FENCE.exec(line)
    if (fence) {
      flush()
      const body: string[] = []
      i++
      while (i < lines.length && !at(i).trim().startsWith((fence[1] ?? "```"))) body.push(at(i++))
      blocks.push({ kind: 'code', lang: fence[2] ?? "", lines: body })
      continue
    }
    if (line.trim() === '') {
      flush()
      continue
    }
    const heading = /^(#{1,6})\s+(.*?)\s*#*\s*$/.exec(line)
    if (heading) {
      flush()
      blocks.push({ kind: 'heading', level: (heading[1] ?? "#").length, inline: parseInline(heading[2] ?? "", hl) })
      continue
    }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush()
      blocks.push({ kind: 'rule' })
      continue
    }
    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(at(i + 1))) {
      flush()
      const header = splitRow(line)
      const align = splitRow(at(i + 1)).map(c =>
        c.startsWith(':') && c.endsWith(':') ? 'center' : c.endsWith(':') ? 'right' : 'left',
      )
      i += 2
      const rows: Inline[][][] = []
      while (i < lines.length && at(i).includes('|') && at(i).trim() !== '') {
        const cells = splitRow(at(i++))
        rows.push(header.map((_, c) => parseInline(cells[c] ?? '', hl)))
      }
      i--
      blocks.push({ kind: 'table', header: header.map(c => parseInline(c, { numbers: false, paths: false })), align, rows })
      continue
    }
    if (/^\s*>/.test(line)) {
      flush()
      const body: string[] = []
      while (i < lines.length && /^\s*>/.test(at(i))) body.push(at(i++).replace(/^\s*>\s?/, ''))
      i--
      blocks.push({ kind: 'quote', inline: parseInline(body.join(' '), hl) })
      continue
    }
    const item = LIST_ITEM.exec(line)
    if (item) {
      flush()
      const ordered = /\d/.test(item[2] ?? "")
      const items: { marker: string; depth: number; inline: Inline[] }[] = []
      while (i < lines.length) {
        const it = LIST_ITEM.exec(at(i))
        if (it) {
          items.push({ marker: it[2] ?? "-", depth: Math.floor((it[1] ?? "").replace(/\t/g, '  ').length / 2), inline: parseInline(it[3] ?? "", hl) })
        } else if (/^\s{2,}\S/.test(at(i)) && items.length) {
          const last = items[items.length - 1]!
          last.inline = [...last.inline, { kind: 'text', text: ' ' }, ...parseInline(at(i).trim(), hl)]
        } else {
          break
        }
        i++
      }
      i--
      blocks.push({ kind: 'list', ordered, items })
      continue
    }
    para.push(line.trim())
  }
  flush()
  return blocks
}
