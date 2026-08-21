# Public repository cutover

The existing private repository must not be made public or have its history
force-rewritten.

## Targets

- Private archive: `Partrunner-ai/partrunner-ui-archive`
- New public repository: `Partrunner-ai/partrunner-platform`

## Procedure

1. Freeze an approved `main` commit after the sanitation work, the
   [public npm cutover](public-npm-cutover.md), and the approved initial-version
   contract are merged.
2. Run the complete repository and package-artifact verification suite.
3. Create a source snapshot with `git archive` from that exact commit.
4. Create `Partrunner-ai/partrunner-platform` as an empty private repository
   without an initial README, license, or `.gitignore`.
5. Create and protect the `npm` environment before the workflow file reaches
   GitHub. Restrict it to `main`, require approved reviewers, and leave
   `NPM_RELEASE_ENABLED` unset.
6. Initialize `main` from the snapshot and create one root commit using an
   approved public author name, public-safe email, and signing identity.
7. Push only `main`; do not push tags or any source-repository refs.
8. Configure branch rules, required human review, the required `build` status,
   secret scanning, and push protection. Version PRs are human-authored and
   must pass the same pull-request CI before merge.
9. Verify the private repository tree matches the approved archive byte for
   byte. Confirm it has exactly one commit, one branch, no tags, and reviewed
   author, committer, signature, and timestamp metadata.
10. Rename the existing repository to `partrunner-ui-archive`, verify it remains
   private and its GitHub Packages remain readable, then archive it.
11. Make `partrunner-platform` public only after final human approval.
12. Immediately enable and verify private vulnerability reporting before
    announcing the repository.

Do not copy old branches, tags, issues, pull requests, Actions artifacts, or
Git history into the public repository. Recreate only reviewed public-safe
metadata.
