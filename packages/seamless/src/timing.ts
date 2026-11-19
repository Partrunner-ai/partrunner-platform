// Framework-agnostic page-ready timing. Plain DOM code: no React, no server
// entry, and no window access at import time.
import { getAppRegistryConfig } from '@partrunner-ai/app-registry/url';

export interface PageReadySample {
  /** `hard` = full document load; `soft` = client route change. */
  nav: 'hard' | 'soft';
  /** Start until the content settled (integer ms). */
  readyMs: number;
  timedOut: boolean;
  /** Hard loads only. */
  ttfbMs?: number;
  fcpMs?: number;
  lcpMs?: number;
  /** Hard loads only: app sub of `document.referrer` when it is another staff app. */
  fromApp?: string;
}

export interface WatchPageReadyOptions {
  nav: 'hard' | 'soft';
  currentApp: string;
  /** `performance.now()` ms. A hard load defaults to 0 (navigation start). */
  startAt?: number;
  /** Quiet time (no DOM or resource activity) that counts as settled. Default 600. */
  quietMs?: number;
  /** Give up after this long and report `timedOut`. Default 30000. */
  timeoutMs?: number;
  onReady(sample: PageReadySample): void;
}

const BUSY_SELECTOR = [
  '[aria-busy="true"]',
  '[data-slot="skeleton"]',
  '[data-pr-loading]',
  '[data-seamless-splash][aria-hidden="false"]',
].join(',');

/** Resource requests that must not keep a page "busy". */
const IGNORED_RESOURCE = [
  /^[a-z]+:\/\/[^/]*\/api\/telemetry\//i,
  /^[a-z]+:\/\/[^/]*sentry\.io\//i,
  /^[a-z]+:\/\/[^/]*ingest\.[^/]*\//i,
  /^[a-z]+:\/\/[^/]*(google-analytics|googletagmanager|vercel-insights|vitals\.vercel-insights)\.[^/]*\//i,
];

const LINK_CLICK_WINDOW_MS = 2000;
const CHECK_INTERVAL_MS = 100;

let lastLinkClickAt: number | null = null;
let clickListenerInstalled = false;

function installLinkClickTracking(): void {
  if (clickListenerInstalled || typeof document === 'undefined') return;
  clickListenerInstalled = true;
  document.addEventListener(
    'click',
    (event) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.origin !== window.location.origin) return;
      lastLinkClickAt = performance.now();
    },
    true,
  );
}

/**
 * Start time for a navigation. A hard load starts at 0. A soft navigation starts
 * at the last same-origin link click within 2 s, else now. The click listener is
 * installed on first use (`watchPageReady` also installs it).
 */
export function navStartFor(nav: 'hard' | 'soft'): number {
  if (nav === 'hard') return 0;
  if (typeof window === 'undefined') return 0;
  installLinkClickTracking();
  const now = performance.now();
  if (lastLinkClickAt !== null && now - lastLinkClickAt <= LINK_CLICK_WINDOW_MS) {
    return lastLinkClickAt;
  }
  return now;
}

function appFromReferrer(currentApp: string): string | undefined {
  try {
    if (!document.referrer) return undefined;
    const host = new URL(document.referrer).hostname;
    const { hostPrefix, baseDomain } = getAppRegistryConfig();
    const suffix = `.${baseDomain}`;
    if (!host.endsWith(suffix)) return undefined;
    let sub = host.slice(0, -suffix.length);
    if (hostPrefix && sub.startsWith(hostPrefix)) sub = sub.slice(hostPrefix.length);
    if (!sub || sub.includes('.') || sub === currentApp) return undefined;
    return sub;
  } catch {
    return undefined;
  }
}

function isVisible(el: Element): boolean {
  const node = el as HTMLElement;
  if (typeof node.checkVisibility === 'function') return node.checkVisibility();
  // Older browsers and jsdom: walk up and look for a hidden or display:none ancestor.
  for (let n: HTMLElement | null = node; n; n = n.parentElement) {
    if (n.hidden) return false;
    const style = getComputedStyle(n);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
  }
  return true;
}

function isBusy(): boolean {
  for (const el of Array.from(document.querySelectorAll(BUSY_SELECTOR))) {
    if (isVisible(el)) return true;
  }
  return false;
}

/**
 * Watch until the page content settles, then call `onReady` once.
 *
 * Settled = nothing busy is visible (aria-busy, skeletons, `data-pr-loading`,
 * the visible seamless splash) and neither the DOM nor the resource list changed
 * for `quietMs`. A page that becomes hidden is cancelled with no sample.
 * Returns a cancel function.
 */
export function watchPageReady(opts: WatchPageReadyOptions): () => void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => {};
  installLinkClickTracking();

  const { nav, currentApp, quietMs = 600, timeoutMs = 30000, onReady } = opts;
  const startAt = opts.startAt ?? (nav === 'hard' ? 0 : performance.now());
  let lastActivity = performance.now();
  let lcp: number | undefined;
  let done = false;

  const cleanups: Array<() => void> = [];
  const finish = () => {
    done = true;
    for (const cleanup of cleanups) cleanup();
    cleanups.length = 0;
  };

  const touch = () => {
    lastActivity = performance.now();
  };

  if (typeof MutationObserver !== 'undefined' && document.body) {
    const mutations = new MutationObserver(touch);
    mutations.observe(document.body, { childList: true, characterData: true, subtree: true });
    cleanups.push(() => mutations.disconnect());
  }

  if (typeof PerformanceObserver !== 'undefined') {
    try {
      const resources = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!IGNORED_RESOURCE.some((pattern) => pattern.test(entry.name))) touch();
        }
      });
      resources.observe({ type: 'resource' });
      cleanups.push(() => resources.disconnect());
    } catch {
      /* resource timing not supported */
    }
    if (nav === 'hard') {
      try {
        const paints = new PerformanceObserver((list) => {
          const entries = list.getEntries();
          const last = entries[entries.length - 1];
          if (last) lcp = last.startTime;
        });
        paints.observe({ type: 'largest-contentful-paint', buffered: true });
        cleanups.push(() => paints.disconnect());
      } catch {
        /* LCP not supported */
      }
    }
  }

  const onVisibility = () => {
    if (done || document.visibilityState !== 'hidden') return;
    finish();
  };
  document.addEventListener('visibilitychange', onVisibility);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));

  // A restored bfcache page has a stale clock and observers: drop the watch.
  const onPageShow = (event: PageTransitionEvent) => {
    if (!done && event.persisted) finish();
  };
  window.addEventListener('pageshow', onPageShow);
  cleanups.push(() => window.removeEventListener('pageshow', onPageShow));

  const hardExtras = (): Partial<PageReadySample> => {
    if (nav !== 'hard') return {};
    const extras: Partial<PageReadySample> = {};
    try {
      const navEntry = performance.getEntriesByType('navigation')[0] as
        | PerformanceNavigationTiming
        | undefined;
      if (navEntry) extras.ttfbMs = Math.round(navEntry.responseStart);
      const fcp = performance.getEntriesByName('first-contentful-paint')[0];
      if (fcp) extras.fcpMs = Math.round(fcp.startTime);
    } catch {
      /* timing entries unavailable */
    }
    if (lcp !== undefined) extras.lcpMs = Math.round(lcp);
    const fromApp = appFromReferrer(currentApp);
    if (fromApp) extras.fromApp = fromApp;
    return extras;
  };

  const interval = window.setInterval(() => {
    if (done) return;
    if (document.visibilityState === 'hidden') {
      finish();
      return;
    }
    const now = performance.now();
    if (now - startAt >= timeoutMs) {
      const sample: PageReadySample = {
        nav,
        readyMs: Math.round(timeoutMs),
        timedOut: true,
        ...hardExtras(),
      };
      finish();
      onReady(sample);
      return;
    }
    if (isBusy() || now - lastActivity < quietMs) return;
    const sample: PageReadySample = {
      nav,
      readyMs: Math.max(0, Math.round(lastActivity - startAt)),
      timedOut: false,
      ...hardExtras(),
    };
    finish();
    onReady(sample);
  }, CHECK_INTERVAL_MS);
  cleanups.push(() => window.clearInterval(interval));

  return () => {
    if (!done) finish();
  };
}
