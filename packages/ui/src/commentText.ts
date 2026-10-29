/**
 * Text helpers for `CommentThread`. Framework-free and transport-free.
 *
 * A stored comment body is plain text with mention tokens: `<@u:UUID>` for a
 * person and `<@a:handle>` for an AI agent. The server extracts mentions from
 * those tokens, so what gets notified is exactly what the text shows. While
 * typing, the composer shows `@Name` instead and remembers which names were
 * picked from the suggestions; `serializeCommentDraft` turns them back into
 * tokens on send.
 */

export type CommentMentionKind = 'user' | 'agent';

export interface CommentMention {
  kind: CommentMentionKind;
  /** A user id for people, the handle for agents. */
  id: string;
  name: string;
}

export type CommentSegment =
  | { type: 'text'; text: string }
  | { type: 'mention'; kind: CommentMentionKind; id: string; name: string };

const TOKEN_RE = /<@(u|a):([0-9A-Za-z_-]+)>/g;

/** Splits a stored body into text and mention segments, naming each mention. */
export function parseCommentBody(body: string, mentions: readonly CommentMention[] = []): CommentSegment[] {
  const names = new Map(mentions.map((m) => [`${m.kind}:${m.id.toLowerCase()}`, m.name]));
  const segments: CommentSegment[] = [];
  let last = 0;
  for (const match of body.matchAll(TOKEN_RE)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ type: 'text', text: body.slice(last, index) });
    const kind: CommentMentionKind = match[1] === 'u' ? 'user' : 'agent';
    const id = match[2] ?? '';
    const name = names.get(`${kind}:${id.toLowerCase()}`) ?? (kind === 'agent' ? id : 'alguien');
    segments.push({ type: 'mention', kind, id, name });
    last = index + match[0].length;
  }
  if (last < body.length) segments.push({ type: 'text', text: body.slice(last) });
  return segments;
}

/** Body as readable text (`@Name`), for quotes, previews and editing. */
export function commentPlainText(body: string, mentions: readonly CommentMention[] = []): string {
  return parseCommentBody(body, mentions)
    .map((s) => (s.type === 'text' ? s.text : `@${s.name}`))
    .join('');
}

/**
 * Draft text → stored body. Every `@Name` that the user picked from the
 * suggestions becomes its token; anything else stays as typed. Longer names
 * go first so "@Ana Ruiz" is not cut short by a picked "@Ana".
 */
export function serializeCommentDraft(text: string, picked: readonly CommentMention[]): string {
  const unique = new Map<string, CommentMention>();
  for (const m of picked) unique.set(`${m.kind}:${m.id}`, m);
  const ordered = [...unique.values()].sort((a, b) => b.name.length - a.name.length);
  if (ordered.length === 0) return text;

  const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`@(${ordered.map((m) => escape(m.name)).join('|')})(?![\\p{L}\\p{N}_])`, 'gu');
  const byName = new Map(ordered.map((m) => [m.name, m]));
  return text.replace(pattern, (whole, name: string) => {
    const m = byName.get(name);
    if (!m) return whole;
    return m.kind === 'user' ? `<@u:${m.id}>` : `<@a:${m.id}>`;
  });
}

/** Stored body → draft text plus the mentions it carries (to edit a message). */
export function commentDraftFromBody(
  body: string,
  mentions: readonly CommentMention[] = [],
): { text: string; picked: CommentMention[] } {
  const picked: CommentMention[] = [];
  const text = parseCommentBody(body, mentions)
    .map((s) => {
      if (s.type === 'text') return s.text;
      picked.push({ kind: s.kind, id: s.id, name: s.name });
      return `@${s.name}`;
    })
    .join('');
  return { text, picked };
}

/**
 * The `@query` being typed right before the caret, if any: an `@` at the start
 * or after whitespace, followed by up to 40 non-newline characters.
 */
export function activeMentionQuery(text: string, caret: number): { start: number; query: string } | null {
  const before = text.slice(0, caret);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1] ?? '')) return null;
  const query = before.slice(at + 1);
  if (query.length > 40 || /[\n@]/.test(query) || /\s{2}/.test(query)) return null;
  return { start: at, query };
}

/**
 * Merges changed messages into a list by id, keeping chronological order.
 * Used to apply a polling delta or an optimistic update without reloading.
 */
export function mergeCommentMessages<T extends { id: string; createdAt: string }>(
  current: readonly T[],
  changes: readonly T[],
): T[] {
  if (changes.length === 0) return current as T[];
  const byId = new Map(current.map((m) => [m.id, m]));
  for (const m of changes) byId.set(m.id, m);
  return [...byId.values()].sort((a, b) =>
    a.createdAt === b.createdAt ? a.id.localeCompare(b.id) : a.createdAt < b.createdAt ? -1 : 1,
  );
}
