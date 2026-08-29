---
'@partrunner-ai/ui': minor
---

Add the shared page-chrome components both staff apps carried as forks: `PageHeader`
(eyebrow chip, display-tracked title, subtitle, end-aligned actions), `StatTile`
(KPI tile with tone wash, icon chip, and trend chip), `Toolbar` (glass filter
surface), `IconButton` (accessible icon-only button with a 44px touch-target
contract), and `ConfirmDialog` (standard confirm flow over `Dialog`, Spanish
labels by default, `destructive` and `loading` modes). Styling is package-owned
plain CSS over `--pr-*` tokens; no Tailwind required.
