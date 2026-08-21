import { describe, expect, it } from 'vitest';
import {
  appShellGroupsKey,
  decodeAppShellGroups,
  encodeAppShellGroups,
  parseAppShellState,
} from './sidebarPreferences';

describe('AppShell cookie state', () => {
  it('parses the collapsed rail and versioned groups on the server', () => {
    const groups = encodeAppShellGroups({ rutas: true, admin: false });
    const state = parseAppShellState(
      `other=private; pr-sidebar-collapsed=1; ${appShellGroupsKey('pr-sidebar-collapsed')}=${groups}`,
    );

    expect(state).toEqual({ collapsed: true, groups: { rutas: true, admin: false } });
  });

  it('accepts the legacy localStorage record and drops non-boolean fields', () => {
    expect(decodeAppShellGroups('{"rutas":true,"label":"Rutas"}')).toEqual({ rutas: true });
  });

  it('fails closed on malformed preferences', () => {
    expect(parseAppShellState('pr-sidebar-collapsed=0; pr-sidebar-collapsed:groups=%')).toEqual({
      collapsed: false,
      groups: {},
    });
  });
});
