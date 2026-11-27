---
'@partrunner-ai/ui': minor
---

Add `Toaster` and `toast` for the result of an action the person just did. Mount one `Toaster` in the app root; call `toast.success`, `toast.info`, `toast.warning`, `toast.error`, `toast.loading`, `toast.promise` and `toast.dismiss`. Each toast takes `description`, one `action` (for example «Reintentar» or «Deshacer»), `id`, `duration` and `onClose`. Toasts show at the bottom right, at most 3 at once, in package tokens for light and dark mode. Success and info close after 5 s, warning after 8 s, an error stays until the person closes it and is announced as an alert, and a toast with an action stays so a keyboard user can reach it. The package wraps `sonner` as a regular dependency, so apps import everything from `@partrunner-ai/ui` and do not install or import `sonner`.

Add `useConfirm`, a promise-based `ConfirmDialog` for an event handler that used to call `window.confirm`: `const { confirm, dialog } = useConfirm()`, render `dialog` once, and `await confirm({ title, description, confirmLabel, destructive })` resolves `true` or `false`. It needs no provider. Apps can delete their local confirm helpers.

Add `density="ledger"` to `Table` and `TableRoot` for a full-page operational table (36 px rows, 13 px text, a 32 px header, stripes on even rows, and an accent bar on the selected row), and `isRowSelected` to the data-driven `Table`, which marks a row with `data-state="selected"`.

`Skeleton` takes `groupClassName` (classes for the group when `lines` > 1; `className` stays on each bar), and a single `Skeleton` that gets a `role`, `aria-label` or `aria-labelledby` is no longer `aria-hidden`.

`DESIGN.md` has a new section «Feedback: choose one channel» (FormField, Notice, toast, ConfirmDialog) and a new recipe, `recipes/feedback.md`.

Migration for an app that uses `sonner` directly: replace `import { toast, Toaster } from 'sonner'` with `@partrunner-ai/ui`, mount the package `Toaster` once in place of the app one (remove `richColors` and `position`), use `toast.info` in place of `toast.message` and plain `toast()`, and move a `cancel` button into `action` or into a `ConfirmDialog`. No `--pr-*` variable changes meaning.
