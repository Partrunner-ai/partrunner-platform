# PartRunner platform agent guide

Read `CONTEXT.md` before planning, editing, or reviewing. Use the package README and linked contract
document for the package you change.

## Work and package constraints

- Start independent work in an isolated worktree. Preserve unrelated changes.
- Keep non-UI server and URL entries framework-free. Declare UI framework peers and isolate optional
  adapters behind subpaths. Support React 18 and 19 without assuming a Tailwind version.
- Changing the meaning of a `--pr-*` variable is a major change. State it and write the migration note.
- For UI composition, use `docs/crystal-guide.md` § 5b. Shared presentation belongs in
  `@partrunner-ai/ui`; product state, routing, data access, and one-off layout remain in the app.

## Delivery and safety

- Follow `.partrunner/repo-policy.yml` for every branch, merge, promotion, review, migration, and
  deployment decision. It is the sole delivery-policy source; `feature_merge: unknown` is a stop,
  not a choice.
- Run change-aware checks and the manifest handoff gate. Request independent change review and
  architecture review when its policy trigger applies.
- A minor reaches consuming apps on their next install. Never expose credentials. A live mutation
  needs current authorization, exact target proof, and before-and-after evidence.
