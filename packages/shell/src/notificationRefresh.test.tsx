import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NOTIFICATION_REFRESH_MS, NotificationCenter } from './NotificationCenter';

function center(onRefresh?: () => void) {
  return (
    <NotificationCenter
      items={[]}
      unreadCount={0}
      unseenCount={0}
      href="https://nexus.partrunner.ai/notificaciones"
      onRefresh={onRefresh}
    />
  );
}

function setVisibility(state: DocumentVisibilityState) {
  return vi.spyOn(document, 'visibilityState', 'get').mockReturnValue(state);
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('notification refresh', () => {
  it('asks the host for a fresh snapshot every minute while visible', () => {
    const refresh = vi.fn();
    render(center(refresh));

    vi.advanceTimersByTime(NOTIFICATION_REFRESH_MS - 1);
    expect(refresh).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(refresh).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(NOTIFICATION_REFRESH_MS);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('does not poll a tab nobody is looking at', () => {
    setVisibility('hidden');
    const refresh = vi.fn();
    render(center(refresh));

    vi.advanceTimersByTime(NOTIFICATION_REFRESH_MS * 3);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('catches up as soon as the tab comes back into view', () => {
    const visibility = setVisibility('hidden');
    const refresh = vi.fn();
    render(center(refresh));

    visibility.mockReturnValue('visible');
    document.dispatchEvent(new Event('visibilitychange'));
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('keeps one clock when the host passes a new callback each render', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(center(first));
    vi.advanceTimersByTime(NOTIFICATION_REFRESH_MS / 2);
    rerender(center(second));
    vi.advanceTimersByTime(NOTIFICATION_REFRESH_MS / 2);

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('stops polling when the host has nothing to refresh with', () => {
    const refresh = vi.fn();
    const { rerender } = render(center(refresh));
    rerender(center());
    vi.advanceTimersByTime(NOTIFICATION_REFRESH_MS * 2);

    expect(refresh).not.toHaveBeenCalled();
  });
});
