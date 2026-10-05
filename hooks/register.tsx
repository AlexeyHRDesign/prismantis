import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderElement } from 'claude-code'

import type { DiagramView } from '../types'

import { parse } from './markdown'
import { boxArt, mermaidText } from './mermaid'
import type { Drawn } from './render'
import { remember, renderBlocks, renderExpandedShell, renderToolGroup, renderToolRow, renderTurnDuration, width } from './render'
import { helpText, rtlShowcaseText, showcaseText } from './help'
import { PRESET_NAMES } from './presets'
import type { Style } from './theme'
import { resolveStyle } from './theme'
import type { Terminal } from './rtl'
import { TERMINALS, hasRtl } from './rtl'
import { artSvg, chartSvg, forSurface, frame } from './surface'

const HINT = [
  'Replies in this session are drawn by the prismantis mod, which runs inside Claude Code and is not a command or tool to call: when the user asks to show something with prismantis, write it as markdown in the reply.',
  'Markdown tables, GitHub alerts (> [!WARNING], > [!NOTE]), fenced code with a language tag, and ```mermaid blocks render as colored terminal graphics:',
  'flowcharts, sequence diagrams and xychart-beta bar or line charts.',
  'When a reply carries a numeric series or a flow that is easier to see than read, add one small diagram or chart with short labels.',
  'Skip diagrams for simple answers.',
  'Put any command or snippet the user may run or copy in a fenced block with a language tag, never inline code: fenced blocks get a copy button, inline code does not.',
].join(' ')

const detectTerminal = async ($: EngineInterface): Promise<Terminal | null> => {
  const program = await $.env.get('TERM_PROGRAM')
  const term = await $.env.get('TERM')
  if ((await $.env.get('KITTY_WINDOW_ID')) || term === 'xterm-kitty') return 'kitty'
  if (program === 'Apple_Terminal') return 'apple-terminal'
  if (program === 'WarpTerminal') return 'warp'
  if (program === 'ghostty') return 'ghostty'
  if (program === 'WezTerm') return 'wezterm'
  if (program === 'vscode') return 'vscode'
  if (program === 'iTerm.app') return 'iterm'
  if (term === 'alacritty' || (await $.env.get('ALACRITTY_WINDOW_ID'))) return 'alacritty'
  if (await $.env.get('WT_SESSION')) return 'windows-terminal'
  if (await $.env.get('VTE_VERSION')) return 'gnome'
  if (await $.env.get('KONSOLE_VERSION')) return 'konsole'
  return null
}

const applyRtl = async ($: EngineInterface, style: Style): Promise<void> => {
  if (style.rtl !== 'auto') return
  const terminal = await detectTerminal($)
  style.reorder = terminal !== null
  if (terminal) style.shape = TERMINALS[terminal]
}

const expandedCalls = new Set<string>()

const VIEW = 'prismantis-view'
const view = atom({ plugin: 'prismantis', key: 'view' } as const, null as DiagramView | null)
const ZOOMS = [1, 1.5, 2, 3, 4, 6]
const PAN = 0.15

const diagramSvg = (style: Style, source: string): string | null => {
  if (!style.schemes) return null
  const chart = chartSvg(source, style.schemes)
  if (chart) return chart
  const art = mermaidText(source, false, 400)
  return art === null ? null : artSvg(art, style, style.schemes)
}

const openDiagram = async ($: EngineInterface, source: string) => {
  await update($, view, () => ({ source, zoom: 1, x: 0.5, y: 0.5 }))
  await $.ui.open({ id: VIEW, title: 'Diagram', focus: true, closeOnEscape: true })
}

const drawMarkdown = ($: EngineInterface, el: ReturnType<EngineInterface['ui']['resolve']>, style: Style, blocks: ReturnType<typeof parse>, columns: number, reply?: string): RenderElement[] => {
  const { Button } = el
  const copy = (text: string | (() => string), key: string, label = '⧉ copy') =>
    style.copyButtons ? (
      <Button
        key={key}
        variant="primary"
        label={label}
        onPress={press => {
          $.ui.copy({ text: typeof text === 'function' ? text() : text, surface: press.surface })
            .then(r => $.ui.toast(r.isCopied ? 'Copied' : `Copy failed: ${r.reason}`))
            .catch(() => $.ui.toast('Copy failed'))
        }}
      />
    ) : null
  const drawn: Drawn = new Map()
  if (style.mermaid) {
    for (const [i, block] of blocks.entries()) {
      if (block.kind !== 'code' || block.lang.toLowerCase() !== 'mermaid') continue
      const source = block.lines.join('\n')
      if (style.proportional && 'Svg' in el) {
        const svg = diagramSvg(style, source)
        const art = mermaidText(source, style.mermaidAscii, 400)
        if (svg !== null) {
          drawn.set(i, {
            element: (
              <el.Box key={`b${i}`} flexDirection="column" alignItems="flex-start" rowGap={1}>
                <el.Svg source={frame(svg)} alt="mermaid diagram" isInteractive />
                <Button key={`zoom${i}`} label="⤢ Open large" onPress={() => void openDiagram($, source)} />
              </el.Box>
            ),
            art: art ?? source,
          })
          continue
        }
      }
      const art = mermaidText(block.lines.join('\n'), style.mermaidAscii, columns)
      if (art !== null && art.split('\n').every(l => width(l) <= columns - 2)) drawn.set(i, { element: boxArt(el, style, art, `b${i}`), art })
    }
  }
  const elements = renderBlocks(el, style, blocks, columns, drawn, copy)
  const button = reply === undefined ? null : copy(reply, 'reply', '⧉ copy reply')
  return button ? [...elements, <el.Box key="reply" alignSelf="flex-end">{button}</el.Box>] : elements
}

export const register: Register = (on, options) => {
  if (options.enabled === false) return
  const style = resolveStyle(options)
  const parsed = new Map<string, ReturnType<typeof parse>>()
  const parseCached = (text: string) => remember(parsed, text, () => parse(text, { numbers: style.highlightNumbers, paths: style.highlightPaths }))

  if (options.toolRows !== false) {
    on('ui.render', { component: 'ToolGroup' }, ($, e, next) => {
      if (e.props.isExpanded) {
        for (const call of e.props.calls) if (call.tool_use_id) expandedCalls.add(call.tool_use_id)
        return next(e)
      }
      return renderToolGroup($.ui.resolve(e), forSurface(style, e.surface), e.props.calls, e.props.isActive)
    })
    on('ui.render', { component: 'ToolUse' }, ($, e, next) => {
      if (!expandedCalls.has(e.props.tool_use_id)) return renderToolRow($.ui.resolve(e), forSurface(style, e.surface), e.props)
      return e.props.tool === 'Bash' || e.props.tool === 'PowerShell' ? renderExpandedShell($.ui.resolve(e), forSurface(style, e.surface), e.props) : next(e)
    })
  }

  on('session.start', async ($, e, next) => {
    await applyRtl($, style)
    const started = await next(e)
    await $.command
      .register({ name: 'prismantis', description: 'Switch the prismantis theme, or list themes', argumentHint: '[theme <name>]' })
      .catch(() => undefined)
    return started
  })

  on('command.run', { command: 'prismantis' }, async ($, e) => {
    const [sub, name] = e.args.trim().split(/\s+/)
    if (sub === 'demo') return { text: showcaseText(PRESET_NAMES) }
    if (sub === 'demo-rtl') {
      await applyRtl($, style)
      return { text: rtlShowcaseText() }
    }
    if (sub !== 'theme' || !name) return { text: helpText(PRESET_NAMES) }
    if (!(PRESET_NAMES as readonly string[]).includes(name)) return { text: `Unknown theme "${name}". Themes: ${PRESET_NAMES.join(', ')}` }
    const result = await $.config.set({ key: `${$.plugin.name}.theme`, value: name })
    return { text: result.deny ? `Could not switch theme: ${result.deny}` : `Theme set to ${name}.` }
  })

  on('ui.render', { component: 'TurnDuration' }, ($, e) => renderTurnDuration($.ui.resolve(e), forSurface(style, e.surface), e.props.word, e.props.durationMs))

  on('prompt.submit', async ($, e, next) => {
    await applyRtl($, style)
    if (!style.diagramHints || (e.origin.kind !== 'composer' && e.origin.kind !== 'bridge')) return next(e)
    return next({ ...e, context: [...(e.context ?? []), HINT] })
  })

  on('ui.render', { component: 'CommandOutput' }, ($, e, next) => {
    if (e.props.isErrored) return next(e)
    const blocks = parseCached(e.props.text)
    if (blocks.length === 0) return next(e)
    const el = $.ui.resolve(e)
    const { Box } = el
    const columns = Math.max(20, (e.viewport?.columns ?? 100) - 4)
    const s = forSurface(style, e.surface)
    return <Box flexDirection="column" rowGap={1} {...((s.reorder && hasRtl(e.props.text)) || s.proportional ? { width: '100%' } : {})}>{drawMarkdown($, el, s, blocks, columns)}</Box>
  })

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    const blocks = parseCached(e.props.text)
    if (blocks.length === 0) return next(e)
    const el = $.ui.resolve(e)
    const { Box, Text } = el
    const columns = Math.max(20, (e.viewport?.columns ?? 100) - 4)
    const s = forSurface(style, e.surface)
    return (
      <Box flexDirection="row" alignItems="flex-start">
        <Box width={2} flexShrink={0}>
          <Text color={s.theme.accent}>{e.props.isFirstOfReply ? '●' : ' '}</Text>
        </Box>
        <Box flexDirection="column" rowGap={1} flexGrow={1}>
          {drawMarkdown($, el, s, blocks, columns, blocks.length > 1 || hasRtl(e.props.text) ? e.props.text : undefined)}
        </Box>
      </Box>
    )
  })

  on('ui.render', { component: 'Pane', requestId: VIEW }, async ($, e) => {
    const el = $.ui.resolve(e)
    const { Box, Text, Button } = el
    const current = await read($, view)
    const s = forSurface(style, e.surface)
    const svg = current ? diagramSvg(s, current.source) : null
    if (!current || svg === null || !('Svg' in el)) return <Text dimColor>No diagram to show.</Text>
    const at = Math.max(0, ZOOMS.indexOf(current.zoom))
    const set = (change: Partial<DiagramView>) => void update($, view, v => (v ? { ...v, ...change } : v))
    const pan = (dx: number, dy: number) => {
      const step = PAN / current.zoom
      set({ x: Math.max(0, Math.min(1, current.x + dx * step)), y: Math.max(0, Math.min(1, current.y + dy * step)) })
    }
    const zoomed = current.zoom > 1
    return (
      <Box flexDirection="column" rowGap={1} width="100%">
        <Box flexDirection="row" columnGap={1} alignItems="center" flexWrap="wrap">
          <Button key="zoom-out" label="−" onPress={() => set({ zoom: ZOOMS[Math.max(0, at - 1)]! })} />
          <Text bold>{`${Math.round(current.zoom * 100)}%`}</Text>
          <Button key="zoom-in" label="+" onPress={() => set({ zoom: ZOOMS[Math.min(ZOOMS.length - 1, at + 1)]! })} />
          <Button key="zoom-fit" label="Fit" onPress={() => set({ zoom: 1, x: 0.5, y: 0.5 })} />
          {zoomed && <Text dimColor>  move</Text>}
          {zoomed && <Button key="pan-left" label="←" onPress={() => pan(-1, 0)} />}
          {zoomed && <Button key="pan-up" label="↑" onPress={() => pan(0, -1)} />}
          {zoomed && <Button key="pan-down" label="↓" onPress={() => pan(0, 1)} />}
          {zoomed && <Button key="pan-right" label="→" onPress={() => pan(1, 0)} />}
          <Button key="close" label="Close" role="dismiss" onPress={() => void $.ui.close({ id: VIEW })} />
        </Box>
        <el.Svg source={frame(svg, current)} alt="mermaid diagram" isInteractive />
      </Box>
    )
  })
}
