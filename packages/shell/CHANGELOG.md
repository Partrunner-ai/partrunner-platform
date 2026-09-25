# @partrunner-ai/shell

## 2.3.0

### Minor Changes

- The expanded sidebar brand block now renders the canonical PARTRUNNER
  wordmark (black cut, embedded byte-identical) with the app lettering under
  it, instead of the isotype plus a lettered brand name. The isotype remains
  the collapsed rail's mark, and an app-supplied `logo` or custom `brandName`
  keeps rendering as before. New export: `BrandWordmark`.

### Patch Changes

- `theme.css` now inlines `@partrunner-ai/tokens@2.0.2`, so the muted sidebar
  ink (`--pr-sidebar-fg-muted`) is AA-legible over the darkest sidebar stop.

## 2.2.0

### Minor Changes

- Ring the notification bell while something has arrived since the last open.
  
  The bell swings only on `unseenCount`, never on the `unseenCount ?? unreadCount`
  fallback the badge uses: unread only falls by marking, so a host that does not
  report unseen yet would get a bell shaking forever. It also stops the moment the
  panel opens, and holds still under `prefers-reduced-motion` — where the count
  remains, since that is what carries the information.

## 2.1.0

### Minor Changes

- Make the notification badge count what is NEW since the last open, not what is unread.

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

## 2.0.2

### Patch Changes

- Updated dependencies:
  - @partrunner-ai/app-registry@1.4.0

## 2.0.1

### Patch Changes

- Publish the first routine npm release through Trusted Publishing with registry provenance.
- Updated dependencies:
  - @partrunner-ai/app-registry@1.3.1

## 2.0.0

### Major Changes

- Partrunner Crystal v2 is the official design system and the default theme.

  The `crystal` theme becomes canonical: `theme.css`/`light.css` bundles and the
  shell's inline theme now ship Crystal v2 surfaces, radii (10/14/22px), the
  crystal easing, the gradient sidebar, and the brand-sweep primary button with
  its glow. Typography stays on the approved pair (Bebas Neue display, Barlow
  body). The semantic contract gains the Crystal v2 expressive layer — accent
  family (`accent-hover/deep/tint/tint-faint`), five-step slate shadow scale,
  brand glows, glass surfaces, page/card gradients, noise texture, display
  tracking, `radius-card`/`radius-xl` — plus new primitives extracted from the
  onboarding prototype: `Stepper`, `ProgressDots`, `OtpInput`, `ProgressRing`,
  `ProgressBar`, `CopyField`, and `AmbientBackground`.

  BREAKING: default visuals change on upgrade (see `docs/migration-2.0.md` for
  the full token table). Crystal's `accent-strong` moves `#ecb800 → #f0bc00`;
  the sidebar's deep stop moves to the new `sidebar-bg-strong`. The pre-2.0
  `nexus` theme is deprecated to a compatibility export (`nexus.css`), removed
  in 3.0.
