import { describe, expect, it } from 'vitest';
import { canonicalOrigin, sameAppOrigin } from './appOrigin';

describe('app origin comparison', () => {
  it('treats www.<host> and <host> as one app origin', () => {
    expect(sameAppOrigin('https://www.partrunner.app/x', 'https://partrunner.app')).toBe(true);
    expect(sameAppOrigin('https://partrunner.app', 'https://partrunner.app/y')).toBe(true);
    expect(canonicalOrigin('https://www.partrunner.app:8443/x')).toBe('https://partrunner.app:8443');
  });

  it('does not treat staging. as www., or another scheme or host as the same', () => {
    expect(sameAppOrigin('https://staging.partrunner.app', 'https://partrunner.app')).toBe(false);
    expect(sameAppOrigin('https://staging.partrunner.app', 'https://www.partrunner.app')).toBe(false);
    expect(sameAppOrigin('http://www.partrunner.app', 'https://partrunner.app')).toBe(false);
    expect(sameAppOrigin('https://www.other.app', 'https://partrunner.app')).toBe(false);
  });

  it('is false for empty or bad input', () => {
    expect(sameAppOrigin('', '')).toBe(false);
    expect(sameAppOrigin('nope', 'nope')).toBe(false);
    expect(sameAppOrigin(null, 'https://partrunner.app')).toBe(false);
  });
});
