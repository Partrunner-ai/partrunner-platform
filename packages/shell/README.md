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

Two modes. `'launcher'` is the default: nothing changes without the prop.
`'unified'` is the staff navigation. Every staff app adopts it; there are no
per-app options.

```tsx
<AppShell
  sections={sections}
  currentPath={pathname}
  navigation="unified"
  appSub="supply"
  cookieDomain=".partrunner.ai"
  brandHref="/"
  onNavigate={(event) => track('shell_navigate', event)}
  globalHeader={<GlobalHeader currentSub="supply" />}
>
```

In `'unified'` mode:

- The header shows, in order: the menu button (mobile only), the way back
  («← LiveOps», when the person came from another app), the host `start`, the
  «Buscar o ir a… ⌘K» search field, the apps grid, the theme button, the bell,
  and the avatar. The grid sits where it sits in launcher mode.
- The sidebar shows «Mis apps» under the brand, above the app's menu.
- The brand block opens the start page of the app you are in (`brandHref`, else
  `/`). `onBrandSelect` runs only when you pass it. The pinned «Nexus» item is
  not rendered; Nexus is a tile in the grid and a row in «Mis apps» when marked.
- «Ir a…» (⌘K / Ctrl+K, «/», or the search field) opens a palette. «/» works
  when focus is not in an input, a textarea, a select, or an editable element, and
  with no Ctrl, Meta, or Alt key (Shift is allowed: «/» is Shift+7 on some
  layouts). Some browsers and launcher apps take ⌘K first, so «/» is the
  fallback. The palette lists «Volver» (the way back), «Recientes», and «Apps»
  with the page each one opens. With a query it searches this app's pages,
  recents, the host's page index, and the apps (`appNav` in the registry decides
  which apps; Comunidad is not there). A host can fill `pages` in the
  staff-shell context (`StaffShellPage`: `app`, `label`, absolute `href`,
  `section`) to search other apps' pages.
- `onNavigate({ source, fromSub, toSub, href })` runs before the grid, «Mis
  apps», the way back, the palette, the brand block, or a sidebar link navigates
  (`source`: `'launcher' | 'favorites' | 'goto' | 'wayback' | 'brand' |
  'menu'`). Forward it to usage tracking. A throwing callback is ignored.
- `useShellNavigation()` returns the navigation state (`mode`, `currentPath`,
  `appSub`, `pages`, `activeLabel`, `wayBack`, ...) inside `AppShell`, else
  `null`.

### The way back

When you arrive from another app, «← App» opens the exact page you left. Every
cross-app link the shell builds (grid tiles, «Mis apps» rows, palette rows, the
chip itself) carries a fragment, `#pr-from=<sub>:<encoded pathname>`. On the
first mount the shell reads the fragment, removes only that fragment from the
address bar with `history.replaceState`, and keeps `{ s, p }` in
`sessionStorage` (`pr-nav-from`, per origin and per tab). Without a fragment it
falls back to `document.referrer` when that is the origin of another registry
app, and opens that app's last page, else its start page. Nothing goes to a
server: a fragment is never sent in an HTTP request. A same-app or external link
never gets the fragment. Only hrefs whose origin belongs to an app in `APPS` get
it, so an app that a host adds through a custom `apps` list gets no way back.
Browsers cut a cross-origin referrer to its origin, so any page on
`partrunner.app` counts as Finanzas in the referrer fallback. `pr-nav-last`
holds `{ [sub]: { p, l? } }` (path and the label of its menu page). The older
`{ [sub]: path }` form is still read.

### The apps grid

`GlobalHeader` renders the `AppLauncher` grid in both modes, with the same apps
(Comunidad included). In `'unified'` mode a tile opens the last page used in that
app (the validated path of `pr-nav-last`, else the start page), carries the
way-back fragment when the URL is a registry origin, and reports
`onNavigate({ source: 'launcher', ... })`. The tile of the current app behaves as
before. In launcher mode the grid is unchanged: start pages, no fragment, no
event.

### «Mis apps» in the sidebar

The section lists the apps in `preferences.favoriteApps` (registry subs, in the
person's order, at most 5) of the staff-shell context, each with an icon tile,
the app name, and the page it opens (the last page used there, else «Inicio»). A
click reports `onNavigate` with `source: 'favorites'`; the current app is marked
and routes in place. With `setFavoriteApps` (top level of the context, like
`setTheme`) the section has «Editar»: a checkbox per app (the rest are disabled
at 5) and «Listo»; the shell saves the subs in `APP_NAV_ORDER`. An empty list
shows «Elige tus apps». Without a setter the list is read-only; without a
`StaffShellProvider`, or with no list and no setter, the section is not rendered.
The edit shows at once (optimistic). When `setFavoriteApps` throws or returns a
promise that rejects, the shell puts the previous list back and shows one line,
«No se pudo guardar. Intenta de nuevo.» (`role="status"`). The shell drops subs
the installed registry does not know (or that have `appNav: false`) when it
renders rows and the edit list. The collapsed rail shows the icon tiles only.

Storage: Nexus stores the list in `identity.staff_preferences.favorite_apps` and
sends it as `preferences.favoriteApps` in the staff-shell snapshot.
`parseStaffShellSnapshot` keeps only strings that match `^[a-z0-9-]{1,40}$`,
drops duplicates (the first wins), keeps at most 5 in order, and reads a missing
or non-array value as absent (it never rejects the snapshot for it). A satellite
passes the snapshot `preferences` through and wires `setFavoriteApps` to its
`PATCH /api/staff-shell` BFF with the body `{ favoriteApps }`.

### Adoption steps

1. Set `navigation="unified"` and `appSub` (the registry `sub`) on `AppShell`.
2. Set `cookieDomain=".partrunner.ai"` so the visit memory is shared between
   apps. Without it the memory stays on one host.
3. Set `brandHref` when the start page of the app is not `/`, for example
   `/admin/dashboard` for Finanzas.
4. Forward `onNavigate` to usage telemetry.
5. Remove `SidebarTrigger` from `start`: the header renders the menu button
   first (mobile only). Also remove any app-name label from `start` (for example
   «LiveOps»): the sidebar and the grid already show where you are.
6. Pass the snapshot `preferences` (with `favoriteApps`) through and wire
   `setFavoriteApps` in the staff-shell context. Until Nexus sends the list, the
   section stays hidden.
7. Pass `navMemoryIgnore` for extra paths that must not be remembered.
8. A page that owns its own ⌘K or «/» (Supply has a ⌘K in
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
