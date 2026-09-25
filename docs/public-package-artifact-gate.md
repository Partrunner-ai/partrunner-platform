# Public package artifact gate

Status: validation only. This gate does not publish packages or change a
registry.

Run it after the workspace build:

```bash
pnpm build
pnpm packages:check
```

The gate discovers exactly six publishable packages:

- `@partrunner-ai/api-core`
- `@partrunner-ai/app-registry`
- `@partrunner-ai/seamless`
- `@partrunner-ai/shell`
- `@partrunner-ai/tokens`
- `@partrunner-ai/ui`

For each package it creates the exact tarball and verifies:

- every `main`, `module`, `types`, and conditional export target exists;
- source, tests, local registry config, key files, and workspace protocols are
  absent;
- common credential patterns are absent from text artifacts and source maps;
- every emitted bare runtime import is declared as a dependency or peer, except
  for an explicit reviewed optional-runtime allowlist;
- every packed internal dependency points at the exact packed workspace
  version;
- every CSS import and local `url()` asset resolves from the tarball or a
  declared dependency;
- no package publish lifecycle hook can mutate files after validation;
- repository, license, and `files` metadata are present;
- package README, MIT text, trademark notice, and bundled font OFL notices are
  present and complete;
- public npm metadata uses public access, a canonical version at `1.0.0` or
  later, and the expected MIT or MIT-and-OFL license expression.
- project npm configuration contains only the anonymous npmjs registry and no
  scoped registry or authentication setting.

It then installs all six tarballs into clean npm and pnpm fixtures with package
authentication variables removed and the public registry selected explicitly.
The fixtures execute ESM and CommonJS roots, resolve every declared subpath, and
compile every JavaScript subpath from both `.ts` and CommonJS `.cts` consumers.
Project declarations, including the optional Next adapter against minimal host
stubs, compile with library checking enabled. A separate real-Next smoke compile
uses `skipLibCheck` only for Next's upstream declarations. The fixture matrix runs against
both React 18 and React 19 with strict peer-dependency handling, including the
Vercel adapter's host types. Separate npm and pnpm fixtures prove that
`@partrunner-ai/seamless/server` installs and executes without React or Lucide.

The same check runs inside the release script after its build and before
Changesets can publish, so a failed gate cannot race an independent CI job.

Source maps with embedded source text are reported as a review count. They do
not fail the gate because the repository source is public, but every embedded
source string is still scanned and the count remains visible for review.

For the frozen bootstrap candidate, retain the exact verified tarballs and
their SHA-512 ledger without repacking. The command creates a detached,
disposable checkout, installs from the lockfile, rebuilds every generated path,
and runs the complete gate there:

```bash
pnpm bootstrap:artifacts
```

Preparation requires a clean committed source worktree and an absent output
directory. The generated `.artifacts/npm-bootstrap/manifest.json` records the
source commit, source tree, byte count, filename, version, and integrity for
each tarball.

This is an artifact and dependency-closure gate, not a proof that arbitrary
runtime-generated JavaScript is benign. It rejects unsupported reflective
loader forms, while normal computed application callbacks remain subject to
source review and the repository test suite.

## Published-version drift

A published npm version is immutable, and the publish preflight refuses to
release while any already-published version no longer matches its rebuilt
tarball. CI therefore also runs, after the build:

```bash
pnpm packages:published-check
```

The check asks Changesets which packages the pending Changesets will version,
including dependents that Changesets bumps on its own. For each other package
whose current version is already on npm, it packs the workspace and compares
the tar contents with the published tarball, after it checks the download
against the registry integrity. Any difference fails with the changed paths and
the packages that need a Changeset. This catches changes that look inert but
still ship, such as a devDependency bump in `package.json`, or token CSS that
`shell` rebundles when only `tokens` was named.

It also fails when a package keeps its version but names a versioned workspace
package in any dependency field. `pnpm pack` writes that exact version into the
packed `package.json`, so the file changes at version time. For example, a
`tokens` release always changes the packed `package.json` of `shell`, which
names `tokens` only as a devDependency.

Unpublished versions, such as a merged version PR awaiting release, are
skipped. The check needs network access to the public registry. Each registry
request times out after 30 seconds and is tried 3 times, including after a
`429` or `5xx` answer. After that the check fails closed.

The check calls the same Changesets libraries as `changeset version`, through
root devDependencies. A unit test fails if they resolve to different copies
than `@changesets/cli` uses, so update them together with the CLI.
