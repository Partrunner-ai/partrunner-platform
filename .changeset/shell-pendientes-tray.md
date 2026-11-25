---
'@partrunner-ai/shell': minor
---

Add the «Pendientes» tray and pending counts. A host that passes `pendientes` in the staff shell context gets a tray next to the bell in `GlobalHeader` (what the person must do or approve: «Te toca» and «De tu equipo, sin tomar», a «y N más» link and «Ver todo en Inicio»). The same data paints counts on the app tiles (launcher grid and «Mis apps») through `pendientes.byApp`, and `NavItem` gets `badgeTone` (`'mine'` default, `'team'` gray; a closed group rolls up the strongest tone). The snapshot gets an optional `pendientes` block (version stays 1; a malformed block is dropped, never rejects the snapshot), normalized by the new `normalizePendientes`. Links in the tray must be `https://`, `http://localhost` or a same-origin path. A host that passes no `pendientes` renders exactly as before.
