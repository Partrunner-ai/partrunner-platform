import { describe, expect, it } from 'vitest';
import { appPendingCount, isSafePendienteHref, normalizePendientes } from './pendientes';
import { parseStaffShellSnapshot } from './StaffShellSnapshot';

const snapshot = {
  version: 1,
  user: { id: 'staff-1', name: 'Ada Lovelace', email: 'ada@example.com' },
  profileHref: 'https://nexus.partrunner.ai/perfil',
  preferences: {
    theme: 'system',
    locale: 'es',
    notifications: { inApp: true, email: false },
  },
  notifications: {
    unreadCount: 0,
    href: 'https://nexus.partrunner.ai/notificaciones',
    items: [],
  },
};

const item = {
  id: 'p1',
  bucket: 'mine',
  verb: 'Aprobar',
  queue: 'Tarifas pactadas',
  title: 'Tarifa de Flota Norte',
};

const block = {
  mine: 1,
  team: 2,
  items: [item],
  href: 'https://nexus.partrunner.ai/#pendientes',
};

describe('isSafePendienteHref', () => {
  it('accepts https, localhost and same-origin paths', () => {
    expect(isSafePendienteHref('https://nexus.partrunner.ai/x')).toBe(true);
    expect(isSafePendienteHref('http://localhost:3000/x')).toBe(true);
    expect(isSafePendienteHref('/tarifas/1')).toBe(true);
  });

  it('rejects everything else', () => {
    for (const value of [
      'javascript:alert(1)',
      'data:text/html,hi',
      '//evil.example',
      'http://example.com',
      'http://localhost.evil.com',
      'http://localhost:80@evil.com',
      'http://localhost@evil.com',
      'https://',
      '/\\evil.com',
      '/\\/evil.com',
      ' /x',
      '/x\n',
      '/x\ty',
      '/a b',
      '',
      undefined,
      42,
    ]) {
      expect(isSafePendienteHref(value)).toBe(false);
    }
  });
});

describe('pendientes in the snapshot', () => {
  it('leaves a snapshot without the block untouched', () => {
    const parsed = parseStaffShellSnapshot(snapshot);
    expect('pendientes' in parsed).toBe(false);
  });

  it('keeps a valid block', () => {
    const parsed = parseStaffShellSnapshot({ ...snapshot, pendientes: block });
    expect(parsed.pendientes).toEqual(block);
  });

  it('drops a malformed block and still parses the snapshot', () => {
    for (const bad of [
      null,
      'x',
      [],
      { ...block, mine: -1 },
      { ...block, team: 1.5 },
      { ...block, href: '' },
      { ...block, items: 'no' },
    ]) {
      const parsed = parseStaffShellSnapshot({ ...snapshot, pendientes: bad });
      expect('pendientes' in parsed).toBe(false);
      expect(parsed.user.id).toBe('staff-1');
    }
  });

  it('drops bad items and keeps the good ones', () => {
    const parsed = parseStaffShellSnapshot({
      ...snapshot,
      pendientes: {
        ...block,
        items: [
          item,
          { ...item, id: '' },
          { ...item, id: 'p3', verb: undefined },
          { ...item, id: 'p4', queue: ' ' },
          { ...item, id: 'p5', title: 3 },
          { ...item, id: 'p6', bucket: 'other' },
          { ...item, id: 'p7', subtitle: 3 },
          { ...item, id: 'p8', ageLabel: {} },
          null,
          { ...item, id: 'p9', subtitle: 'Sub', ageLabel: 'hace 3 h' },
        ],
      },
    });
    expect(parsed.pendientes?.items.map((entry) => entry.id)).toEqual(['p1', 'p9']);
  });

  it('removes an unsafe href but keeps the item', () => {
    const parsed = parseStaffShellSnapshot({
      ...snapshot,
      pendientes: {
        ...block,
        items: [
          { ...item, id: 'a', href: 'javascript:alert(1)' },
          { ...item, id: 'b', href: '//evil.example' },
          { ...item, id: 'c', href: '/ok' },
        ],
      },
    });
    const items = parsed.pendientes!.items;
    expect(items).toHaveLength(3);
    expect(items[0]!.href).toBeUndefined();
    expect(items[1]!.href).toBeUndefined();
    expect(items[2]!.href).toBe('/ok');
  });

  it('caps the list at 20 items', () => {
    const items = Array.from({ length: 30 }, (_, index) => ({ ...item, id: `i${index}` }));
    const parsed = parseStaffShellSnapshot({ ...snapshot, pendientes: { ...block, items } });
    expect(parsed.pendientes!.items).toHaveLength(20);
  });

  it('filters byApp entries and drops a byApp that is not an object', () => {
    const parsed = parseStaffShellSnapshot({
      ...snapshot,
      pendientes: {
        ...block,
        byApp: {
          nexus: { mine: 2, team: 0 },
          supply: { mine: -1, team: 0 },
          fds: { mine: 1 },
          sales: 'x',
        },
      },
    });
    expect(parsed.pendientes!.byApp).toEqual({ nexus: { mine: 2, team: 0 } });

    const bad = parseStaffShellSnapshot({ ...snapshot, pendientes: { ...block, byApp: [] } });
    expect(bad.pendientes && 'byApp' in bad.pendientes).toBe(false);
  });

  it('drops the whole block when href is unsafe, and the snapshot still parses', () => {
    for (const href of ['javascript:alert(1)', '//evil.example', '/\\evil.com']) {
      const parsed = parseStaffShellSnapshot({ ...snapshot, pendientes: { ...block, href } });
      expect('pendientes' in parsed).toBe(false);
    }
  });

  it('accepts an encoded backslash', () => {
    expect(isSafePendienteHref('/%5Cevil')).toBe(true);
  });

  it('ignores a __proto__ key in byApp', () => {
    const byApp = JSON.parse('{"__proto__":{"mine":1,"team":1},"nexus":{"mine":1,"team":0}}');
    const parsed = normalizePendientes({ ...block, byApp });
    expect(Object.keys(parsed!.byApp!)).toEqual(['nexus']);
    expect(appPendingCount(parsed, '__proto__')).toBeNull();
    expect(appPendingCount(parsed, 'constructor')).toBeNull();
    expect(appPendingCount(parsed, 'nexus')).toEqual({ total: 1, tone: 'mine' });
  });

  it('keeps a short non-empty teamLabel and ignores anything else', () => {
    expect(normalizePendientes({ ...block, teamLabel: ' Finanzas ' })!.teamLabel).toBe('Finanzas');
    for (const teamLabel of ['', '   ', 4, null, {}, 'x'.repeat(41)]) {
      const parsed = normalizePendientes({ ...block, teamLabel });
      expect(parsed && 'teamLabel' in parsed).toBe(false);
    }
  });

  it('normalizePendientes is usable on its own', () => {
    expect(normalizePendientes(block)).toEqual(block);
    expect(normalizePendientes(undefined)).toBeUndefined();
  });
});
