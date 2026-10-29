---
"@partrunner-ai/shell": minor
---

The notification bell can play sounds: one when the unseen count goes up, and
one with each shake of the ring animation. Hosts pass the configuration as
`notifications.sound` on the staff-shell context (and the snapshot); without it
the bell stays silent, as before. The shake sound stops after `ringLimit`
shakes, skips the shake right after an arrival sound, follows reduced motion
(no animation, no shake sound) and only plays in the visible tab. New exports:
`playBellSound`, `isStaffBellSound`, `DEFAULT_BELL_SOUND`,
`BELL_ARRIVAL_SOUND_IDS`, `BELL_RING_SOUND_IDS` and their types, also
available without React from the new `@partrunner-ai/shell/bell-sound` subpath.
