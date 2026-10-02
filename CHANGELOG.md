# Changelog

All notable changes to this project are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses [Semantic Versioning](https://semver.org/).

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
- Diagrams get two copy buttons, source and drawn art. Code blocks draw in a bordered box with a language header.
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
