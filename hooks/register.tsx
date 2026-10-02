import type { Register } from 'claude-code'

import { parse } from './markdown'
import { boxArt, mermaidText } from './mermaid'
import type { Drawn } from './render'
import { remember, renderBlocks, renderToolRow } from './render'
import { resolveStyle } from './theme'

export const register: Register = (on, options) => {
  if (options.enabled === false) return
  const style = resolveStyle(options)
  const parsed = new Map<string, ReturnType<typeof parse>>()

  if (options.toolRows !== false) {
    on('ui.render', { component: 'ToolUse' }, ($, e) => renderToolRow($.ui.resolve(e), style, e.props))
  }

  on('ui.render', { component: 'AssistantMessage' }, ($, e, next) => {
    const el = $.ui.resolve(e)
    const { Box, Button, Text } = el
    const copy = (text: string, key: string, label = '⧉ copy') =>
      style.copyButtons ? (
        <Button
          key={key}
          variant="primary"
          label={label}
          onPress={press => {
            $.ui.copy({ text, surface: press.surface })
              .then(r => $.ui.toast(r.isCopied ? 'Copied' : `Copy failed: ${r.reason}`))
              .catch(() => $.ui.toast('Copy failed'))
          }}
        />
      ) : null
    const columns = Math.max(20, (e.viewport?.columns ?? 100) - 4)
    const blocks = remember(parsed, e.props.text, () => parse(e.props.text, { numbers: style.highlightNumbers, paths: style.highlightPaths }))
    if (blocks.length === 0) return next(e)

    const drawn: Drawn = new Map()
    if (style.mermaid) {
      for (const [i, block] of blocks.entries()) {
        if (block.kind !== 'code' || block.lang.toLowerCase() !== 'mermaid') continue
        const art = mermaidText(block.lines.join('\n'), style.mermaidAscii, columns)
        if (art !== null && art.split('\n').every(l => [...l].length <= columns - 2)) drawn.set(i, { element: boxArt(el, style, art, `b${i}`), art })
      }
    }

    return (
      <Box flexDirection="row">
        <Box width={2} flexShrink={0}>
          <Text color={style.theme.accent}>{e.props.isFirstOfReply ? '⏺' : ' '}</Text>
        </Box>
        <Box flexDirection="column" rowGap={1} flexGrow={1}>
          {renderBlocks(el, style, blocks, columns, drawn, copy)}
        </Box>
      </Box>
    )
  })
}
