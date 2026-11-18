---
'@partrunner-ai/shell': minor
---

Add opt-in navigation modes to `AppShell` through the new `navigation` prop. The default `'launcher'` is unchanged. `'switcher'` (recommended) shows an app switcher with the current app name, a way back («← App») to the page you left in the app you came from, and a «Buscar o ir a…» search field (⌘K / Ctrl+K, or «/») that lists the way back, recent pages, and apps first. `'appbar'` is an alternative that shows every app as a bar. Both modes make the brand open the start page of the current app, drop the pinned Nexus item, remember your last page per app in two small cookies, and report moves through the new `onNavigate` prop. New `appSub` and `navMemoryIgnore` props, a `useShellNavigation()` hook, an optional `pages` index on the staff-shell context, and `APP_BAR_APPS` re-exported from the registry.

«Ir a…» also opens with «/» when focus is not in a field; ⌘K / Ctrl+K stay. New `appsInSidebar` prop on `AppShell` (`'appbar'` and `'switcher'` only): a «Mis apps» section at the top of the sidebar, fed by the new optional `favoriteApps` and `setFavoriteApps` of the staff-shell context, with `onNavigate` source `'favorites'`.
