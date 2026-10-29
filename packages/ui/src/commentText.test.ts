import { describe, expect, it } from 'vitest';
import {
  activeMentionQuery,
  commentDraftFromBody,
  commentPlainText,
  mergeCommentMessages,
  parseCommentBody,
  serializeCommentDraft,
} from './commentText';

const ANA = '7d1e4c88-2a9f-4b30-8e6c-51f0a7d2c934';
const ANABEL = '5c9e2b71-0d4a-4e83-b6f2-9a1c7d3e8f40';

describe('commentText', () => {
  it('parses tokens into named mention segments', () => {
    const segments = parseCommentBody(`Hola <@u:${ANA}>, pregúntale a <@a:runnito>.`, [
      { kind: 'user', id: ANA, name: 'Ana Ruiz' },
      { kind: 'agent', id: 'runnito', name: 'Runnito' },
    ]);
    expect(segments).toEqual([
      { type: 'text', text: 'Hola ' },
      { type: 'mention', kind: 'user', id: ANA, name: 'Ana Ruiz' },
      { type: 'text', text: ', pregúntale a ' },
      { type: 'mention', kind: 'agent', id: 'runnito', name: 'Runnito' },
      { type: 'text', text: '.' },
    ]);
  });

  it('names an unknown person mention generically instead of leaking the id', () => {
    expect(commentPlainText(`<@u:${ANA}> ok`)).toBe('@alguien ok');
  });

  it('serializes only the names picked from suggestions, longest first', () => {
    const body = serializeCommentDraft('@Ana Ruiz y @Anabel, no @Ana Pérez', [
      { kind: 'user', id: ANABEL, name: 'Anabel' },
      { kind: 'user', id: ANA, name: 'Ana Ruiz' },
    ]);
    expect(body).toBe(`<@u:${ANA}> y <@u:${ANABEL}>, no @Ana Pérez`);
  });

  it('does not turn a longer word that starts with a picked name into a mention', () => {
    expect(serializeCommentDraft('@Anabelle', [{ kind: 'user', id: ANABEL, name: 'Anabel' }])).toBe('@Anabelle');
  });

  it('round-trips a stored body through the edit draft', () => {
    const mentions = [{ kind: 'user' as const, id: ANA, name: 'Ana Ruiz' }];
    const stored = `Revisa esto <@u:${ANA}>`;
    const draft = commentDraftFromBody(stored, mentions);
    expect(draft.text).toBe('Revisa esto @Ana Ruiz');
    expect(serializeCommentDraft(draft.text, draft.picked)).toBe(stored);
  });

  it('finds the @query right before the caret', () => {
    expect(activeMentionQuery('hola @an', 8)).toEqual({ start: 5, query: 'an' });
    expect(activeMentionQuery('hola @Ana Ru', 12)).toEqual({ start: 5, query: 'Ana Ru' });
    expect(activeMentionQuery('correo@dominio', 14)).toBeNull();
    expect(activeMentionQuery('hola @ana\nmás', 13)).toBeNull();
  });

  it('merges changes by id in chronological order', () => {
    const a = { id: 'a', createdAt: '2026-10-29T10:00:00Z', body: 'a' };
    const b = { id: 'b', createdAt: '2026-10-29T11:00:00Z', body: 'b' };
    const b2 = { ...b, body: 'b editado' };
    const c = { id: 'c', createdAt: '2026-10-29T10:30:00Z', body: 'c' };
    expect(mergeCommentMessages([a, b], [b2, c]).map((m) => m.body)).toEqual(['a', 'c', 'b editado']);
  });
});
