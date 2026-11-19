// @vitest-environment jsdom
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { navStartFor, watchPageReady, type PageReadySample } from './timing';

type ObserverCallback = (list: { getEntries(): Array<{ name: string; startTime: number }> }) => void;
const observers: Array<{ type: string; cb: ObserverCallback; disconnected: boolean }> = [];

class FakePerformanceObserver {
  private entry: (typeof observers)[number] | undefined;
  constructor(private cb: ObserverCallback) {}
  observe(opts: { type: string }) {
    this.entry = { type: opts.type, cb: this.cb, disconnected: false };
    observers.push(this.entry);
  }
  disconnect() {
    if (this.entry) this.entry.disconnected = true;
  }
}

function resource(name: string) {
  for (const o of observers) {
    if (o.type === 'resource' && !o.disconnected) {
      o.cb({ getEntries: () => [{ name, startTime: 0 }] });
    }
  }
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('watchPageReady', () => {
  let samples: PageReadySample[];
  const onReady = (s: PageReadySample) => samples.push(s);

  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('PerformanceObserver', FakePerformanceObserver);
    observers.length = 0;
    samples = [];
    document.body.innerHTML = '<main id="root"></main>';
    setVisibility('visible');
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    Object.defineProperty(document, 'referrer', { configurable: true, value: '' });
  });

  it('reports after a quiet window, from the last activity', async () => {
    vi.advanceTimersByTime(500);
    watchPageReady({ nav: 'hard', currentApp: 'supply', onReady });
    await vi.advanceTimersByTimeAsync(300);
    document.getElementById('root')!.append(document.createElement('p')); // mutation at ~800
    await vi.advanceTimersByTimeAsync(2000);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ nav: 'hard', timedOut: false });
    expect(samples[0]!.readyMs).toBeGreaterThanOrEqual(790);
    expect(samples[0]!.readyMs).toBeLessThanOrEqual(810);
    expect(Number.isInteger(samples[0]!.readyMs)).toBe(true);
  });

  it('does not report while something busy is visible', async () => {
    document.body.insertAdjacentHTML('beforeend', '<div data-slot="skeleton"></div>');
    watchPageReady({ nav: 'hard', currentApp: 'supply', onReady });
    await vi.advanceTimersByTimeAsync(5000);
    expect(samples).toHaveLength(0);
    document.querySelector('[data-slot="skeleton"]')!.remove();
    await vi.advanceTimersByTimeAsync(1000);
    expect(samples).toHaveLength(1);
  });

  it.each(['[aria-busy="true"]', '[data-pr-loading]', '[data-seamless-splash][aria-hidden="false"]'])(
    'treats %s as busy',
    async (selector) => {
      const el = document.createElement('div');
      if (selector.startsWith('[aria-busy')) el.setAttribute('aria-busy', 'true');
      else if (selector.startsWith('[data-pr')) el.setAttribute('data-pr-loading', '');
      else {
        el.setAttribute('data-seamless-splash', '');
        el.setAttribute('aria-hidden', 'false');
      }
      document.body.append(el);
      watchPageReady({ nav: 'soft', currentApp: 'supply', onReady });
      await vi.advanceTimersByTimeAsync(3000);
      expect(samples).toHaveLength(0);
    },
  );

  it('new resources extend the quiet window, but telemetry does not', async () => {
    watchPageReady({ nav: 'soft', currentApp: 'supply', startAt: 0, onReady });
    await vi.advanceTimersByTimeAsync(400);
    resource('https://x.test/api/telemetry/page-ready');
    await vi.advanceTimersByTimeAsync(300);
    expect(samples).toHaveLength(1); // telemetry at 400 was ignored
    samples = [];
    watchPageReady({ nav: 'soft', currentApp: 'supply', startAt: 0, onReady });
    await vi.advanceTimersByTimeAsync(400);
    resource('https://x.test/api/rutas');
    await vi.advanceTimersByTimeAsync(300);
    expect(samples).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(500);
    expect(samples).toHaveLength(1);
  });

  it('cancels with no sample when the page becomes hidden', async () => {
    watchPageReady({ nav: 'hard', currentApp: 'supply', onReady });
    await vi.advanceTimersByTimeAsync(200);
    setVisibility('hidden');
    await vi.advanceTimersByTimeAsync(5000);
    expect(samples).toHaveLength(0);
    expect(observers.every((o) => o.disconnected)).toBe(true);
  });

  it('cancel() stops it and disconnects', async () => {
    const cancel = watchPageReady({ nav: 'hard', currentApp: 'supply', onReady });
    cancel();
    await vi.advanceTimersByTimeAsync(5000);
    expect(samples).toHaveLength(0);
    expect(observers.every((o) => o.disconnected)).toBe(true);
  });

  it('times out with timedOut=true and readyMs = timeoutMs', async () => {
    document.body.insertAdjacentHTML('beforeend', '<div aria-busy="true"></div>');
    watchPageReady({ nav: 'hard', currentApp: 'supply', timeoutMs: 2000, onReady });
    await vi.advanceTimersByTimeAsync(2500);
    expect(samples).toHaveLength(1);
    expect(samples[0]).toMatchObject({ timedOut: true, readyMs: 2000 });
  });

  it('reports fromApp when the referrer is another staff app', async () => {
    Object.defineProperty(document, 'referrer', {
      configurable: true,
      value: 'https://staging.sales.partrunner.ai/leads',
    });
    watchPageReady({ nav: 'hard', currentApp: 'supply', onReady });
    await vi.advanceTimersByTimeAsync(2000);
    expect(samples[0]!.fromApp).toBe('sales');
  });

  it('omits fromApp for the same app, external sites and soft navigation', async () => {
    for (const [nav, referrer] of [
      ['hard', 'https://staging.supply.partrunner.ai/'],
      ['hard', 'https://www.google.com/'],
      ['soft', 'https://staging.sales.partrunner.ai/'],
    ] as const) {
      samples = [];
      Object.defineProperty(document, 'referrer', { configurable: true, value: referrer });
      watchPageReady({ nav, currentApp: 'supply', startAt: 0, onReady });
      await vi.advanceTimersByTimeAsync(2000);
      expect(samples[0]!.fromApp).toBeUndefined();
    }
  });
});

describe('navStartFor', () => {
  beforeAll(() => {
    // jsdom cannot navigate; the capture listener still runs first.
    document.addEventListener('click', (e) => e.preventDefault());
  });
  beforeEach(() => {
    vi.useFakeTimers();
    document.body.innerHTML = '<a id="same" href="/rutas">x</a><a id="far" href="https://other.test/">y</a>';
  });
  afterEach(() => vi.useRealTimers());

  it('is 0 for a hard load', () => {
    vi.advanceTimersByTime(900);
    expect(navStartFor('hard')).toBe(0);
  });

  it('uses the last same-origin link click within 2 s', () => {
    navStartFor('soft'); // installs the capture listener
    vi.advanceTimersByTime(1000);
    document.getElementById('same')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    const clickedAt = performance.now();
    vi.advanceTimersByTime(500);
    expect(navStartFor('soft')).toBe(clickedAt);
    vi.advanceTimersByTime(2000);
    expect(navStartFor('soft')).toBe(performance.now());
  });

  it('ignores a click on a link to another origin', () => {
    navStartFor('soft');
    vi.advanceTimersByTime(30000);
    document.getElementById('far')!.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    vi.advanceTimersByTime(100);
    expect(navStartFor('soft')).toBe(performance.now());
  });
});
