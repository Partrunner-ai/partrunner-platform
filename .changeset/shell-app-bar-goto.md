---
'@partrunner-ai/shell': minor
---

Add an opt-in `navigation="appbar"` mode to `AppShell`. `GlobalHeader` then shows an app bar (all apps in one fixed order, the current app marked, each app opening the last page you used there) and an «Ir a» command palette (⌘K / Ctrl+K) that lists recent pages first and then searches. The brand block opens the start page of the current app and the pinned Nexus item is not rendered. New `appSub`, `navMemoryIgnore`, and `onNavigate` props, a `useShellNavigation()` hook, an optional `pages` index on the staff-shell context, and `APP_BAR_APPS` re-exported from the registry. The default `'launcher'` mode is unchanged.
