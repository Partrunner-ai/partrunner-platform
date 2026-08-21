# Public npm cutover sequence

The registry change and complete initial-version contract must land in one
cutover pull request. Do not merge a manifest that points at npmjs while API
Core or Seamless is still below `1.0.0`. The later registry bootstrap is a
guarded, resumable operation because npm cannot create six packages atomically.

## Cutover pull request

1. Merge a guard-only change that requires the exact public repository name and
   `NPM_RELEASE_ENABLED=true` for every release-capable job. Then delete the old
   repository's Release workflow runs that remain rerunnable, verify none
   remain, and close the stale generated version PR.
2. Start the cutover from that guarded commit.
3. Confirm `.changeset/config.json` uses the repository's hash-free changelog
   formatter and excludes private workspace versioning. Run `pnpm changeset
   version` to materialize all pending versions and consume the pending
   Changesets.
4. Switch all six manifests and Changesets to public npm access.
5. Replace the scoped GitHub Packages configuration with anonymous npmjs
   installation.
6. Split `release.yml` into fail-closed plan, version-PR, and publish jobs with
   all of these requirements:
   - `id-token: write`, with no `packages: write`;
   - Node 24 and npm exactly `11.15.0` for publishing;
   - publish the retained, integrity-checked tarballs with npm itself; do not
     delegate publication to Changesets or pnpm;
   - npmjs selected by the checked-in anonymous `.npmrc`, without setup-node
     injecting an auth token;
   - no `NODE_AUTH_TOKEN`, `NPM_TOKEN`, or registry secret;
   - pending Changesets fail with instructions for a maintainer to run `pnpm
     run version` on a branch and open a normal, human-authored pull request;
   - version PRs pass the repository's normal required CI and human review;
   - protected environment `npm`;
   - repository is exactly `Partrunner-ai/partrunner-platform`;
   - repository variable `NPM_RELEASE_ENABLED` is exactly `true`.
7. Update the artifact gate to require npmjs, public access, stable versions at
   or above `1.0.0`, exact internal package versions, and optionally retained
   tarballs with a SHA-512 ledger.
8. Scan the materialized tree for source-repository commit IDs and links, run
   the complete handoff suite, and merge into the private source repository.
   The repository-name guard must make its release job a no-op.

Do not merge the automatically generated version PR separately; the cutover PR
owns the materialized versions.

Approved initial public versions:

- API Core `1.0.0`
- App Registry `1.3.0`
- Seamless `1.0.0`
- Shell `2.0.0`
- Tokens `2.0.0`
- UI `2.0.0`

Crystal v2 is the first npmjs release of Shell, Tokens, and UI. Do not publish
the superseded 1.x bridge versions to npmjs. Older releases stay readable in
GitHub Packages during consumer migration, but npmjs starts at the versions
listed above.

## Future version PRs

The release workflow does not create pull requests with `GITHUB_TOKEN`.
When `main` contains Changesets, its `version-required` job fails visibly. A
maintainer must:

1. create a branch from that exact `main`;
2. run `pnpm install --frozen-lockfile` and `pnpm run version`;
3. verify the hash-free changelogs and package versions;
4. commit and open a normal pull request;
5. wait for required CI, independent review, and human approval before merge.

The merge removes the Changesets and exposes unpublished versions to the
guarded publish job.

## Bootstrap and trusted publishing

OIDC cannot create a package that does not yet exist.

1. Create the empty private `partrunner-platform` repository. Before pushing
   the workflow-containing root, create and protect the `npm` environment:
   restrict it to `main`, require approved reviewers, disable administrator
   bypass where policy permits, verify through the GitHub API, and leave
   `NPM_RELEASE_ENABLED` unset.
2. Push the clean one-root commit using the repository cutover checklist.
   Verify the Release workflow is skipped.
3. Run `node scripts/release-plan.mjs --initial-release-preflight` and require
   the exact approved package/version matrix, `mode: publish`, no pending
   Changesets, all six current versions marked `published: false`, and all six
   packages marked `publicRegistryEmpty: true`. This anonymous check proves
   only that no package version is publicly visible now. It cannot detect a
   restricted package or an exact version that was published and then fully
   unpublished. It does not authorize publication.
4. Run `pnpm bootstrap:artifacts` once to rebuild in a disposable checkout and
   retain the six verified tarballs plus their SHA-512 ledger from that exact
   root commit. Publish those files; never repack.
5. Before any publication, authenticate as the approved npm maintainer and run
   `npm whoami --registry https://registry.npmjs.org` plus `npm access list
   packages @partrunner-ai --json`. Verify the exact account, organization, and
   authenticated package inventory. Stop if any target package exists as a
   restricted package. Obtain provider-authoritative organization history or
   npm Support confirmation that none of the six exact name/version pairs was
   published and then removed. npm never permits reuse of an unpublished exact
   version, while an anonymous `404` does not preserve that history. Do not
   start the bootstrap without this evidence.
6. With explicit production authorization, create a shortest-lived granular
   npm access token scoped to the Partrunner organization with package
   read/write only and no organization-management permission. Use required 2FA
   to publish each exact initial tarball under a non-default `bootstrap`
   dist-tag. A brand-new npm package cannot use staged publishing, so this
   bootstrap is resumable, not atomic. Publish dependency roots first: App
   Registry, Tokens, and API Core; then Seamless, Shell, and UI. After each
   package, record its integrity and dist-tags before continuing. If npm
   unexpectedly creates `latest`, remove that tag immediately and stop on any
   mismatch.
7. Make the repository public using the repository cutover checklist.
8. Configure each existing npm package's trusted publisher for
   `Partrunner-ai/partrunner-platform`, `release.yml`, and the protected `npm`
   environment with `npm publish` explicitly allowed. Verify every trust record
   with `npm trust list <package> --json`. Run trust commands with npm
   `11.15.0` and the non-bypass granular token; npm trust does not accept a
   bypass-2FA token.

   ```bash
   npm trust github <package> \
     --repo Partrunner-ai/partrunner-platform \
     --file release.yml \
     --env npm \
     --allow-publish \
     --yes
   ```
9. Move every verified initial version to `latest`, remove every temporary
   `bootstrap` tag, and verify the final tag ledger. Then revoke the bootstrap
   token. Confirm revocation with `npm whoami --registry
   https://registry.npmjs.org` using the revoked credential; it must fail. Do
   not test revocation by attempting another publication.
10. Set `NPM_RELEASE_ENABLED=true`. Future Changeset releases then use OIDC.

### Bootstrap failure procedure

Treat the six publications as resumable, not atomic. On any timeout, mismatch,
or failed package:

1. Record the exact package/version, retained integrity, registry integrity,
   and dist-tags already observed.
2. Remove any unexpected `latest` tag while the token is still usable. Revoke
   the bootstrap token in a guaranteed cleanup step even if tag cleanup fails.
3. Do not unpublish or overwrite an immutable version. Leave matching partial
   publications quarantined under the `bootstrap` tag.
4. Resume only with a new short-lived token. Re-query every exact version:
   skip an existing version only when its integrity matches the retained
   ledger, publish missing versions in dependency order, and abort to a
   forward-fix version if any integrity differs.

At every live step, verify the exact npm organization, package, version,
dist-tag, GitHub repository, workflow, environment, and commit before mutation.
