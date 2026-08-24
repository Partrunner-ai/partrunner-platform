import { describe, expect, it } from 'vitest';

import {
  evaluateFlag,
  evaluateFlagDecision,
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

  it('keeps legacy metadata and role behavior unchanged', () => {
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
        { kind: 'admin', role: 'OPERATIONS_MANAGER' }
      )
    ).toBe(false);
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
      name: 'admin role match',
      flag: {
        value_bool: true,
        value_json: {
          targeting: { mode: 'allowlist', admin_roles: ['operations_manager'] },
        },
      },
      context: { kind: 'admin', role: 'operations_manager' },
      expected: true,
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
  ])('keeps the 1.0.2 result for $name', ({ flag, context, expected }) => {
    expect(evaluateFlag(flag, context)).toBe(expected);

    const actor =
      context.kind === 'user'
        ? { flotilleroId: context.flotilleroId, flotilleroRfc: context.rfc }
        : { email: context.email, roles: context.role ? [context.role] : [] };
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
        admin_roles: [],
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
        targeting: { mode: 'allowlist', admin_roles: ['unknown_role'] },
      })
    ).toEqual({ status: 'invalid' });
  });
});

describe('evaluateFlagDecision', () => {
  it('matches any supported actor field and any actor role', () => {
    const flag = {
      value_bool: true,
      value_json: {
        targeting: {
          mode: 'allowlist',
          admin_roles: ['finance_manager'],
        },
      },
    };

    expect(
      evaluateFlagDecision(flag, {
        email: 'operator@partrunner.com',
        roles: ['viewer', 'FINANCE_MANAGER'],
      })
    ).toEqual({ enabled: true, reason: 'matched', variant: null, payload: null });
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
