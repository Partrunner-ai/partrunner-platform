---
'@partrunner-ai/shell': minor
---

Polish the unified staff navigation. In `navigation="unified"` the apps grid shows Nexus as «Nexus», like «Mis apps» and the search (launcher mode still shows the registry label). The shell treats `www.<host>` and `<host>` as the same app origin when it compares origins (way back from the referrer, registry-origin checks, host page index), so the fleet portal at `www.partrunner.app` matches the registry origin `partrunner.app`; `staging.` is not treated as `www.`. New `GlobalHeader` prop `showThemeToggle` (default `true`): `false` hides the theme button, for an app with one theme.
