# Contributing

## Development

Use Node 22 or later and the pnpm version declared in `package.json`.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm packages:check
pnpm typecheck
pnpm lint
pnpm test
pnpm test:browser
```

Keep non-UI server and URL entries framework-free. Declare UI framework peers
explicitly and isolate optional adapters behind package subpaths. React entries
must work across the supported React and build-tool generations.

## Changes

- Open a focused pull request against `main`.
- Add or update tests for behavior changes.
- Add a Changeset for any publishable package change. A change to a package's
  `devDependencies` needs no Changeset and no version when the built files do
  not change: `pnpm packages:published-check` ignores that field, because
  consumers never install it. A dev tool update that changes the build output
  still fails the check and needs a version. The check rejects any other
  difference, also a formatting change in `package.json`, an execute bit, or an
  empty directory. The release step accepts only the `devDependencies` status.
- Treat a token meaning change, removed export, or removed interface as a major.
- Do not commit credentials, local registry configuration, generated reports,
  or private operational data.

Every pull request requires passing CI, independent automated review, and human
approval.
