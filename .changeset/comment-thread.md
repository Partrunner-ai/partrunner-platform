---
'@partrunner-ai/ui': minor
---

Add `CommentThread`, a chat-style thread of internal comments: bubbles, quoted
replies, reactions, image and file attachments, `@mentions` with suggestions and
AI-agent messages that stream in (`pending` → `streaming` → `sent`). It is
controlled and transport-free: the app passes `messages` and callbacks
(`onSend`, `onEdit`, `onDelete`, `onReact`, `onSearchMentions`, `onUpload`,
`onFollowChange`, `onLoadOlder`) and serves files through `attachmentHref`.

Bodies are plain text with `<@u:UUID>` / `<@a:handle>` mention tokens.
`parseCommentBody`, `serializeCommentDraft`, `commentDraftFromBody`,
`commentPlainText`, `activeMentionQuery` and `mergeCommentMessages` convert
between stored bodies, drafts and polling deltas; `prepareCommentFile` shrinks
large photos in the browser before upload. Styles ship in `ui.css` under
`.pr-comments*`.
