---
'@partrunner-ai/seamless': minor
---

Remove fixed waits from the transitions. `SeamlessExitProvider.navigateTo` now navigates after the overlay has had one paint (two animation frames) instead of waiting 460 ms, and clears the overlay on a bfcache return. `SeamlessSplash` measures `minDurationMs` from navigation start and fades in 0.2 s. New `@partrunner-ai/seamless/timing` entry with `watchPageReady` and `navStartFor` to record real page-ready timings.
