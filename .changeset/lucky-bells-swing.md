---
'@partrunner-ai/shell': minor
---

Ring the notification bell while something has arrived since the last open.

The bell swings only on `unseenCount`, never on the `unseenCount ?? unreadCount`
fallback the badge uses: unread only falls by marking, so a host that does not
report unseen yet would get a bell shaking forever. It also stops the moment the
panel opens, and holds still under `prefers-reduced-motion` — where the count
remains, since that is what carries the information.
