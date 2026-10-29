import { fireEvent, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_BELL_SOUND,
  isStaffBellSound,
  type StaffBellSound,
} from './bellSound';
import { NotificationCenter } from './NotificationCenter';
import { isStaffShellSnapshot } from './StaffShellSnapshot';

const play = vi.hoisted(() => vi.fn((..._args: unknown[]) => true));
vi.mock('./bellSound', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./bellSound')>()),
  playBellSound: play,
}));

const SOUND: StaffBellSound = {
  arrival: 'two-notes',
  ring: 'single-ting',
  volume: 0.7,
  ringLimit: 3,
};

function center(unseenCount: number | undefined, sound?: StaffBellSound) {
  return (
    <NotificationCenter
      items={[]}
      unreadCount={10}
      unseenCount={unseenCount}
      href="https://nexus.partrunner.ai/notificaciones"
      sound={sound}
    />
  );
}

function bell(container: HTMLElement): Element {
  const element = container.querySelector('.pr-notifications__bell');
  if (!element) throw new Error('bell not rendered');
  return element;
}

// jsdom no trae AnimationEvent, y `fireEvent.animationStart` pierde el
// `animationName`: sin él el filtro del componente descarta el evento y las
// pruebas pasarían en silencio por la razón equivocada.
function animation(el: Element, type: string, animationName: string) {
  const event = new Event(type, { bubbles: true });
  Object.defineProperty(event, 'animationName', { value: animationName });
  fireEvent(el, event);
}
const ringStart = (el: Element) => animation(el, 'animationstart', 'pr-bell-ring');
const ringAgain = (el: Element) => animation(el, 'animationiteration', 'pr-bell-ring');

beforeEach(() => {
  play.mockClear();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('bell sound settings', () => {
  it('is silent by default, so publishing the package makes no app beep', () => {
    expect(DEFAULT_BELL_SOUND.arrival).toBe('none');
    expect(DEFAULT_BELL_SOUND.ring).toBe('none');
  });

  it('accepts only known sounds and sane numbers', () => {
    expect(isStaffBellSound(SOUND)).toBe(true);
    expect(isStaffBellSound({ ...SOUND, arrival: 'siren' })).toBe(false);
    expect(isStaffBellSound({ ...SOUND, volume: 1.5 })).toBe(false);
    expect(isStaffBellSound({ ...SOUND, ringLimit: -1 })).toBe(false);
    expect(isStaffBellSound({ ...SOUND, ringLimit: 1.5 })).toBe(false);
  });

  it('keeps snapshots without sound valid and rejects a malformed one', () => {
    const snapshot = {
      version: 1,
      user: { id: 'u', name: 'Ada', email: 'ada@example.com' },
      profileHref: '/perfil',
      preferences: {
        theme: 'system',
        locale: 'es',
        notifications: { inApp: true, email: false },
      },
      notifications: { items: [], unreadCount: 0, href: '/notificaciones' },
    };
    expect(isStaffShellSnapshot(snapshot)).toBe(true);
    expect(
      isStaffShellSnapshot({
        ...snapshot,
        notifications: { ...snapshot.notifications, sound: SOUND },
      }),
    ).toBe(true);
    expect(
      isStaffShellSnapshot({
        ...snapshot,
        notifications: { ...snapshot.notifications, sound: { arrival: 'x' } },
      }),
    ).toBe(false);
  });
});

describe('arrival sound', () => {
  it('plays once when the unseen count goes up', () => {
    const { rerender } = render(center(2, SOUND));
    rerender(center(3, SOUND));

    expect(play).toHaveBeenCalledTimes(1);
    expect(play).toHaveBeenCalledWith('arrival', 'two-notes', 0.7);
  });

  it('does not play for what was already pending when the page loaded', () => {
    // Abrir Nexus con tres avisos pendientes no es que acaben de llegar.
    const { rerender } = render(center(undefined, SOUND));
    rerender(center(3, SOUND));

    expect(play).not.toHaveBeenCalled();
  });

  it('stays silent when the count drops or the host sends no sound', () => {
    const { rerender } = render(center(3, SOUND));
    rerender(center(0, SOUND));
    rerender(center(0));
    rerender(center(4));

    expect(play).not.toHaveBeenCalled();
  });

  it('stays silent in a tab nobody is looking at', () => {
    const visibility = vi
      .spyOn(document, 'visibilityState', 'get')
      .mockReturnValue('hidden');
    const { rerender } = render(center(1, SOUND));
    rerender(center(2, SOUND));
    visibility.mockRestore();

    expect(play).not.toHaveBeenCalled();
  });
});

describe('ring sound', () => {
  it('follows the shake, one sound per animation cycle', () => {
    const { container } = render(center(2, { ...SOUND, ringLimit: 0 }));
    const el = bell(container);
    ringStart(el);
    ringAgain(el);
    ringAgain(el);

    expect(play).toHaveBeenCalledTimes(3);
    expect(play).toHaveBeenCalledWith('ring', 'single-ting', 0.7);
  });

  it('falls silent after the configured number of shakes', () => {
    const { container } = render(center(2, SOUND));
    const el = bell(container);
    ringStart(el);
    for (let i = 0; i < 5; i += 1) ringAgain(el);

    expect(play).toHaveBeenCalledTimes(3);
  });

  it('starts counting again when the bell starts ringing again', () => {
    const { container } = render(center(2, { ...SOUND, ringLimit: 1 }));
    const el = bell(container);
    ringStart(el);
    ringAgain(el);
    ringStart(el);

    expect(play).toHaveBeenCalledTimes(2);
  });

  it('skips the shake right after the arrival sound so they do not overlap', () => {
    const { container, rerender } = render(center(1, SOUND));
    rerender(center(2, SOUND));
    const el = bell(container);
    ringStart(el);
    vi.setSystemTime(new Date('2026-10-29T12:00:08Z'));
    ringAgain(el);

    expect(play.mock.calls.map(([kind]) => kind)).toEqual(['arrival', 'ring']);
  });

  it('counts only shakes that actually sound toward the limit', () => {
    // "1 vez" con aviso de llegada: la primera sacudida se calla por el aviso
    // y no puede gastarse el único turno, o la sacudida nunca sonaría.
    const { container, rerender } = render(center(1, { ...SOUND, ringLimit: 1 }));
    rerender(center(2, { ...SOUND, ringLimit: 1 }));
    const el = bell(container);
    ringStart(el);
    vi.setSystemTime(new Date('2026-10-29T12:00:08Z'));
    ringAgain(el);
    ringAgain(el);

    expect(play.mock.calls.map(([kind]) => kind)).toEqual(['arrival', 'ring']);
  });

  it('ignores animations that are not the bell shake', () => {
    const { container } = render(center(2, SOUND));
    animation(bell(container), 'animationstart', 'pr-popover-in');

    expect(play).not.toHaveBeenCalled();
  });

  it('stays silent with no ring sound configured', () => {
    const { container } = render(center(2, { ...SOUND, ring: 'none' }));
    ringStart(bell(container));

    expect(play).not.toHaveBeenCalled();
  });
});
