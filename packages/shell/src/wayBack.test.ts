import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import {
  WAY_BACK_KEY,
  captureWayBack,
  hasWayBackFragment,
  isRegistryOrigin,
  parseWayBackHash,
  readWayBackStorage,
  wayBackFragment,
  wayBackFromReferrer,
  withWayBack,
  writeWayBackStorage,
} from './wayBack';

beforeEach(() => {
  configureAppRegistry({ hostPrefix: '', baseDomain: 'partrunner.ai' });
});
afterEach(() => {
  window.sessionStorage.clear();
  window.history.replaceState(null, '', '/');
  Object.defineProperty(document, 'referrer', { value: '', configurable: true });
  configureAppRegistry({ hostPrefix: 'staging.', baseDomain: 'partrunner.ai' });
});

describe('the way-back fragment', () => {
  it('builds a fragment from a valid sub and path, and drops query and hash', () => {
    expect(wayBackFragment('supply', '/fleets/9?x=1#y')).toBe('#pr-from=supply:%2Ffleets%2F9');
    expect(wayBackFragment('supply', '/\\evil.com')).toBe('');
    expect(wayBackFragment('supply', '//evil.com')).toBe('');
    expect(wayBackFragment('Bad Sub', '/x')).toBe('');
    expect(wayBackFragment(undefined, '/x')).toBe('');
    expect(wayBackFragment('supply', undefined)).toBe('');
  });

  it('replaces any existing fragment and leaves hosts outside the registry alone', () => {
    expect(withWayBack('https://liveops.partrunner.ai/r#old', 'supply', '/fleets')).toBe(
      'https://liveops.partrunner.ai/r#pr-from=supply:%2Ffleets',
    );
    expect(withWayBack('https://liveops.partrunner.ai/r#old', 'supply', '/\\x')).toBe(
      'https://liveops.partrunner.ai/r',
    );
    expect(withWayBack('https://other.example.com/r#old', 'supply', '/fleets')).toBe(
      'https://other.example.com/r#old',
    );
    expect(isRegistryOrigin('https://partrunner.app/anything')).toBe(true);
    expect(isRegistryOrigin('not a url')).toBe(false);
  });

  it('treats www.<host> as the registry origin, and staging. as another', () => {
    expect(isRegistryOrigin('https://www.partrunner.app/admin')).toBe(true);
    expect(isRegistryOrigin('https://staging.partrunner.app/admin')).toBe(false);
    expect(isRegistryOrigin('https://www.evil.example/')).toBe(false);
    expect(withWayBack('https://www.partrunner.app/admin', 'supply', '/fleets')).toBe(
      'https://www.partrunner.app/admin#pr-from=supply:%2Ffleets',
    );
    expect(withWayBack('https://staging.partrunner.app/admin', 'supply', '/fleets')).toBe(
      'https://staging.partrunner.app/admin',
    );
  });

  it('detects the prefix', () => {
    expect(hasWayBackFragment('#pr-from=x')).toBe(true);
    expect(hasWayBackFragment('#other')).toBe(false);
  });
});

describe('parseWayBackHash', () => {
  it('reads a registry app and a plain path', () => {
    expect(parseWayBackHash('#pr-from=liveops:%2Frutas%2F9')).toEqual({ s: 'liveops', p: '/rutas/9' });
  });

  it.each([
    '#pr-from=nope:%2Fx',
    '#pr-from=liveops:%2F%2Fevil.com',
    '#pr-from=liveops:%2F%5Cevil.com',
    '#pr-from=liveops:%2Fa%09b',
    '#pr-from=liveops:%2Fa%0Ab',
    '#pr-from=liveops:%E0%A4%A',
    '#pr-from=liveops:',
    '#pr-from=LIVEOPS:%2Fx',
    '#other',
  ])('rejects %s', (hash) => {
    expect(parseWayBackHash(hash)).toBeNull();
  });
});

describe('sessionStorage', () => {
  it('stores and reads a target, and rejects a tampered value', () => {
    writeWayBackStorage({ s: 'sales', p: '/deals' });
    expect(readWayBackStorage()).toEqual({ s: 'sales', p: '/deals' });
    for (const bad of [
      'not json',
      JSON.stringify({ s: 'nope', p: '/x' }),
      JSON.stringify({ s: 'sales', p: '//evil.com' }),
      JSON.stringify({ s: 'sales' }),
      'null',
    ]) {
      window.sessionStorage.setItem(WAY_BACK_KEY, bad);
      expect(readWayBackStorage()).toBeNull();
    }
  });
});

describe('referrer matching', () => {
  it('matches a subdomain app on origin and uses its last page, else its start path', () => {
    expect(
      wayBackFromReferrer('https://liveops.partrunner.ai/x?y=1', 'supply', { liveops: '/rutas/4' }),
    ).toEqual({ s: 'liveops', p: '/rutas/4' });
    expect(wayBackFromReferrer('https://liveops.partrunner.ai/x', 'supply', {})).toEqual({
      s: 'liveops',
      p: '/',
    });
  });

  it('ignores unknown origins, the current app, and an empty or bad referrer', () => {
    expect(wayBackFromReferrer('https://evil.example/x', 'supply', {})).toBeNull();
    expect(wayBackFromReferrer('https://supply.partrunner.ai/x', 'supply', {})).toBeNull();
    expect(wayBackFromReferrer('', 'supply', {})).toBeNull();
    expect(wayBackFromReferrer('::nope::', 'supply', {})).toBeNull();
  });

  it('matches a path-hosted app on origin alone when the referrer is cut to the origin', () => {
    for (const referrer of ['https://partrunner.app', 'https://partrunner.app/']) {
      expect(wayBackFromReferrer(referrer, 'supply', {})).toEqual({
        s: 'sube-tu-factura',
        p: '/admin/finanzas/dashboard',
      });
    }
  });

  it('matches a referrer on www.<host> but not on staging.<host>', () => {
    expect(wayBackFromReferrer('https://www.partrunner.app/admin/x', 'supply', {})).toMatchObject({
      s: 'sube-tu-factura',
    });
    expect(wayBackFromReferrer('https://www.liveops.partrunner.ai/x', 'supply', {})).toEqual({
      s: 'liveops',
      p: '/',
    });
    expect(wayBackFromReferrer('https://staging.partrunner.app/admin/x', 'supply', {})).toBeNull();
  });

  it('otherwise needs a segment boundary for a path-hosted app', () => {
    const match = (path: string) =>
      wayBackFromReferrer(`https://partrunner.app${path}`, 'supply', {});
    expect(match('/admin')).not.toBeNull();
    expect(match('/admin/finanzas/pagos')).not.toBeNull();
    expect(match('/adminfoo')).toBeNull();
    expect(match('/other/page')).toBeNull();
  });
});

describe('captureWayBack', () => {
  it('reads the fragment, removes only it, keeps history.state, and stores the target', () => {
    window.history.replaceState({ a: 1 }, '', '/fleets?q=1#pr-from=sales:%2Fdeals');
    expect(captureWayBack('supply', {})).toEqual({ s: 'sales', p: '/deals' });
    expect(window.location.pathname + window.location.search + window.location.hash).toBe(
      '/fleets?q=1',
    );
    expect(window.history.state).toEqual({ a: 1 });
    expect(readWayBackStorage()).toEqual({ s: 'sales', p: '/deals' });
  });

  it('keeps an earlier arrival when nothing new arrives, and ignores one from this app', () => {
    writeWayBackStorage({ s: 'sales', p: '/deals' });
    expect(captureWayBack('supply', {})).toEqual({ s: 'sales', p: '/deals' });
    expect(captureWayBack('sales', {})).toBeNull();
  });

  it('does not use the referrer without a current sub', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://liveops.partrunner.ai/x',
      configurable: true,
    });
    expect(captureWayBack(undefined, {})).toBeNull();
  });
});
