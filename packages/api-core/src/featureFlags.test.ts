import { describe, expect, it } from 'vitest';

import {
  evaluateFlag,
  evaluateFlagDecision,
  mergeTargetingIntoValueJson,
  parseTargetingResult,
  type FeatureFlagContext,
} from './feature-flags';

const admin = {
  kind: 'admin' as const,
  email: 'operator@partrunner.com',
  role: 'operations_manager',
};

describe('evaluateFlag', () => {
  it('keeps enabled flags without targeting available to every caller', () => {
    expect(evaluateFlag({ value_bool: true, value_json: null }, admin)).toBe(true);
    expect(evaluateFlag({ value_bool: true, value_json: {} }, admin)).toBe(true);
    expect(
      evaluateFlag(
        { value_bool: true, value_json: { payload: { workflow: 'capacity' } } },
        admin
      )
    ).toBe(true);
  });

  it('evaluates valid all and allowlist targeting', () => {
    expect(
      evaluateFlag(
        { value_bool: true, value_json: { targeting: { mode: 'all' } } },
        admin
      )
    ).toBe(true);
    expect(
      evaluateFlag(
        {
          value_bool: true,
          value_json: {
            targeting: {
              mode: 'allowlist',
              admin_emails: [' OPERATOR@partrunner.com '],
            },
          },
        },
        admin
      )
    ).toBe(true);
  });

  it.each([
    ['non-object value_json', 'enabled'],
    ['null targeting', { targeting: null }],
    ['unknown targeting mode', { targeting: { mode: 'percentage' } }],
    [
      'invalid targeting list',
      { targeting: { mode: 'allowlist', admin_emails: 'operator@partrunner.com' } },
    ],
  ])('fails closed for %s', (_label, valueJson) => {
    expect(evaluateFlag({ value_bool: true, value_json: valueJson }, admin)).toBe(false);
  });

  it('keeps the master switch authoritative before targeting evaluation', () => {
    expect(
      evaluateFlag(
        { value_bool: false, value_json: { targeting: { mode: 'all' } } },
        admin
      )
    ).toBe(false);
  });

  it('keeps legacy metadata behavior and ignores retired role targeting', () => {
    expect(
      evaluateFlag(
        { value_bool: true, value_json: { variant: 42 } },
        admin
      )
    ).toBe(true);
    expect(
      evaluateFlag(
        {
          value_bool: true,
          value_json: {
            targeting: { mode: 'allowlist', admin_roles: ['operations_manager'] },
          },
        },
        { kind: 'admin', role: 'operations_manager' }
      )
    ).toBe(false);
  });

  it('matches admin permissions in the legacy admin context', () => {
    const flag = {
      value_bool: true,
      value_json: {
        targeting: { mode: 'allowlist', admin_permissions: ['supply.fleets.read'] },
      },
    };
    expect(evaluateFlag(flag, { kind: 'admin', permissions: ['supply.fleets.read'] })).toBe(true);
    expect(evaluateFlag(flag, { kind: 'admin', permissions: ['*'] })).toBe(true);
    expect(evaluateFlag(flag, { kind: 'admin', permissions: ['finance.payments.read'] })).toBe(
      false
    );
    expect(evaluateFlag(flag, { kind: 'user', flotilleroId: null })).toBe(false);
  });

  it.each<{
    name: string;
    flag: { value_bool: boolean; value_json: unknown };
    context: FeatureFlagContext;
    expected: boolean;
  }>([
    {
      name: 'user id match',
      flag: {
        value_bool: true,
        value_json: {
          targeting: {
            mode: 'allowlist',
            flotillero_ids: ['11111111-1111-4111-8111-111111111111'],
          },
        },
      },
      context: {
        kind: 'user',
        flotilleroId: '11111111-1111-4111-8111-111111111111',
      },
      expected: true,
    },
    {
      name: 'user RFC normalization',
      flag: {
        value_bool: true,
        value_json: {
          targeting: { mode: 'allowlist', flotillero_rfcs: ['ABC010101AB1'] },
        },
      },
      context: { kind: 'user', rfc: ' abc010101ab1 ' },
      expected: true,
    },
    {
      name: 'admin email normalization',
      flag: {
        value_bool: true,
        value_json: {
          targeting: { mode: 'allowlist', admin_emails: ['operator@partrunner.com'] },
        },
      },
      context: { kind: 'admin', email: ' OPERATOR@partrunner.com ' },
      expected: true,
    },
    {
      name: 'admin permission match',
      flag: {
        value_bool: true,
        value_json: {
          targeting: { mode: 'allowlist', admin_permissions: ['ops.routes.read'] },
        },
      },
      context: { kind: 'admin', permissions: [' OPS.routes.read '] },
      expected: true,
    },
    {
      name: 'retired admin role',
      flag: {
        value_bool: true,
        value_json: {
          targeting: { mode: 'allowlist', admin_roles: ['operations_manager'] },
        },
      },
      context: { kind: 'admin', role: 'operations_manager' },
      expected: false,
    },
    {
      name: 'legacy context field isolation',
      flag: {
        value_bool: true,
        value_json: {
          targeting: { mode: 'allowlist', admin_emails: ['operator@partrunner.com'] },
        },
      },
      context: {
        kind: 'user',
        flotilleroId: '11111111-1111-4111-8111-111111111111',
      },
      expected: false,
    },
    {
      name: 'empty allowlist',
      flag: {
        value_bool: true,
        value_json: { targeting: { mode: 'allowlist' } },
      },
      context: { kind: 'admin', email: 'operator@partrunner.com' },
      expected: false,
    },
  ])('evaluates $name the same in both evaluators', ({ flag, context, expected }) => {
    expect(evaluateFlag(flag, context)).toBe(expected);

    const actor =
      context.kind === 'user'
        ? { flotilleroId: context.flotilleroId, flotilleroRfc: context.rfc }
        : {
            email: context.email,
            permissions: context.permissions,
            roles: context.role ? [context.role] : [],
          };
    expect(evaluateFlagDecision(flag, actor).enabled).toBe(expected);
  });
});

describe('parseTargetingResult', () => {
  it('distinguishes absent, valid, and invalid targeting', () => {
    expect(parseTargetingResult(null)).toEqual({ status: 'absent' });
    expect(parseTargetingResult({})).toEqual({ status: 'absent' });
    expect(
      parseTargetingResult({
        targeting: {
          mode: 'allowlist',
          flotillero_rfcs: [' abc010101ab1 '],
          admin_emails: [' OPERATOR@partrunner.com '],
        },
      })
    ).toEqual({
      status: 'valid',
      targeting: {
        mode: 'allowlist',
        flotillero_ids: [],
        flotillero_rfcs: ['ABC010101AB1'],
        admin_emails: ['operator@partrunner.com'],
        admin_permissions: [],
      },
    });
    expect(parseTargetingResult({ targeting: null })).toEqual({ status: 'invalid' });
    expect(
      parseTargetingResult({
        targeting: { mode: 'allowlist', flotillero_ids: ['not-a-uuid'] },
      })
    ).toEqual({ status: 'invalid' });
    expect(
      parseTargetingResult({
        targeting: {
          mode: 'allowlist',
          admin_permissions: [' supply.fleets.read ', 'finance.payments.approve'],
          admin_roles: ['Invalid-Role'],
        },
      })
    ).toEqual({
      status: 'valid',
      targeting: {
        mode: 'allowlist',
        flotillero_ids: [],
        flotillero_rfcs: [],
        admin_emails: [],
        admin_permissions: ['supply.fleets.read', 'finance.payments.approve'],
      },
    });
    for (const bad of ['supply', 'supply.', '*', 'supply.fleets-read', 'supply fleets.read']) {
      expect(
        parseTargetingResult({ targeting: { mode: 'allowlist', admin_permissions: [bad] } })
      ).toEqual({ status: 'invalid' });
    }
  });
});

describe('evaluateFlagDecision', () => {
  it('matches when the actor holds any listed permission or the wildcard', () => {
    const flag = {
      value_bool: true,
      value_json: {
        targeting: {
          mode: 'allowlist',
          admin_emails: ['lead@partrunner.com'],
          admin_permissions: ['finance.payments.approve', 'supply.fleets.read'],
        },
      },
    };
    const on = { enabled: true, reason: 'matched', variant: null, payload: null };
    const off = { enabled: false, reason: 'disabled', variant: null, payload: null };

    expect(
      evaluateFlagDecision(flag, {
        email: 'operator@partrunner.com',
        permissions: ['ops.routes.read', 'supply.fleets.read'],
      })
    ).toEqual(on);
    expect(evaluateFlagDecision(flag, { email: 'lead@partrunner.com', permissions: [] })).toEqual(
      on
    );
    expect(evaluateFlagDecision(flag, { permissions: ['*'] })).toEqual(on);
    expect(evaluateFlagDecision(flag, { permissions: ['ops.routes.read'] })).toEqual(off);
    expect(evaluateFlagDecision(flag, { permissions: null })).toEqual(off);
  });

  it('does not let the wildcard match an allowlist without permissions', () => {
    expect(
      evaluateFlagDecision(
        {
          value_bool: true,
          value_json: {
            targeting: { mode: 'allowlist', admin_emails: ['lead@partrunner.com'] },
          },
        },
        { permissions: ['*'] }
      ).enabled
    ).toBe(false);
  });

  it('ignores retired role targeting and drops it from merged value_json', () => {
    const flag = {
      value_bool: true,
      value_json: {
        targeting: { mode: 'allowlist', admin_roles: ['finance_manager'] },
      },
    };
    expect(evaluateFlagDecision(flag, { roles: ['finance_manager'] }).enabled).toBe(false);
    expect(
      mergeTargetingIntoValueJson(
        { note: 'keep', targeting: { mode: 'all', admin_roles: ['supply'] } },
        { mode: 'allowlist', admin_permissions: ['supply.fleets.read'], admin_roles: ['supply'] }
      )
    ).toEqual({
      note: 'keep',
      targeting: {
        mode: 'allowlist',
        flotillero_ids: [],
        flotillero_rfcs: [],
        admin_emails: [],
        admin_permissions: ['supply.fleets.read'],
      },
    });
  });

  it('returns archive, disabled, and invalid configuration reasons in order', () => {
    const malformed = { targeting: { mode: 'percentage' } };
    expect(
      evaluateFlagDecision(
        { value_bool: true, value_json: malformed, archived_at: '2026-08-24T00:00:00Z' },
        admin
      )
    ).toEqual({ enabled: false, reason: 'archived', variant: null, payload: null });
    expect(evaluateFlagDecision({ value_bool: false, value_json: malformed }, admin)).toEqual({
      enabled: false,
      reason: 'disabled',
      variant: null,
      payload: null,
    });
    expect(evaluateFlagDecision({ value_bool: true, value_json: malformed }, admin)).toEqual({
      enabled: false,
      reason: 'invalid_configuration',
      variant: null,
      payload: null,
    });
  });

  it('returns valid variant and payload metadata only for matched decisions', () => {
    const flag = {
      value_bool: true,
      value_json: {
        targeting: { mode: 'all' },
        variant: 'treatment',
        payload: { color: 'yellow' },
      },
    };
    expect(evaluateFlagDecision<{ color: string }>(flag, admin)).toEqual({
      enabled: true,
      reason: 'matched',
      variant: 'treatment',
      payload: { color: 'yellow' },
    });
    expect(evaluateFlagDecision({ value_bool: true, value_json: { variant: ' ' } }, admin)).toEqual({
      enabled: false,
      reason: 'invalid_configuration',
      variant: null,
      payload: null,
    });
  });
});
