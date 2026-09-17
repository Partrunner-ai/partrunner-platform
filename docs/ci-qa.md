# CI and QA

CI runs one `build` job: install, build, verify publishable artifacts,
typecheck, lint, test and browser tests. It also runs a `docs-only` job that
resolves the change set and validates the classifier.

## Docs-only lane

`scripts/ci/docs-only.mjs` decides whether a change is documentation-only. A
change qualifies only when **every** changed path is curated instruction
Markdown: root `AGENTS.md`, `CLAUDE.md`, `CONTEXT.md`, `README.md`, or a
`docs/**/*.md` file.

- The `docs-only` job resolves the pushed range (`github.event.before`) or the
  pull request merge base. First pushes, force pushes, manual events, missing or
  malformed metadata and empty ranges are not docs-only.
- The classifier and its tests run in that job, so they cannot be skipped by the
  lane they protect.
- `.partrunner/repo-policy.yml` is parsed and validated structurally; a policy
  change is never classified as docs-only.
- The `build` job stays unconditional. This repository has no aggregate check
  that could accept a skipped required job, and branch protection still requires
  `build`, so skipping it would block merges. Adding a docs-only CI skip needs a
  protected aggregate first; that is a deliberate, documented limit.
- Preview builds are bounded separately: `vercel.json` points its Ignored Build
  Step at `scripts/ci/should-deploy-preview.mjs`, which skips a preview only when
  the range since the previously deployed commit is entirely curated docs.
  Production deployments, unknown metadata and mixed ranges always build.

Run the checks without installing dependencies:

```sh
node --test scripts/ci/docs-only.test.mjs scripts/ci/should-deploy-preview.test.mjs
```

## Activation

`build` is the existing required check. The `docs-only` job is additive and does
not modify branch protection. Do not require a check whose producer has not
landed on `main`.
