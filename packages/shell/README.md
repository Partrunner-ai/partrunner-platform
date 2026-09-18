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

### Avoiding the hydration flash

Without `initialState`, `AppShell` always renders expanded on the server —
it only knows the collapsed/groups preference after mounting, so a returning
visitor sees a flash from expanded to collapsed on every load. Read the
request cookie on the server and pass it in as `initialState`, built with
`parseAppShellState` from the `./preferences` entry:

```tsx
// Server Component (e.g. a Next.js layout)
import { cookies } from 'next/headers';
import { AppShell } from '@partrunner-ai/shell';
import { parseAppShellState } from '@partrunner-ai/shell/preferences';

export default async function Layout({ children }: { children: React.ReactNode }) {
  const cookieHeader = (await cookies()).toString();
  const initialState = parseAppShellState(cookieHeader); // uses the default 'pr-sidebar-collapsed' key

  return (
    <AppShell sections={sections} currentPath="/" initialState={initialState}>
      {children}
    </AppShell>
  );
}
```

Pass the same `collapseStorageKey` to both `parseAppShellState` and
`AppShell` if the app overrides the default key. This only helps when
`collapseStorage="cookie"` — `localStorage` isn't readable on the server,
so there is no server-derived state to pass for it.

React 18 and 19 are supported. Import one token/theme foundation from
`@partrunner-ai/ui` alongside the shell stylesheet.

Licensed under MIT. Included PartRunner artwork is also MIT-licensed; see
`TRADEMARKS.md` for trademark terms.
