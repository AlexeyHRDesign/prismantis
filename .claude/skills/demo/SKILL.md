---
name: demo
description: Print the prismantis demo reply to eyeball every rendering feature after a change. Use after any visual change, when asked for "the demo", "show all features", "visual test", or before a release screenshot.
---

# Demo

The visual test. Unit tests prove the tree; this proves the look.

1. **Load the working copy** in this session (see `live-check` step 1). The new version shows only after the turn that made the edit ends.
2. **Print `docs/demo.md` verbatim as the whole final message of a turn**, with nothing before it and no tool call after it. Claude Code condenses text written right before a tool call, so the demo must close the turn.
3. **The person looks at it**, or screenshots it on the next turn (`live-check` step 3). Check:
   - the bold `prismantis` header on the first line
   - the table: yellow header, rules between rows, the right-aligned `Size` column, colored numbers
   - the four diagrams and the table on one row on a wide terminal, wrapping on a narrow one
   - every flowchart box and sequence participant in its own color, with matching colors at both ends of the sequence
   - one color per bar, dim gridlines, colored axis numbers
   - shell colors: command, flags, the quoted string, `&&`
   - code blocks with a language header and no frame, and Prism colors in the TypeScript block
   - path, link and inline-code colors, and the quote bar
   - an accent `[ ⧉ copy ]` button on the table, every diagram, the list, the shell block and the quote
4. **Fix what looks wrong**, then run the demo again.
5. **Keep it current.** A new feature adds a line to `docs/demo.md` and to the checklist above. All data stays invented and neutral.
