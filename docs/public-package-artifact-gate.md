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
tarball, apart from `devDependencies` (below). CI therefore also runs, after the build:

```bash
pnpm packages:published-check
```

The check asks Changesets which packages the pending Changesets will version,
including dependents that Changesets bumps on its own. For each other package
whose current version is already on npm, it packs the workspace and compares
the tar contents with the published tarball, after it checks the download
against the registry integrity. Any difference fails with the changed paths and
the packages that need a Changeset. This catches changes that look inert but
still ship, such as a changed dependency range in `package.json`, or token CSS
that `shell` rebundles when only `tokens` was named.

One field is not compared: the top-level `devDependencies` of the root
`package.json`. Consumers never install it. A change to it needs no Changeset
and no new version when the built files do not change. A dev tool update that
changes the build output still fails the check and needs a version. The check
logs `matches the published tarball apart from devDependencies` for a package
that differs in nothing else.

The rule is exact. The two tarballs must differ only in that one field of the
root `package.json`, and the field must really differ. Every other file, and
every other field of `package.json`, is compared by its bytes and its execute
bit. Every directory, also an empty one, is compared too. A formatting
difference alone in the root `package.json` fails. A nested `package.json`
gets no special rule. A `package.json` that does not parse is compared by its
raw bytes.

The tar entries of both tarballs are checked from the tar headers before
anything is unpacked. Every entry must be a regular file or a directory, under
`package/`, with no `..` segment and no second entry of the same path. Any other
entry (a hard link, a symbolic link, a FIFO, a device, an absolute path, a path
outside `package/`) is an error that names the entry, and nothing is unpacked.
The reader is strict: a bad header checksum, a size that is not plain octal, a
second name header for one entry, or a byte after the end of the archive is an
error.
After the unpack, the tree must hold only the directory `package/`, and only
regular files and directories. A link is never read.

When `devDependencies` really differ, these are not compared:

- the formatting of the root `package.json`. It is compared as parsed JSON, and
  an invalid UTF-8 byte is read as U+FFFD;
- permission bits other than the execute bit. npm sets file modes on install and
  keeps only the execute bit;
- the modification time and the owner of an entry;
- the order of tar entries.

The check also fails when a package keeps its version but names a versioned
workspace package in `dependencies`, `optionalDependencies`, or
`peerDependencies`. `pnpm pack` writes that exact version into the packed
`package.json`, so the file changes at version time. A `workspace:` entry in
`devDependencies` does not count.

The release step (`pnpm run release`) uses the same comparison, but it accepts
only the `devDependencies` status. When a version is already on npm and its
integrity differs from the retained tarball, the step downloads the published
tarball from the registry (the URL must start with
`https://registry.npmjs.org/`, no redirect, 60 second limit), checks it against
`dist.integrity`, and accepts the version only when it differs in
`devDependencies` alone. Equal tar streams with different compressed bytes
still fail there, as before. A missing tarball URL or a non-200 answer fails
before any publish. The step does not publish that version again. The check
after a publish stays byte-exact. The rule lives in
`scripts/packed-contents.mjs`.

Unpublished versions, such as a merged version PR awaiting release, are
skipped. The check needs network access to the public registry. Each registry
request times out after 30 seconds and is tried 3 times, including after a
`429` or `5xx` answer. After that the check fails closed. Any other
unexpected answer, such as `403`, fails at once.

The check calls the same Changesets libraries as `changeset version`, through
root devDependencies. A unit test fails if they resolve to different copies
than `@changesets/cli` uses, so update them together with the CLI.
