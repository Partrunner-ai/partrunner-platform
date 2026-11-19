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

function preconnects(): HTMLLinkElement[] {
  return Array.from(document.head.querySelectorAll<HTMLLinkElement>('link[rel="preconnect"]'));
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
  it('opens a connection to the target once after the intent delay on mouse hover', () => {
    render(<Probe href={TARGET} />);
    const link = screen.getByRole('link');
    fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    vi.advanceTimersByTime(PRELOAD_INTENT_MS - 1);
    expect(preconnects()).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(preconnects()).toHaveLength(1);
    expect(preconnects()[0]!.getAttribute('href')).toBe('https://supply.partrunner.ai');
    expect(document.head.querySelectorAll('link[rel="prefetch"]')).toHaveLength(0);
  });

  it('does nothing when the pointer leaves before the delay', () => {
    render(<Probe href={TARGET} />);
    const link = screen.getByRole('link');
    fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    vi.advanceTimersByTime(PRELOAD_INTENT_MS - 10);
    fireEvent.pointerLeave(link, { pointerType: 'mouse' });
    vi.advanceTimersByTime(500);
    expect(preconnects()).toHaveLength(0);
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
    expect(preconnects()).toHaveLength(1);
  });

  it('warms once even when the user hovers again after the delay', () => {
    render(<Probe href={TARGET} />);
    const link = screen.getByRole('link');
    fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    vi.advanceTimersByTime(PRELOAD_INTENT_MS);
    fireEvent.pointerLeave(link, { pointerType: 'mouse' });
    fireEvent.pointerEnter(link, { pointerType: 'pen' });
    vi.advanceTimersByTime(1000);
    expect(preconnects()).toHaveLength(1);
  });

  it('warms an origin once, whatever the path or fragment', () => {
    render(
      <>
        <Probe href={`${TARGET}#pr-from=nexus:%2Fa`} />
        <Probe href="https://supply.partrunner.ai/other" />
      </>,
    );
    for (const link of screen.getAllByRole('link')) {
      fireEvent.pointerEnter(link, { pointerType: 'mouse' });
    }
    vi.advanceTimersByTime(1000);
    expect(preconnects()).toHaveLength(1);
  });

  it('never adds a prefetch or prerender link', () => {
    render(<Probe href={TARGET} />);
    fireEvent.pointerEnter(screen.getByRole('link'), { pointerType: 'mouse' });
    vi.advanceTimersByTime(1000);
    expect(
      document.head.querySelectorAll('link[rel="prefetch"], link[rel="prerender"], link[as]'),
    ).toHaveLength(0);
  });

  it('keeps the link click working', () => {
    const onClick = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <a href={TARGET} onClick={onClick} {...preloadOnIntent(TARGET)}>
        go
      </a>,
    );
    fireEvent.click(screen.getByRole('link'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('ignores touch', () => {
    render(<Probe href={TARGET} />);
    fireEvent.pointerEnter(screen.getByRole('link'), { pointerType: 'touch' });
    vi.advanceTimersByTime(1000);
    expect(preconnects()).toHaveLength(0);
  });

  it('ignores focus that is not from the keyboard', () => {
    render(<Probe href={TARGET} />);
    fireEvent.focus(screen.getByRole('link'));
    vi.advanceTimersByTime(1000);
    expect(preconnects()).toHaveLength(0);
  });

  it('warms on keyboard focus', () => {
    render(<Probe href={TARGET} />);
    const link = screen.getByRole('link');
    vi.spyOn(link, 'matches').mockReturnValue(true);
    fireEvent.focus(link);
    vi.advanceTimersByTime(PRELOAD_INTENT_MS);
    expect(preconnects()).toHaveLength(1);
  });

  it('respects saveData', () => {
    Object.defineProperty(navigator, 'connection', { value: { saveData: true }, configurable: true });
    render(<Probe href={TARGET} />);
    fireEvent.pointerEnter(screen.getByRole('link'), { pointerType: 'mouse' });
    vi.advanceTimersByTime(1000);
    expect(preconnects()).toHaveLength(0);
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
    expect(preconnects()).toHaveLength(0);
  });

  it('ignores a non-http target', () => {
    render(<Probe href="mailto:a@b.c" />);
    fireEvent.pointerEnter(screen.getByRole('link'), { pointerType: 'mouse' });
    vi.advanceTimersByTime(1000);
    expect(preconnects()).toHaveLength(0);
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
    expect(preconnects().length).toBeGreaterThan(0);
    expect(preconnects().some((l) => new URL(l.href).hostname.startsWith('nexus.'))).toBe(false);
    const before = preconnects().length;
    for (const tile of tiles) fireEvent.pointerEnter(tile, { pointerType: 'mouse' });
    vi.advanceTimersByTime(PRELOAD_INTENT_MS);
    expect(preconnects()).toHaveLength(before);
  });

  it('warms a «Mis apps» row on hover', () => {
    useProductionRegistry();
    render(<UnifiedShell context={staffContext({ favoriteApps: ['liveops'] })} />);
    const row = screen.getByRole('region', { name: 'Mis apps' }).querySelector('a.pr-favs__row');
    expect(row).toBeTruthy();
    fireEvent.pointerEnter(row!, { pointerType: 'mouse' });
    vi.advanceTimersByTime(PRELOAD_INTENT_MS);
    expect(preconnects()).toHaveLength(1);
  });
});

