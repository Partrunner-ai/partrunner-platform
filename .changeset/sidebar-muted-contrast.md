---
'@partrunner-ai/tokens': patch
'@partrunner-ai/ui': patch
---

Keep the muted sidebar ink AA-legible over the darkest sidebar stop: crystal
sidebar-fg-muted moves rgba(26,26,26,0.6)->0.7 (3.68:1 -> 4.77:1 over #ecb800)
and nexus rgba(0,0,0,0.55)->0.6 (4.32:1 -> 5.10:1 over #fdd238). Found by the
dark-catalog accessibility audit; a new tokens test holds the contract. ui
republishes only to rebundle theme.css/light.css with the corrected value.
