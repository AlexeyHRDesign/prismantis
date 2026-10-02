# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

## [0.3.6] - 2026-10-02

### Added

- `/prismantis theme <name>` switches the theme on the spot; `/prismantis` lists all 15.

## [0.3.5] - 2026-10-02

### Fixed

- Copying a quote gives its text without the `> ` markers, so a drafted message pastes straight into chat.
- The README says how to reach copy buttons from the keyboard, since copy-on-select terminals like Warp can turn a click into a text selection.

## [0.3.4] - 2026-10-02

### Added

- A contrast test keeps every theme readable on its own background, with floors every official palette passes as designed.

### Known issues

- A diagram line can show through the spaces of an edge label. Reported upstream as beautiful-mermaid#154 with a fix offered.

## [0.3.3] - 2026-10-02

### Fixed

- Diagram hints now reach the model. Claude Code's built-in `sec-default` policy skips installed plugins' system-prompt hooks, so the 0.3.2 hint never arrived. The note now rides along with each prompt you type as model-only context, about 100 tokens per prompt.
- Stadium, cylinder and arrow-joined diagram boxes get their own colors. Subgraph containers stay in the plain diagram color.
- Edge labels written with a space before them (`A --> |label| B`) no longer make the diagram drop the target node.

## [0.3.2] - 2026-10-02

### Added

- Collapsed tool groups draw one summary line, such as `Ran 3 commands, read 2 files`, with a status dot, a failure count and the last target.
- The turn footer keeps Claude Code's word and colors the duration: `✻ Baked for 6m 20s`.
- Slash-command output renders as markdown, copy buttons included. Errors keep Claude Code's own line.
- `diagramHints` (on by default) adds one short system-prompt section so Claude uses diagrams and charts when they help.

### Fixed

- Expanded tool groups show their inline output again: their rows draw with Claude Code's own look.
- CJK and emoji count as two columns in tables, heading rules and diagram fit checks.
- A continuation line joins the list item it is indented under, not the last nested child.
- Inline code spans can contain backticks when the delimiter is longer, as in ``a `b` c``.

## [0.3.1] - 2026-10-02

### Fixed

- Code blocks lost their frame, so selecting code with the mouse no longer picks up border characters, the label or the button.

## [0.3.0] - 2026-10-02

### Renamed

- The project is now prismantis (prism + mantis). The repo moved to NahumLitvin/prismantis; GitHub redirects the old URL. Reinstall with `/plugin install prismantis@prismantis`.

### Added

- 15 themes from MIT-licensed palettes: Catppuccin Mocha and Latte, Dracula, Nord, Tokyo Night, Gruvbox dark and light, Rosé Pine and Dawn, Everforest, GitHub dark and light, One Dark, Solarized dark and light.
- Compact tool rows: `Ran <command>` with shell colors, `Read`/`Edited <path>`, status dots. Toggle with `toolRows`.
- Colorful diagrams: each mermaid box, participant and bar gets its own theme color. Bar and line charts (`xychart-beta`) and sequence diagrams draw too.
- Back-to-back tables and diagrams share a row and wrap, so wide terminals fill up.
- Charts size themselves to the terminal width.
- Copy buttons on code blocks, tables, diagrams, lists and quotes. Toggle with `copyButtons`.
- Diagrams get two copy buttons, source and drawn art. Code blocks get a language header.
- Syntax highlighting in 24 languages through a bundled Prism 1.30 (MIT).

### Changed

- `midnight`, `daylight` and `solarized` are now `catppuccin-mocha`, `catppuccin-latte` and `solarized-dark`, named after their sources.
- `customTheme` is gone. Every one of the 20 color tokens has its own `<token>Color` option instead.

### Fixed

- Copy buttons copy the exact markdown of tables, lists and quotes.
- Fences of four or more backticks keep nested ``` examples inside.
- Tables never draw wider than the terminal, and link columns are sized for the URL they show.
- An escaped trailing pipe stays in its table cell.
- Replies and code are parsed and highlighted once, not on every redraw.

### Removed

- Mermaid image mode and its mermaid-cli dependency. Diagrams draw as box art only, so prismantis runs no external programs and writes no files.

## [0.2.0] - 2026-10-02

### Added

- Mermaid diagrams as colored box art, sized to the terminal, with an ASCII-only option.
- Mermaid image mode: real PNGs from mermaid-cli in terminals with the kitty graphics protocol, box art as the fallback.
- `diagram` and `diagramText` color tokens.

## [0.1.0] - 2026-10-02

### Added

- Themed rendering of assistant replies: headings, paragraphs, lists, quotes, rules, code blocks and tables.
- Tables with colored headers, aligned columns and rules, sized to the terminal width.
- Highlighting for numbers, versions, IDs, file paths, links and inline code.
- Shell code blocks color the command, flags, strings and comments.
- Themes `midnight`, `daylight`, `solarized` and `mono`, plus per-token color overrides and a JSON custom theme.
