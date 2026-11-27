---
'@partrunner-ai/api-core': minor
---

Target admin feature flags by Nexus permission. `FeatureFlagTargeting` has a new
`admin_permissions` list of permission codes (for example `supply.fleets.read`).
`validateTargeting` accepts only codes of two or more dot-separated lowercase
segments; one bad code makes the targeting invalid, so the flag stays off.
`evaluateFlagDecision` takes `actor.permissions` and `evaluateFlag` takes
`permissions` in the admin context. An allowlist flag matches when the email is
listed or when the actor holds any listed code. An actor that holds `'*'`
matches any non-empty permission list. The caller passes the effective
permissions; the package stays pure.

Behaviour change: role targeting is retired. `admin_roles` is no longer
validated or matched, and `normalizeTargeting` (so `parseTargetingResult` and
`mergeTargetingIntoValueJson`) leaves it out. An admin form that saves through
`mergeTargetingIntoValueJson` drops `admin_roles` from the row. The `roles` and
`role` actor fields and `FEATURE_FLAG_ADMIN_ROLES` stay for compatibility and
are deprecated.

This ships as a minor on purpose, like the 1.5.0 behaviour change. Production
has one row with `admin_roles` (`portal_fleet_opportunity_offers`) and its mode
is `all`, so no live flag changes. nexus-portal and Supply move to
`admin_permissions` in the same rollout.
