import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { configureAppRegistry } from '@partrunner-ai/app-registry';
import { AppLauncher } from './AppLauncher';
import { PRELOAD_INTENT_MS, preloadApp, preloadOnIntent, resetPreloadState } from './preloadApp';
import { UnifiedShell, staffContext, useProductionRegistry } from './test/unified-fixtures';

// jsdom has no PointerEvent: add the one field the code reads.
class TestPointerEvent extends MouseEvent {
  pointerType: string;
  constructor(type: string, init: MouseEventInit & { pointerType?: string } = {}) {
    super(type, init);
    this.pointerType = init.pointerType ?? 'mouse';
  }
}
vi.stubGlobal('PointerEvent', TestPointerEvent);

const TARGET = 'https://supply.partrunner.ai/fleets';

function prefetches(): HTMLLinkElement[] {
  return Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]'));
}

function Probe({ href }: { href: string }) {
  return (
    <a href={href} {...preloadOnIntent(href)}>
      go
    </a>
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  resetPreloadState();
  document.head.querySelectorAll('link[data-pr-preload]').forEach((node) => node.remove());
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  Object.defineProperty(navigator, 'connection', { value: undefined, configurable: true });
  configureAppRegistry({ hostPrefix: 'staging.', baseDomain: 'partrunner.ai' });
});

describe('preloadOnIntent', () => {
  it('warms the target once after the intent delay on mouse hover', () => {
    render(<Probe href={TARGET} />);
    const link = screen.getByRole('link');
    fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    vi.advanceTimersByTime(PRELOAD_INTENT_MS - 1);
    expect(prefetches()).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(prefetches()).toHaveLength(1);
    expect(prefetches()[0]!.href).toBe(TARGET);
    expect(document.head.querySelectorAll('link[rel="preconnect"]')).toHaveLength(1);
  });

  it('does nothing when the pointer leaves before the delay', () => {
    render(<Probe href={TARGET} />);
    const link = screen.getByRole('link');
    fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    vi.advanceTimersByTime(PRELOAD_INTENT_MS - 10);
    fireEvent.pointerLeave(link, { pointerType: 'mouse' });
    vi.advanceTimersByTime(500);
    expect(prefetches()).toHaveLength(0);
  });

  it('warms a target only once per page', () => {
    render(<Probe href={TARGET} />);
    const link = screen.getByRole('link');
    for (let i = 0; i < 3; i += 1) {
      fireEvent.pointerEnter(link, { pointerType: 'mouse' });
      fireEvent.pointerLeave(link, { pointerType: 'mouse' });
      fireEvent.pointerEnter(link, { pointerType: 'mouse' });
      vi.advanceTimersByTime(PRELOAD_INTENT_MS);
    }
    preloadApp(TARGET);
    expect(prefetches()).toHaveLength(1);
  });

  it('ignores touch', () => {
    render(<Probe href={TARGET} />);
    fireEvent.pointerEnter(screen.getByRole('link'), { pointerType: 'touch' });
    vi.advanceTimersByTime(1000);
    expect(prefetches()).toHaveLength(0);
  });

  it('ignores focus that is not from the keyboard', () => {
    render(<Probe href={TARGET} />);
    fireEvent.focus(screen.getByRole('link'));
    vi.advanceTimersByTime(1000);
    expect(prefetches()).toHaveLength(0);
  });

  it('warms on keyboard focus', () => {
    render(<Probe href={TARGET} />);
    const link = screen.getByRole('link');
    vi.spyOn(link, 'matches').mockReturnValue(true);
    fireEvent.focus(link);
    vi.advanceTimersByTime(PRELOAD_INTENT_MS);
    expect(prefetches()).toHaveLength(1);
  });

  it('respects saveData', () => {
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    render(<Probe href={TARGET} />);
    fireEvent.pointerEnter(screen.getByRole('link'), { pointerType: 'mouse' });
    vi.advanceTimersByTime(1000);
    expect(prefetches()).toHaveLength(0);
  });

  it('never warms the current app, including its www alias', () => {
    render(
      <>
        <Probe href="https://nexus.partrunner.ai/solicitudes" />
        <Probe href="https://www.nexus.partrunner.ai/" />
      </>,
    );
    for (const link of screen.getAllByRole('link')) {
      fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    }
    vi.advanceTimersByTime(1000);
    expect(prefetches()).toHaveLength(0);
  });

  it('ignores a non-http target', () => {
    render(<Probe href="mailto:a@b.c" />);
    fireEvent.pointerEnter(screen.getByRole('link'), { pointerType: 'mouse' });
    vi.advanceTimersByTime(1000);
    expect(prefetches()).toHaveLength(0);
  });
});

describe('where the shell wires it', () => {
  it('warms a launcher tile on hover but not the current app tile', () => {
    useProductionRegistry();
    render(<AppLauncher currentSub="nexus" />);
    fireEvent.click(screen.getByRole('button', { name: 'Aplicaciones' }));
    const tiles = screen.getAllByRole('menuitem');
    for (const tile of tiles) fireEvent.pointerEnter(tile, { pointerType: 'mouse' });
    vi.advanceTimersByTime(PRELOAD_INTENT_MS);
    expect(prefetches().length).toBeGreaterThan(0);
    expect(prefetches().some((l) => new URL(l.href).hostname.startsWith('nexus.'))).toBe(false);
    const before = prefetches().length;
    for (const tile of tiles) fireEvent.pointerEnter(tile, { pointerType: 'mouse' });
    vi.advanceTimersByTime(PRELOAD_INTENT_MS);
    expect(prefetches()).toHaveLength(before);
  });

  it('warms a «Mis apps» row on hover', () => {
    useProductionRegistry();
    render(<UnifiedShell context={staffContext({ favoriteApps: ['liveops'] })} />);
    const row = screen.getByRole('region', { name: 'Mis apps' }).querySelector('a.pr-favs__row');
    expect(row).toBeTruthy();
    fireEvent.pointerEnter(row!, { pointerType: 'mouse' });
    vi.advanceTimersByTime(PRELOAD_INTENT_MS);
    expect(prefetches()).toHaveLength(1);
  });
});

