# @partrunner-ai/shell

Shared application shell, navigation, launcher, notifications, preferences, and
user controls for PartRunner applications.

## Install

```bash
pnpm add @partrunner-ai/shell @partrunner-ai/app-registry react react-dom lucide-react
```

## Usage

```tsx
import {
  AppShell,
  GlobalHeader,
  StaffShellProvider,
} from '@partrunner-ai/shell';
import '@partrunner-ai/shell/shell.css';

<StaffShellProvider value={staffShell}>
  <AppShell
    sections={sections}
    currentPath="/"
    globalHeader={<GlobalHeader currentSub="supply" />}
  >
    {children}
  </AppShell>
</StaffShellProvider>;
```

The host owns authentication, routing, data loading, and persistence. The
package owns shared presentation and interaction contracts.

## Theme and live notifications

`GlobalHeader` shows the theme toggle again (light → dark → system), driven by
`preferences.theme` and `setTheme`; the host applies the theme to the document.

Hosts that expose `refreshNotifications` on the staff-shell context get a bell
that stays current on its own: the shell calls it every
`NOTIFICATION_REFRESH_MS` (60 s) while the tab is visible and when it comes back
into view. The timing lives here so every app refreshes the same way. A custom
header that renders `NotificationCenter` directly passes it as `onRefresh`,
together with `unseenCount`, `onOpen` and `sound`.

## App bar and «Ir a» (`navigation="appbar"`)

Opt-in. Without the prop nothing changes: `navigation` defaults to
`'launcher'`.

```tsx
<AppShell
  sections={sections}
  currentPath={pathname}
  navigation="appbar"
  appSub="supply"
  cookieDomain=".partrunner.ai"
  brandHref="/"
  onNavigate={(event) => track('shell_navigate', event)}
  globalHeader={<GlobalHeader currentSub="supply" />}
>
```

In this mode:

- `GlobalHeader` shows an app bar: every app in one fixed order (Inicio,
  Comercial, Solicitudes, Supply, LiveOps, Finanzas, FDS). The current app is
  marked. Another app opens the last page you used there, else its start page.
  The bar shows when its slot in the header is 680px wide or more. The launcher
  grid button stays visible at every width: it is the way to Comunidad and the
  overflow path. Apps with `appBar: false` in the
  registry (Comunidad) are not in the bar.
- «Ir a…» (⌘K / Ctrl+K, or the header button) opens a palette. It lists recent
  pages first, then searches this app's pages, recents, the host's page index,
  and the apps. A host can fill `pages` in the staff-shell context
  (`StaffShellPage`: `app`, `label`, absolute `href`, `section`) to search other
  apps' pages.
- The brand block opens the start page of the app you are in (`brandHref`, else
  `/`). `onBrandSelect` runs only when you pass it. The pinned «Nexus» item is
  not rendered; Nexus is «Inicio» in the bar.
- `onNavigate({ source, fromSub, toSub, href })` runs before the app bar, the
  palette, the brand block, or a sidebar link navigates
  (`source`: `'appbar' | 'goto' | 'brand' | 'menu'`). Forward it to usage
  tracking. A throwing callback is ignored.
- `useShellNavigation()` returns the navigation state (`mode`, `currentPath`,
  `appSub`, `pages`, `activeLabel`, ...) inside `AppShell`, else `null`.

Adoption steps:

1. Set `navigation="appbar"` and `appSub` (the registry `sub`) on `AppShell`.
2. Set `cookieDomain=".partrunner.ai"` so the visit memory is shared between
   apps. Without it the memory stays on one host.
3. Set `brandHref` when the start page of the app is not `/`, for example
   `/admin/dashboard` for Finanzas.
4. Pass `navMemoryIgnore` for extra paths that must not be remembered.
5. A page that owns its own ⌘K (Supply has one in onboarding/conversaciones)
   must listen in the capture phase on `window` and call `preventDefault()`.
   The shell then does not open «Ir a». The shell also ignores ⌘K with Shift or
   Alt held.

Visit memory uses two cookies, `pr-nav-last` (last path per app) and
`pr-nav-recent` (the last 8 menu pages with their labels; a detail page such
as `/rutas/123` is stored as its menu page `/rutas`), kept for 30 days. They go
with every request to every `*.partrunner.ai` host, so they stay small (paths
up to 160 characters; the recent list drops its oldest entries past 1500
encoded characters). They
hold the pathname only, never the query or the hash. Login, logout, `/auth/*`,
`/sso*`, `/unauthorized`, and `/solicitar-acceso` are never stored
(`NAV_MEMORY_IGNORE`). Finanzas lives on `partrunner.app`, so it does not share
these cookies with the `partrunner.ai` apps; its bar item opens its start page.

## Bell sound

The bell is silent unless the host passes `notifications.sound`
(`StaffBellSound`): one sound when `unseenCount` goes up and one with each shake
of the ring animation, stopping after `ringLimit` shakes (`0` = never stops).
Nexus configures it company-wide and sends it in the staff-shell snapshot; a
satellite that spreads the snapshot's `notifications` into the context gets it
for free. `@partrunner-ai/shell/bell-sound` exposes the catalog, the validator
and `playBellSound` without React, for server code and settings pages.

React 18 and 19 are supported. Import one token/theme foundation from
`@partrunner-ai/ui` alongside the shell stylesheet.

Licensed under MIT. Included PartRunner artwork is also MIT-licensed; see
`TRADEMARKS.md` for trademark terms.
