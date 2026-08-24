import { describe, expect, it } from 'vitest';

import { evaluateFlag } from './featureFlags';

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
});
