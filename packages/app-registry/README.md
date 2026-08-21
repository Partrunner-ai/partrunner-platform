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

Server code and non-React tools can import the framework-free URL entry without
installing the optional React peers:

```ts
import {
  buildAppUrl,
  configureAppRegistry,
} from '@partrunner-ai/app-registry/url';
```

Licensed under MIT. See `TRADEMARKS.md` for trademark terms.
