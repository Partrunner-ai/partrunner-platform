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

React 18 and 19 are supported. Import one token/theme foundation from
`@partrunner-ai/ui` alongside the shell stylesheet.

Licensed under MIT. Included PartRunner artwork is also MIT-licensed; see
`TRADEMARKS.md` for trademark terms.
