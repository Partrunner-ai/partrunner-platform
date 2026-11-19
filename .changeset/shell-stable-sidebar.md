---
'@partrunner-ai/shell': minor
---

Keep the sidebar still on first paint. `AppShellInitialState` now carries `favoriteApps` from one shared cookie (`<collapseStorageKey>:favs`, written with `collapseStorage="cookie"`), and the new server helper `readAppShellInitialState(await cookies())` (from `@partrunner-ai/shell/preferences`) returns collapsed state, open groups and «Mis apps» for the first render. «Mis apps» draws its rows from the cookie before the staff snapshot arrives (read-only, «Editar» disabled); the snapshot wins and refreshes the cookie. A stored collapsed state read on the client applies without the width transition. No change for apps that do not pass the new state.
