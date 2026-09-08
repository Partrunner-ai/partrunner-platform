---
'@partrunner-ai/shell': minor
---

Make the notification badge count what is NEW since the last open, not what is unread.

Until now the only way to lower the badge was to destroy content: the panel offers "mark all as
read" and nothing else, so the number stayed put and stopped reading as a signal. In production
that is exactly what happened — of 219 reads, 185 came from three "mark all" clicks, and only 7
notifications were ever read one at a time. The full inbox got 5 visits in 45 days while the shell
snapshot was loaded 6,357 times.

Seeing is not reading. Opening the panel now clears the badge and leaves the unread inbox intact,
so the person can still work through it — the pattern GitHub, Linear and Slack all settled on.

New API, all additive and all optional:

- `StaffNotificationsState.unseenCount` — unread notifications that also arrived after this
  person's last open. The badge prefers it and falls back to `unreadCount` when a host does not
  report it, so an app on this version talking to a backend that predates it keeps the old meaning
  instead of showing a zero nobody computed.
- `StaffShellContextValue.markNotificationsSeen` — fired once per open, on the closed → open edge.
  It must never touch read state.
- `NotificationCenter` gains the matching `unseenCount` and `onOpen` props.
- `StaffShellSnapshot.notifications.unseenCount` is accepted and validated when present, rejected
  when malformed, and absent is still valid.

`STAFF_SHELL_SNAPSHOT_VERSION` deliberately stays at 1. Consumers reject a snapshot version they
do not know, so bumping it would break every satellite the moment the producer deploys — including
the ones still on shell 1.x. A new optional field, by contrast, older consumers simply ignore.

"Mark all as read" is still governed by `unreadCount`, not by the badge. Tying it to the badge
would make the button vanish the moment someone opens the panel, leaving no way to empty an inbox
that still has unread items in it.
