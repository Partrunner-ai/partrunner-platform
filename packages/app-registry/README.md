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

`APPS` is in the order of the work: Home, Comercial, Solicitudes, Supply,
LiveOps, Finanzas, FDS, Comunidad. `APP_BAR_APPS` is `APPS` without the apps
that set `appBar: false` (Comunidad) and without `comingSoon` apps. The shell's
`navigation="appbar"` mode renders it as the app bar.

Server code and non-React tools can import the framework-free URL entry without
installing the optional React peers:

```ts
import {
  buildAppUrl,
  configureAppRegistry,
} from '@partrunner-ai/app-registry/url';
```

Licensed under MIT. See `TRADEMARKS.md` for trademark terms.
