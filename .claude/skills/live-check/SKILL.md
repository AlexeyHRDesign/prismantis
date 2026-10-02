---
name: live-check
description: Load the working copy of prismantis into a real Claude Code session and screenshot how replies render. Use after any visual change, when asked to "screenshot", "see it", "try it live", or before claiming a rendering fix works.
---

# Live check

Tests prove the tree. Only a real render proves the look.

1. **Load the working copy:**
   - From a new terminal: `claude --plugin-dir <repo path>`. Saving files hot-reloads it.
   - From inside a session that loaded the `plugin-authoring` skill: copy `.claude-plugin/plugin.json`, `hooks/` and `types/` into that session's dev-mods folder. The person answers the one-time "Enable hot reloading" prompt, and the mod loads when the turn ends. Copy again after every edit.
2. **Print a sample reply** containing everything the change touches: a table with numbers and an aligned column, a `bash` block with flags and a quoted string, a path, a link, a heading and a `mermaid` block.
3. **Screenshot on the next turn**, after the reply has rendered:
   - macOS: `screencapture -x <scratch>/shot.png && sips -Z 2000 <scratch>/shot.png`, then read the image.
   - Linux: `grim`, `gnome-screenshot -f` or `import -window root`.
   - Windows: ask the person for a Win+Shift+S capture.
4. **Check** column alignment, rule lengths, colors against the theme tokens, wrapping at narrow widths, and that nothing falls back to the engine renderer. A dim line naming `prismantis` in the transcript means a hook was refused; fix that first.
5. **Before publishing a screenshot**, check it shows no private repo names, hostnames, internal versions or other work data. Use a neutral sample for README images.
