# @partrunner-ai/app-registry

Canonical PartRunner application metadata and environment-aware URL building.

## Install

```bash
pnpm add @partrunner-ai/app-registry lucide-react react
```

## Usage

```ts
import {
  APPS,
  appHref,
  configureAppRegistry,
  findApp,
} from '@partrunner-ai/app-registry';

configureAppRegistry({
  hostPrefix: '',
  baseDomain: 'example.com',
});

const href = appHref(findApp('supply')!);
```

The root registry includes Lucide React icon components. A host configures its
environment once and uses the same `APPS` records for launchers and links.

`APPS` keeps its order (the launcher grid uses it). `APP_NAV_ORDER` is the order
of the work for the shell's staff navigation: Home, Comercial, Solicitudes, Supply, LiveOps,
Finanzas, FDS. `APP_NAV_APPS` is `APPS` sorted by it, without the apps that set
`appNav: false` (Comunidad) and without `comingSoon` apps. The shell's
`navigation="unified"` mode uses it for «Mis apps» and the «Ir a» app list; the grid still shows every app.

Server code and non-React tools can import the framework-free URL entry without
installing the optional React peers:

```ts
import {
  buildAppUrl,
  configureAppRegistry,
} from '@partrunner-ai/app-registry/url';
```

Licensed under MIT. See `TRADEMARKS.md` for trademark terms.
