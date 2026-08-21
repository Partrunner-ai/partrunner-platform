# PartRunner platform context

## Purpose

This repository is the source of truth for shared PartRunner packages:

- design tokens and fonts;
- accessible UI primitives;
- the application shell and launcher;
- the canonical application registry;
- browser-safe cross-app transitions and server session adapters;
- backend runtime primitives.

Consuming applications install these packages. They retain ownership of product
behavior, user data, routing, authentication policy, and deployment.

## Terms

| Term | Meaning |
| --- | --- |
| Token | A package-owned `--pr-*` CSS variable |
| Primitive | A reusable UI control from `@partrunner-ai/ui` |
| Shell | Shared header, sidebar, launcher, notifications, and user controls |
| App registry | Canonical application metadata and URL construction |
| Core entry | A package's primary export |
| Adapter | Framework- or provider-specific behavior behind an explicit subpath |
| Consuming app | An application that installs these packages |

## Package boundaries

- Framework dependencies are explicit peers for entries that render UI or
  expose icon components.
- Framework-free URL and server behavior uses explicit subpaths.
- Optional React and Next adapters live behind `./react` and `./next` subpaths.
- Secret-bearing Seamless behavior lives behind `./server`.
- Vercel request/response behavior lives behind API Core's `./vercel` subpath.
- API Core never owns a consuming application's identity or authorization
  policy.
- The application registry is canonical; consuming apps do not maintain copies.

## Compatibility

- React 18 and 19 are supported.
- UI packages assume no Tailwind version.
- Complete CSS bundles work without application-side token repair.
- ESM and CommonJS consumers are supported.
- Repository tooling uses Node 22 or later.

## Versioning

Public versions begin at `1.0.0`.

- Major: remove or rename an interface, drop a variant, or change an existing
  token's meaning.
- Minor: add a compatible token, variant, primitive, adapter, or capability.
- Patch: correct behavior without changing the interface.

## Delivery

`main` is the integration and production branch. Packages are the production
artifact. `packages/showcase` may deploy as a static review catalog through
`vercel.json`; it contains fixture data only, has no backend or secrets, and is
not a package release environment. Every publishable change requires current
verification, independent automated review, human approval, and a Changeset.

Provider and production mutations require exact target proof and explicit
authorization.
