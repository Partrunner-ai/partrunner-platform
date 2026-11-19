// @vitest-environment jsdom
import { act, cleanup, render } from '@testing-library/react';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BackToNexus, SeamlessExitProvider, SeamlessSplash } from './react';

function pageshow(persisted: boolean) {
  const event = new Event('pageshow') as PageTransitionEvent;
  Object.defineProperty(event, 'persisted', { value: persisted });
  window.dispatchEvent(event);
}

describe('SeamlessSplash', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  const splash = () => document.querySelector('[data-seamless-splash]') as HTMLElement;

  it('measures the minimum from navigation start, not from mount', () => {
    vi.advanceTimersByTime(300); // performance.now() is 300 at mount
    render(<SeamlessSplash minDurationMs={360} />);
    expect(splash().getAttribute('aria-hidden')).toBe('false');
    act(() => {
      vi.advanceTimersByTime(59);
    });
    expect(splash().getAttribute('aria-hidden')).toBe('false');
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(splash().getAttribute('aria-hidden')).toBe('true');
  });

  it('hides at once when the page already took longer than the minimum', () => {
    vi.advanceTimersByTime(1000);
    render(<SeamlessSplash minDurationMs={360} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    expect(splash().getAttribute('aria-hidden')).toBe('true');
  });

  it('uses a .2s fade', () => {
    render(<SeamlessSplash />);
    expect(splash().style.transition).toContain('.2s');
  });

  it('shows again on bfcache return and hides after the minimum', () => {
    vi.advanceTimersByTime(1000);
    render(<SeamlessSplash minDurationMs={360} />);
    act(() => {
      vi.advanceTimersByTime(0);
    });
    act(() => pageshow(false));
    expect(splash().getAttribute('aria-hidden')).toBe('true');
    act(() => pageshow(true));
    expect(splash().getAttribute('aria-hidden')).toBe('false');
    act(() => {
      vi.advanceTimersByTime(360);
    });
    expect(splash().getAttribute('aria-hidden')).toBe('true');
  });

  it('keeps the reduced-motion rule', () => {
    render(<SeamlessSplash />);
    expect(document.querySelector('style')?.textContent).toContain('prefers-reduced-motion');
  });
});

describe('SeamlessExitProvider', () => {
  const originalLocation = window.location;
  let rafQueue: FrameRequestCallback[];
  let assigned: string | null;

  beforeEach(() => {
    rafQueue = [];
    assigned = null;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafQueue.push(cb);
      return rafQueue.length;
    });
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        set href(value: string) {
          assigned = value;
        },
        get href() {
          return 'http://localhost/';
        },
      },
    });
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  const flushFrame = () => {
    const queue = rafQueue;
    rafQueue = [];
    for (const cb of queue) cb(0);
  };
  const overlay = () =>
    document.querySelector('div[aria-hidden]:not([data-seamless-splash])') as HTMLElement;

  function setup() {
    const view = render(
      <SeamlessExitProvider>
        <BackToNexus nexusUrl="https://nexus.example/" />
      </SeamlessExitProvider>,
    );
    return view;
  }

  it('shows the overlay and navigates after two frames, with no timer', () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'setInterval', 'clearTimeout', 'clearInterval'] });
    const { getByText } = setup();
    act(() => {
      getByText('Nexus').click();
    });
    expect(overlay().getAttribute('aria-hidden')).toBe('false');
    expect(assigned).toBeNull();
    act(() => {
      vi.advanceTimersByTime(5000); // a fixed timer would have fired by now
    });
    expect(assigned).toBeNull();
    act(flushFrame);
    expect(assigned).toBeNull();
    act(flushFrame);
    expect(assigned).toBe('https://nexus.example/');
    vi.useRealTimers();
  });

  it('clears the overlay when the page returns from the bfcache', () => {
    const { getByText } = setup();
    act(() => {
      getByText('Nexus').click();
    });
    expect(overlay().getAttribute('aria-hidden')).toBe('false');
    act(() => pageshow(false));
    expect(overlay().getAttribute('aria-hidden')).toBe('false');
    act(() => pageshow(true));
    expect(overlay().getAttribute('aria-hidden')).toBe('true');
  });
});

void React;
