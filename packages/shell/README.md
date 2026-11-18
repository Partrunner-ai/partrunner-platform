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

## Navigation modes (`navigation`)

Opt-in. Without the prop nothing changes: `navigation` defaults to
`'launcher'`. Two other modes share the brand rule, the visit memory, the
«Ir a» palette, and `onNavigate`:

- `'switcher'` (recommended): no always-visible bar. The header shows an app
  switcher («Supply ▾»), a way back («← LiveOps») when the person came from
  another app, and a «Buscar o ir a… ⌘K» search field. No apps-grid button.
- `'appbar'` (an alternative): the header shows every app as a bar, plus an
  «Ir a…» button.

```tsx
<AppShell
  sections={sections}
  currentPath={pathname}
  navigation="switcher"
  appSub="supply"
  cookieDomain=".partrunner.ai"
  brandHref="/"
  onNavigate={(event) => track('shell_navigate', event)}
  globalHeader={<GlobalHeader currentSub="supply" />}
>
```

Shared by both modes:

- The brand block opens the start page of the app you are in (`brandHref`, else
  `/`). `onBrandSelect` runs only when you pass it. The pinned «Nexus» item is
  not rendered; Nexus is a row in the switcher or «Inicio» in the bar.
- «Ir a…» (⌘K / Ctrl+K, «/», or the header button) opens a palette. «/» works
  when focus is not in an input, a textarea, a select, or an editable element, and
  with no Ctrl, Meta, or Alt key (Shift is allowed: «/» is Shift+7 on some
  layouts). Some browsers and launcher apps take ⌘K first, so «/» is the
  fallback. The palette lists «Volver» (the way back), «Recientes», and «Apps» with the page each one
  opens. With a query it searches this app's pages, recents, the host's page
  index, and the apps. A host can fill `pages` in the staff-shell context
  (`StaffShellPage`: `app`, `label`, absolute `href`, `section`) to search other
  apps' pages.
- `onNavigate({ source, fromSub, toSub, href })` runs before the app bar, the
  switcher, the way back, the palette, the brand block, or a sidebar link
  navigates (`source`: `'appbar' | 'switcher' | 'wayback' | 'goto' | 'brand' |
  'menu' | 'favorites'`). Forward it to usage tracking. A throwing callback is ignored.
- `useShellNavigation()` returns the navigation state (`mode`, `currentPath`,
  `appSub`, `pages`, `activeLabel`, `wayBack`, ...) inside `AppShell`, else
  `null`.

### `'switcher'`

- The trigger shows the name of the current app. The menu has one row per app
  of `APP_BAR_ORDER` (Comunidad is not there), numbered 1-7. Each row shows the
  label of the page it opens: the last page used there, else «Inicio». The
  current row is marked «aquí» and routes in place. Keys: arrows, Home, End,
  digits 1-9, Esc.
- The way back: when you arrive from another app, «← App» opens the exact page
  you left. Every cross-app link the shell builds (switcher rows, app bar items,
  palette rows, the chip itself) carries a fragment,
  `#pr-from=<sub>:<encoded pathname>`. On the first mount the shell reads the
  fragment, removes only that fragment from the address bar with
  `history.replaceState`, and keeps `{ s, p }` in `sessionStorage` (`pr-nav-from`,
  per origin and per tab). Without a fragment it falls back to
  `document.referrer` when that is the origin of another registry app, and opens
  that app's last page, else its start page. Nothing goes to a server: a
  fragment is never sent in an HTTP request. A same-app or external link never
  gets the fragment. Only hrefs whose origin belongs to an app in `APPS` get it,
  so an app that a host adds through a custom `apps` list gets no way back.
  Browsers cut a cross-origin referrer to its origin, so any page on
  `partrunner.app` counts as Finanzas in the referrer fallback.
- `pr-nav-last` holds `{ [sub]: { p, l? } }` (path and the label of its menu
  page). The older `{ [sub]: path }` form is still read.

### `'appbar'`

`GlobalHeader` shows an app bar: every app in `APP_BAR_ORDER` (Inicio, Comercial,
Solicitudes, Supply, LiveOps, Finanzas, FDS). The current app is marked. Another
app opens the last page you used there, else its start page. The bar shows when
its slot in the header is 500px wide or more (the bar itself is about 470px).
The launcher grid button stays visible at every width: it is the way to Comunidad
and the overflow path. Apps with `appBar: false` in the registry (Comunidad) are
not in the bar.

### «Mis apps» in the sidebar

`appsInSidebar` (default `false`, `'appbar'` and `'switcher'` only) puts a «Mis apps»
section under the brand and above the app's menu. It lists the apps in
`favoriteApps` (registry subs, in the person's order, at most 5) from the
staff-shell context, each with an icon tile, the app name, and the page it opens
(the last page used there, else «Inicio»). A click reports `onNavigate` with
`source: 'favorites'`; the current app is marked and routes in place. With
`setFavoriteApps` the section has «Editar»: a checkbox per app (the rest are
disabled at 5) and «Listo»; the shell saves the subs in `APP_BAR_ORDER`. An empty
list shows «Elige tus apps». Without a setter the list is read-only; without a
`StaffShellProvider` or a list the section is not rendered. The collapsed rail
shows the icon tiles only. Storage is the host's job (the snapshot does not carry
favorites yet).

### Adoption steps

1. Set `navigation="switcher"` and `appSub` (the registry `sub`) on `AppShell`.
2. Set `cookieDomain=".partrunner.ai"` so the visit memory is shared between
   apps. Without it the memory stays on one host.
   In `'switcher'` mode, remove `SidebarTrigger` from `start`: the header
   renders it first (mobile only) before the way back and the switcher. Also
   remove any product-name label from `start` that repeats the app name (for
   example «LiveOps»), because the switcher already shows it.
3. Set `brandHref` when the start page of the app is not `/`, for example
   `/admin/dashboard` for Finanzas.
4. Pass `navMemoryIgnore` for extra paths that must not be remembered.
5. A page that owns its own ⌘K or «/» (Supply has a ⌘K in
   onboarding/conversaciones) must listen on `window` in the capture phase and
   call `preventDefault()`. The shell listens on `document` in the bubble phase,
   so it runs later and does not open «Ir a». The shell also ignores ⌘K with
   Shift or Alt held.

### Visit memory

Two cookies, `pr-nav-last` (last path per app) and `pr-nav-recent` (the last 8
menu pages with their labels; a detail page such as `/rutas/123` is stored as its
menu page `/rutas`), are kept for 30 days. They go with every request to every
`*.partrunner.ai` host, so they stay small (paths up to 160 characters; the
recent list drops its oldest entries past 1500 encoded characters; the last list
drops its oldest apps past 2000). They hold the pathname only, never the query or
the hash. Login, logout, `/auth/*`, `/sso*`, `/unauthorized`, and
`/solicitar-acceso` are never stored (`NAV_MEMORY_IGNORE`). `pr-nav-last` keeps
the exact path, so a detail path such as `/rutas/<id>` is stored there for 30
days. Both cookies get `Secure` on https. The names carry the environment
(`pr-nav-last-staging` on staging hosts; see `navMemoryCookieNames()`).

Finanzas lives on `partrunner.app` and cannot read `.partrunner.ai` cookies. Its
rows therefore open start pages, and its visits do not reach the other apps (it
has no shared last-page memory). The way back still works for it: the fragment
travels in the link, and `sessionStorage` is per origin.

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
