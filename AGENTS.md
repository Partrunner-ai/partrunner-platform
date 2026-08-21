# PartRunner platform agent guide

Read `CONTEXT.md` before you plan, edit, or review this repository. Use its defined terms.

## Work isolation

- Start independent feature, fix, tooling, and documentation work in a new Git worktree unless the
  current checkout is already an isolated worktree for this task.
- Base the worktree on the integration branch in `.partrunner/repo-policy.yml`.
- Use one branch per task. Preserve unrelated local changes.

## Engineering

- Choose the simplest implementation that meets the current requirements.
- Remove obsolete paths when the task permits it. Do not add speculative compatibility layers.
- Prefer existing, maintained dependencies and repository seams.
- Keep modules focused and concerns separate.
- Build the smallest working end-to-end slice before adding capability.
- Keep non-UI server and URL entries framework-free. Declare UI framework peers
  explicitly and isolate optional adapters behind subpaths. Assume no Tailwind
  version. Consuming apps run multiple stack generations on React 18 and 19.
- Changing what a `--pr-*` variable means is a major even when the name stays. Say so, and write the
  migration note.

## Communication

- Use short, active sentences and one term for one concept.
- State exact targets, evidence, unknowns, and remaining risks.

## Delivery

- Follow the branch, promotion, migration, and deployment facts in `.partrunner/repo-policy.yml`.
- Run change-aware tests before handoff. Do not claim success without current command output.
- Open a ready PR to the integration branch unless the work is incomplete or the user asks for a
  draft.
- After implementation, request an independent agent review. Resolve or rebut every finding before
  merge. Keep human approval required.
- Request an independent architecture critique before high-risk or cross-system implementation.
  This includes any new long-lived platform seam.

## Safety

- Never print, commit, or copy secrets into chat or logs.
- Verify the exact provider, project, environment, tenant, and branch before a live mutation.
- A production mutation needs explicit authorization in the current conversation.
- A minor reaches every consuming app on its next install. Treat an accidental behaviour change as a
  fleet-wide incident, not a local one.
