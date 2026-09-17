# PartRunner platform agent guide

Read `CONTEXT.md` for affected package behavior; reuse unchanged instructions across task phases.
Tooling or documentation-only work needs only relevant instructions and policy. Use the package
README and linked contract document when changing that package's behavior or interface.

## Work and package constraints

- Start independent work in an isolated worktree. Preserve unrelated changes.
- Keep non-UI server and URL entries framework-free. Declare UI framework peers and isolate optional
  adapters behind subpaths. Support React 18 and 19 without assuming a Tailwind version.
- Changing the meaning of a `--pr-*` variable is a major change. State it and write the migration note.
- For UI composition, use `docs/crystal-guide.md` § 5b. Shared presentation belongs in
  `@partrunner-ai/ui`; product state, routing, data access, and one-off layout remain in the app.

## Delivery and safety

- Follow `.partrunner/repo-policy.yml` for every branch, merge, promotion, review, migration, and
  deployment decision. It is the sole delivery-policy source; missing or unknown policy is a stop,
  not a choice.
- Run change-aware checks and the manifest handoff gate. Request one independent review of the
  complete final candidate at the pre-PR/submission checkpoint, not after intermediate edits,
  commits or changed deltas. Batch fixes before resubmission; merge only the final reviewed head.
  Architecture review follows the manifest's invariant/interface triggers.
- A minor reaches consuming apps on their next install. Never expose credentials. A live mutation
  needs current authorization, exact target proof, and before-and-after evidence.
