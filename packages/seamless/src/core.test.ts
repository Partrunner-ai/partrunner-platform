import { SignJWT } from 'jose';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  hasRole,
  isSuperAdmin,
  nexusHomeUrl,
  nexusLoginUrl,
  safeNextPath,
  type NexusSession,
} from './core';
import {
  clearSessionCookies,
  cookieDomainAppliesTo,
  exchangeSsoCode,
  loginDestination,
  safeNextUrl,
  NEXUS_SESSION_COOKIE,
  resolveConfig,
  resolveSessionCookie,
  sessionCookiesToClear,
  verifyNexusSession,
} from './server';

afterEach(() => {
  vi.unstubAllGlobals();
});

const config = {
  jwtSecret: 'test-secret-with-enough-entropy',
  nexusUrl: 'https://nexus.partrunner.ai',
};

describe('configuration and URLs', () => {
  it('requires the shared secret and trims a trailing slash from Nexus', () => {
    expect(() => resolveConfig({})).toThrow(/No JWT secret in the environment/);
    expect(
      resolveConfig({
        UNIFIED_JWT_SECRET: config.jwtSecret,
        NEXT_PUBLIC_NEXUS_URL: `${config.nexusUrl}/`,
      }),
    ).toEqual({ ...config, sessionCookie: NEXUS_SESSION_COOKIE });
  });

  it('accepts every supported secret-name alias', () => {
    for (const key of [
      'NEXUS_UNIFIED_JWT_SECRET',
      'UNIFIED_JWT_SECRET',
      'NEXUS2_UNIFIED_JWT_SECRET',
    ]) {
      expect(
        resolveConfig({ [key]: config.jwtSecret, NEXT_PUBLIC_NEXUS_URL: config.nexusUrl })
          .jwtSecret,
        `${key} was ignored`,
      ).toBe(config.jwtSecret);
    }
  });

  it('prefers the leftmost secret name when several are set', () => {
    expect(
      resolveConfig({
        NEXUS_UNIFIED_JWT_SECRET: 'canonical',
        UNIFIED_JWT_SECRET: 'legacy',
        NEXT_PUBLIC_NEXUS_URL: config.nexusUrl,
      }).jwtSecret,
    ).toBe('canonical');
  });

  it('lets staging name its own cookie so it cannot clobber production', () => {
    // Staging sits on a sibling subdomain of the same parent, so a shared cookie name
    // means one session overwrites the other.
    expect(
      resolveConfig({
        UNIFIED_JWT_SECRET: config.jwtSecret,
        NEXT_PUBLIC_NEXUS_URL: config.nexusUrl,
        NEXUS_TOKEN_COOKIE: 'nexus_token_staging',
      }).sessionCookie,
    ).toBe('nexus_token_staging');
  });

  it('omits cookieDomain entirely when unset, because localhost cannot take one', () => {
    const resolved = resolveConfig({
      UNIFIED_JWT_SECRET: config.jwtSecret,
      NEXT_PUBLIC_NEXUS_URL: config.nexusUrl,
    });
    expect('cookieDomain' in resolved).toBe(false);

    for (const key of [
      'NEXUS_COOKIE_DOMAIN',
      'SESSION_COOKIE_DOMAIN',
      'NEXUS2_COOKIE_DOMAIN',
      'COOKIE_DOMAIN',
    ]) {
      expect(
        resolveConfig({
          UNIFIED_JWT_SECRET: config.jwtSecret,
          NEXT_PUBLIC_NEXUS_URL: config.nexusUrl,
          [key]: '.partrunner.ai',
        }).cookieDomain,
        `${key} was ignored`,
      ).toBe('.partrunner.ai');
    }
  });

  it('honours the injected env for the host, not just the secret', () => {
    // Every resolved setting must come from the injected environment.
    expect(
      resolveConfig({
        UNIFIED_JWT_SECRET: 's',
        NEXT_PUBLIC_APPS_HOST_PREFIX: '',
        NEXT_PUBLIC_APPS_BASE_DOMAIN: 'partrunner.ai',
      }).nexusUrl,
    ).toBe('https://nexus.partrunner.ai');

    expect(
      resolveConfig({
        UNIFIED_JWT_SECRET: 's',
        NEXT_PUBLIC_APPS_HOST_PREFIX: 'staging.',
        NEXT_PUBLIC_APPS_BASE_DOMAIN: 'partrunner.ai',
      }).nexusUrl,
    ).toBe('https://staging.nexus.partrunner.ai');
  });

  it('builds the canonical Nexus destinations', () => {
    expect(nexusHomeUrl(config)).toBe(config.nexusUrl);
    expect(nexusLoginUrl(config, 'https://supply.partrunner.ai/rutas')).toBe(
      `${config.nexusUrl}/login?next=https%3A%2F%2Fsupply.partrunner.ai%2Frutas`,
    );
  });
});

describe('the session cookie', () => {
  it('accepts every supported domain-variable alias', () => {
    for (const key of [
      'NEXUS_COOKIE_DOMAIN',
      'SESSION_COOKIE_DOMAIN',
      'NEXUS2_COOKIE_DOMAIN',
      'COOKIE_DOMAIN',
    ]) {
      expect(resolveSessionCookie({ [key]: '.partrunner.ai' }).domain, `${key} was ignored`).toBe(
        '.partrunner.ai',
      );
    }
  });

  it('prefers the canonical NEXUS_COOKIE_DOMAIN name', () => {
    expect(
      resolveSessionCookie({
        NEXUS_COOKIE_DOMAIN: '.partrunner.ai',
        SESSION_COOKIE_DOMAIN: '.wrong.example',
        NEXUS2_COOKIE_DOMAIN: '.wrong.example',
        COOKIE_DOMAIN: '.wrong.example',
      }).domain,
    ).toBe('.partrunner.ai');
  });

  it('is host-only when no domain is set, which is all localhost can do', () => {
    const cookie = resolveSessionCookie({});
    expect(cookie.name).toBe(NEXUS_SESSION_COOKIE);
    expect('domain' in cookie).toBe(false);
  });

  it('lets staging take its own name so it cannot clobber production', () => {
    expect(resolveSessionCookie({ NEXUS_TOKEN_COOKIE: ' nexus_token_staging ' }).name).toBe(
      'nexus_token_staging',
    );
  });

  it('agrees with resolveConfig, so the two cannot drift', () => {
    const env = {
      UNIFIED_JWT_SECRET: 's',
      NEXT_PUBLIC_NEXUS_URL: 'https://nexus.partrunner.ai',
      SESSION_COOKIE_DOMAIN: '.partrunner.ai',
      NEXUS_TOKEN_COOKIE: 'nexus_token_staging',
    };
    const cookie = resolveSessionCookie(env);
    const full = resolveConfig(env);
    expect(full.sessionCookie).toBe(cookie.name);
    expect(full.cookieDomain).toBe(cookie.domain);

    // …and they agree about the host too, or a config built for localhost would
    // still advertise a cookieDomain the browser is going to throw away.
    expect(resolveConfig(env, 'localhost').cookieDomain).toBe(
      resolveSessionCookie(env, 'localhost').domain,
    );
    expect('cookieDomain' in resolveConfig(env, 'localhost')).toBe(false);
  });
});

describe('a cookie domain the host cannot use', () => {
  // Browsers reject a Domain attribute that does not cover the responding host.
  const shared = { SESSION_COOKIE_DOMAIN: '.partrunner.ai' };

  it('drops the domain for a host that does not sit under it', () => {
    expect(resolveSessionCookie(shared, 'localhost')).toEqual({ name: 'nexus_token' });
    expect(resolveSessionCookie(shared, '127.0.0.1')).toEqual({ name: 'nexus_token' });
    expect(resolveSessionCookie(shared, 'partrunner.ai.evil.com')).toEqual({
      name: 'nexus_token',
    });
  });

  it('keeps the domain for the hosts that can actually use it', () => {
    for (const host of ['partrunner.ai', 'nexus.partrunner.ai', 'staging.supply.partrunner.ai']) {
      expect(resolveSessionCookie(shared, host).domain, `${host} lost the domain`).toBe(
        '.partrunner.ai',
      );
    }
  });

  it('falls back to NODE_ENV when the caller has no host to give', () => {
    // Most consumers resolve this once at module scope, nowhere near a request.
    expect(resolveSessionCookie({ ...shared, NODE_ENV: 'development' })).toEqual({
      name: 'nexus_token',
    });
    expect(resolveSessionCookie({ ...shared, NODE_ENV: 'production' }).domain).toBe(
      '.partrunner.ai',
    );
  });

  it('keeps the domain when NODE_ENV is absent, so tests still exercise sharing', () => {
    // `=== 'development'` rather than `!== 'production'` on purpose: a test env object
    // carries no NODE_ENV, and under the looser check every shared-cookie test in this
    // file would quietly start asserting the host-only path instead.
    expect(resolveSessionCookie(shared).domain).toBe('.partrunner.ai');
    expect(resolveSessionCookie({ ...shared, NODE_ENV: 'test' }).domain).toBe('.partrunner.ai');
  });

  it('lets an explicit host override the NODE_ENV guess, in both directions', () => {
    expect(
      resolveSessionCookie({ ...shared, NODE_ENV: 'development' }, 'nexus.partrunner.ai').domain,
    ).toBe('.partrunner.ai');
    expect(resolveSessionCookie({ ...shared, NODE_ENV: 'production' }, 'localhost')).toEqual({
      name: 'nexus_token',
    });
  });

  it('has nothing to drop when no domain is configured', () => {
    expect(resolveSessionCookie({}, 'localhost')).toEqual({ name: 'nexus_token' });
    expect(resolveSessionCookie({ NODE_ENV: 'development' })).toEqual({ name: 'nexus_token' });
  });
});

describe('cookieDomainAppliesTo', () => {
  it.each([
    ['partrunner.ai', '.partrunner.ai', 'the apex itself'],
    ['nexus.partrunner.ai', '.partrunner.ai', 'a subdomain'],
    ['staging.supply.partrunner.ai', '.partrunner.ai', 'a nested subdomain'],
    ['NEXUS.PartRunner.ai', '.partrunner.ai', 'a differently-cased host'],
    ['supply.partrunner.ai', 'partrunner.ai', 'a domain written without the leading dot'],
  ])('%s is covered by %s (%s)', (host, domain) => {
    expect(cookieDomainAppliesTo(host, domain)).toBe(true);
  });

  it.each([
    ['localhost', '.partrunner.ai', 'a hostname with no dot at all'],
    ['127.0.0.1', '.partrunner.ai', 'a loopback address'],
    ['partrunner.ai.evil.com', '.partrunner.ai', 'a suffix that only looks like the domain'],
    ['notpartrunner.ai', '.partrunner.ai', 'a host ending in the same letters'],
    ['evil.com', '.partrunner.ai', 'an unrelated host'],
  ])('%s is not covered by %s (%s)', (host, domain) => {
    expect(cookieDomainAppliesTo(host, domain)).toBe(false);
  });
});

describe('signing out', () => {
  it('clears the host-only cookie as well as the scoped one', () => {
    // Host-only and domain-scoped variants can coexist and must both expire.
    expect(sessionCookiesToClear({ SESSION_COOKIE_DOMAIN: '.partrunner.ai' })).toEqual([
      { name: 'nexus_token' },
      { name: 'nexus_token', domain: '.partrunner.ai' },
    ]);
  });

  it('clears just the one when no domain is configured', () => {
    expect(sessionCookiesToClear({})).toEqual([{ name: 'nexus_token' }]);
  });

  it('carries the staging cookie name into both variants', () => {
    expect(
      sessionCookiesToClear({
        NEXUS_TOKEN_COOKIE: 'nexus_token_staging',
        NEXUS_COOKIE_DOMAIN: '.partrunner.ai',
      }),
    ).toEqual([
      { name: 'nexus_token_staging' },
      { name: 'nexus_token_staging', domain: '.partrunner.ai' },
    ]);
  });

  it('always includes the cookie resolveSessionCookie would write', () => {
    // Whatever sign-out clears has to be a superset of what login sets, or a session
    // can outlive its own sign-out.
    for (const env of [
      {},
      { SESSION_COOKIE_DOMAIN: '.partrunner.ai' },
      { NEXUS_TOKEN_COOKIE: 'x', COOKIE_DOMAIN: '.partrunner.ai' },
    ]) {
      const written = resolveSessionCookie(env);
      expect(sessionCookiesToClear(env)).toContainEqual(written);
    }
  });
});

describe('clearSessionCookies', () => {
  const setCookies = (env: Record<string, string | undefined>) => {
    const res = new Response(null);
    clearSessionCookies(res, env);
    return res.headers.getSetCookie();
  };

  it('emits a separate header per scoping instead of collapsing them', () => {
    // A cookie jar keyed only by name keeps the last write. Both scopes must
    // arrive as distinct headers so each cookie expires.
    const headers = setCookies({ SESSION_COOKIE_DOMAIN: '.partrunner.ai' });
    expect(headers).toHaveLength(2);
    expect(headers.filter((h) => h.includes('Domain='))).toHaveLength(1);
    expect(headers.filter((h) => !h.includes('Domain='))).toHaveLength(1);
  });

  it('expires rather than sets, on every variant', () => {
    for (const header of setCookies({ SESSION_COOKIE_DOMAIN: '.partrunner.ai' })) {
      expect(header).toContain('Max-Age=0');
      expect(header).toMatch(/^nexus_token=;/);
      expect(header).toContain('Path=/');
      expect(header).toContain('HttpOnly');
    }
  });

  it('emits one header when no domain is configured', () => {
    expect(setCookies({})).toEqual(['nexus_token=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax']);
  });

  it('carries the staging cookie name', () => {
    const headers = setCookies({
      NEXUS_TOKEN_COOKIE: 'nexus_token_staging',
      NEXUS_COOKIE_DOMAIN: '.partrunner.ai',
    });
    expect(headers.every((h) => h.startsWith('nexus_token_staging=;'))).toBe(true);
  });

  it('marks Secure only in production, so localhost over http keeps the cookie', () => {
    expect(setCookies({ NODE_ENV: 'production' })[0]).toContain('Secure');
    expect(setCookies({ NODE_ENV: 'development' })[0]).not.toContain('Secure');
  });
});

describe('session verification', () => {
  it('accepts a signed Nexus session and exposes its roles', async () => {
    const token = await new SignJWT({
      userId: 'user-1',
      email: 'user@example.com',
      roles: ['super_admin'],
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(config.jwtSecret));

    const session = await verifyNexusSession(token, config.jwtSecret);
    expect(session?.userId).toBe('user-1');
    expect(hasRole(session, 'super_admin')).toBe(true);
    expect(isSuperAdmin(session)).toBe(true);
  });

  it('rejects missing, malformed, and incomplete sessions', async () => {
    expect(await verifyNexusSession(null, config.jwtSecret)).toBeNull();
    expect(await verifyNexusSession('not-a-jwt', config.jwtSecret)).toBeNull();

    const incomplete = await new SignJWT({ email: 'user@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('5m')
      .sign(new TextEncoder().encode(config.jwtSecret));
    expect(await verifyNexusSession(incomplete, config.jwtSecret)).toBeNull();
  });

  it('treats a missing role list as no access', () => {
    const session = { userId: 'user-1', email: 'user@example.com' } as NexusSession;
    expect(hasRole(session, 'super_admin')).toBe(false);
    expect(isSuperAdmin(null)).toBe(false);
  });
});

describe('SSO exchange', () => {
  it('returns validated claims from a successful server exchange', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          userId: 'user-1',
          email: 'user@example.com',
          roles: ['operator', 42],
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      exchangeSsoCode(
        { nexusUrl: 'https://nexus.example.com' },
        'one-time-code',
        'https://app.example.com',
      ),
    ).resolves.toEqual({
      userId: 'user-1',
      email: 'user@example.com',
      roles: ['operator'],
    });
    expect(fetchMock).toHaveBeenCalledWith(
      new URL('https://nexus.example.com/api/auth/sso/exchange'),
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Origin: 'https://app.example.com',
        },
        body: JSON.stringify({ code: 'one-time-code' }),
      }),
    );
  });

  it.each([
    new Response(null, { status: 401 }),
    new Response(JSON.stringify({ email: 'missing-user@example.com' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  ])('fails closed on a rejected or incomplete exchange', async (response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
    await expect(
      exchangeSsoCode(
        { nexusUrl: 'https://nexus.example.com' },
        'bad-code',
        'https://app.example.com',
      ),
    ).resolves.toBeNull();
  });
});

describe('safeNextPath', () => {
  it.each(['/rutas', '/admin/users?tab=active', '/'])('keeps internal path %s', (path) => {
    expect(safeNextPath(path)).toBe(path);
  });

  it.each([undefined, null, '', 'https://evil.example', '//evil.example'])(
    'falls back to root for %s',
    (path) => {
      expect(safeNextPath(path)).toBe('/');
    },
  );
});

describe('safeNextUrl', () => {
  const shared = { SESSION_COOKIE_DOMAIN: '.partrunner.ai' };

  it('keeps internal paths, exactly as safeNextPath does', () => {
    expect(safeNextUrl('/leads?estado=nueva', shared)).toBe('/leads?estado=nueva');
  });

  it('accepts a sibling portal that shares the session cookie', () => {
    expect(safeNextUrl('https://child.partrunner.ai/items', shared)).toBe(
      'https://child.partrunner.ai/items',
    );
  });

  it('accepts the apex as well as its subdomains', () => {
    expect(safeNextUrl('https://partrunner.ai/x', shared)).toBe('https://partrunner.ai/x');
  });

  it('treats the cookie domain the way a browser does, dot or no dot', () => {
    expect(safeNextUrl('https://supply.partrunner.ai/', { COOKIE_DOMAIN: 'partrunner.ai' })).toBe(
      'https://supply.partrunner.ai/',
    );
  });

  it.each([
    ['https://partrunner.ai.evil.com/x', 'a suffix that only looks like the domain'],
    ['https://evil.com/x', 'an unrelated host'],
    ['https://notpartrunner.ai/x', 'a host that merely ends with the same letters'],
    ['http://child.partrunner.ai/x', 'plain http, which cannot carry a Secure cookie'],
    ['//evil.com', 'a protocol-relative URL'],
    ['javascript:alert(1)', 'a javascript: URL'],
    ['not a url', 'something unparseable'],
  ])('refuses %s (%s)', (candidate) => {
    expect(safeNextUrl(candidate, shared)).toBe('/');
  });

  it('accepts nothing cross-origin when no domain is shared', () => {
    // Without a shared cookie there is no host that could use the session anyway.
    expect(safeNextUrl('https://child.partrunner.ai/items', {})).toBe('/');
    expect(safeNextUrl('/leads', {})).toBe('/leads');
  });
});

describe('loginDestination', () => {
  const here = 'https://child.partrunner.ai/items';

  it('sends the user to Nexus once the cookie is shared', () => {
    const destination = loginDestination(here, {
      SESSION_COOKIE_DOMAIN: '.partrunner.ai',
      NEXT_PUBLIC_APPS_HOST_PREFIX: '',
    });
    expect(destination).toBe(
      `https://nexus.partrunner.ai/login?next=${encodeURIComponent(here)}`,
    );
  });

  it('falls back to the local login while the cookie is host-only', () => {
    // The loop guard. Nexus would set a cookie only Nexus can read, so the app would
    // bounce the user straight back and never see a session.
    expect(loginDestination(here, { NEXT_PUBLIC_APPS_HOST_PREFIX: '' })).toBeNull();
  });

  it('keeps localhost on its own login page', () => {
    // A `domain` attribute cannot be set for a hostname without a dot, so a shared
    // session is not expressible in local development.
    expect(loginDestination('http://localhost:3000/leads', {})).toBeNull();

    // A configured parent domain still cannot make localhost share the cookie.
    expect(
      loginDestination('http://localhost:3000/leads', { NEXUS_COOKIE_DOMAIN: '.partrunner.ai' }),
    ).toBeNull();
  });

  it('still sends an eligible host to Nexus', () => {
    expect(
      loginDestination(here, {
        NEXUS_COOKIE_DOMAIN: '.partrunner.ai',
        NEXT_PUBLIC_APPS_HOST_PREFIX: '',
        NODE_ENV: 'production',
      }),
    ).toBe(`https://nexus.partrunner.ai/login?next=${encodeURIComponent(here)}`);
  });

  it('honours the staging host prefix', () => {
    const destination = loginDestination(here, {
      SESSION_COOKIE_DOMAIN: '.partrunner.ai',
      NEXT_PUBLIC_APPS_HOST_PREFIX: 'staging.',
    });
    expect(destination).toContain('https://staging.nexus.partrunner.ai/login');
  });

  it('round-trips: what it sends is what Nexus will accept back', () => {
    // The two halves have to agree, or login succeeds and drops the user on the
    // Nexus home page instead of where they started.
    const env = { SESSION_COOKIE_DOMAIN: '.partrunner.ai', NEXT_PUBLIC_APPS_HOST_PREFIX: '' };
    const destination = loginDestination(here, env);
    const next = new URL(destination!).searchParams.get('next');
    expect(safeNextUrl(next, env)).toBe(here);
  });
});
