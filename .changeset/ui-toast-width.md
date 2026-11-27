---
'@partrunner-ai/ui': patch
---

Make every toast 440 px wide (it was 356 px), so a typical error with an action button wraps in two lines, not four. The action stays beside the text. On a screen narrower than 472 px the toast keeps a 16 px gutter on each side.
