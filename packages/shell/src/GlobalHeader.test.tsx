import type { ReactNode } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { GlobalHeader } from './GlobalHeader';
import {
  StaffShellProvider,
  type StaffShellContextValue,
} from './StaffShellContext';

const baseContext: StaffShellContextValue = {
  user: {
    id: 'staff-1',
    name: 'Ada Lovelace',
    email: 'ada@example.com',
  },
  profileHref: 'https://nexus.partrunner.ai/profile',
  preferences: {
    locale: 'en',
    theme: 'system',
  },
  notifications: {
    unreadCount: 2,
    href: 'https://nexus.partrunner.ai/notifications',
    items: [
      {
        id: 'notification-1',
        title: 'Quote approved',
        body: 'The customer accepted quote PR-42.',
        sourceLabel: 'Sales',
        createdAt: '2026-07-23T18:30:00.000Z',
        readAt: null,
      },
    ],
  },
  setLocale: vi.fn(),
  setTheme: vi.fn(),
};

function renderHeader(
  context: StaffShellContextValue,
  start: ReactNode = <span>Sales pipeline</span>,
) {
  return render(
    <StaffShellProvider value={context}>
      <GlobalHeader currentSub="sales" start={start} />
    </StaffShellProvider>,
  );
}

describe('GlobalHeader', () => {
  it('renders the prescribed controls in a stable order', () => {
    renderHeader(baseContext);

    const launcher = screen.getByRole('button', { name: 'Applications' });
    const notifications = screen.getByRole('button', {
      name: 'Notifications: 2',
    });
    const user = screen.getByRole('button', { name: 'User menu' });
    const controls = [notifications, launcher, user];

    for (let index = 0; index < controls.length - 1; index += 1) {
      const currentControl = controls[index]!;
      const nextControl = controls[index + 1]!;
      expect(
        currentControl.compareDocumentPosition(nextControl) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
  });

  it('keeps durable preferences and the visible user name out of the header', () => {
    const setLocale = vi.fn();
    const setTheme = vi.fn();
    renderHeader({ ...baseContext, setLocale, setTheme });

    const trigger = screen.getByRole('button', { name: 'User menu' });
    expect(trigger.querySelector('.pr-usermenu__name')).toBeNull();
    expect(trigger.querySelector('svg')).toBeNull();
    expect(document.querySelector('.pr-locale-toggle')).toBeNull();
    expect(document.querySelector('.pr-theme-toggle')).toBeNull();
    expect(setLocale).not.toHaveBeenCalled();
    expect(setTheme).not.toHaveBeenCalled();
  });

  it('always includes the canonical Nexus profile action', async () => {
    const user = userEvent.setup();
    renderHeader(baseContext);

    await user.click(screen.getByRole('button', { name: 'User menu' }));

    const profile = screen.getByRole('menuitem', {
      name: 'Profile and preferences',
    });
    expect(profile.getAttribute('href')).toBe(
      'https://nexus.partrunner.ai/profile',
    );
  });

  it('falls back to initials when the avatar image cannot load', () => {
    renderHeader({
      ...baseContext,
      user: {
        ...baseContext.user,
        avatarUrl: 'https://images.example.com/ada.png',
      },
    });

    const image = document.querySelector<HTMLImageElement>(
      'img.pr-usermenu__avatar',
    );
    expect(image).not.toBeNull();
    fireEvent.error(image!);

    expect(
      document.querySelector('img.pr-usermenu__avatar'),
    ).toBeNull();
    expect(screen.getByText('AL')).toBeTruthy();
  });

  it('shows unread notifications and delegates read actions', async () => {
    const user = userEvent.setup();
    const markNotificationRead = vi.fn();
    renderHeader({ ...baseContext, markNotificationRead });

    await user.click(
      screen.getByRole('button', { name: 'Notifications: 2' }),
    );
    await user.click(screen.getByRole('button', { name: /Quote approved/ }));

    expect(markNotificationRead).toHaveBeenCalledWith('notification-1');
    expect(
      screen.getByRole('link', { name: 'View all in Nexus' }).getAttribute('href'),
    ).toBe('https://nexus.partrunner.ai/notifications');
  });

  it('opens an absolute notification destination in a new tab', async () => {
    // An absolute notification may leave the current product, so preserve the
    // user's working context in the original tab.
    const user = userEvent.setup();
    const markNotificationRead = vi.fn();
    renderHeader({
      ...baseContext,
      markNotificationRead,
      notifications: {
        ...baseContext.notifications,
        items: [
          {
            ...baseContext.notifications.items[0]!,
            href: 'https://example.com/notification-resource',
          },
        ],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Notifications: 2' }));
    const link = screen.getByRole('link', { name: /Quote approved/ });

    expect(link.getAttribute('target')).toBe('_blank');
    expect(link.getAttribute('rel')).toBe('noreferrer noopener');
    // El destino sigue delegando el marcado como leído al anfitrión.
    await user.click(link);
    expect(markNotificationRead).toHaveBeenCalledWith('notification-1');
  });

  it('keeps a relative notification destination in the same tab', async () => {
    // Una ruta relativa SÍ es una ruta de la app anfitriona: abrir una pestaña
    // nueva para ir a otra pantalla del mismo producto sería peor, no mejor.
    const user = userEvent.setup();
    renderHeader({
      ...baseContext,
      notifications: {
        ...baseContext.notifications,
        items: [
          {
            ...baseContext.notifications.items[0]!,
            href: '/notificaciones',
          },
        ],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Notifications: 2' }));
    const link = screen.getByRole('link', { name: /Quote approved/ });

    expect(link.getAttribute('target')).toBeNull();
    expect(link.getAttribute('rel')).toBeNull();
  });

  it('leaves read notifications out of the panel', async () => {
    const user = userEvent.setup();
    renderHeader({
      ...baseContext,
      notifications: {
        ...baseContext.notifications,
        items: [
          ...baseContext.notifications.items,
          {
            id: 'notification-2',
            title: 'Old invoice reminder',
            sourceLabel: 'Finance',
            createdAt: '2026-07-15T20:57:00.000Z',
            readAt: '2026-07-16T09:00:00.000Z',
          },
        ],
      },
    });

    await user.click(screen.getByRole('button', { name: 'Notifications: 2' }));

    expect(screen.getByText('Quote approved')).toBeTruthy();
    expect(screen.queryByText('Old invoice reminder')).toBeNull();
  });

  it('empties the panel once everything has been read', async () => {
    const user = userEvent.setup();
    renderHeader({
      ...baseContext,
      notifications: {
        unreadCount: 0,
        href: baseContext.notifications.href,
        items: baseContext.notifications.items.map((item) => ({
          ...item,
          readAt: '2026-07-24T10:00:00.000Z',
        })),
      },
    });

    await user.click(screen.getByRole('button', { name: 'Notifications' }));

    expect(screen.queryByText('Quote approved')).toBeNull();
    expect(screen.getByText('You have no new notifications.')).toBeTruthy();
    // The history is Nexus's, so the way out stays regardless.
    expect(
      screen.getByRole('link', { name: 'View all in Nexus' }),
    ).toBeTruthy();
  });

  it('dismisses global popovers with Escape', async () => {
    const user = userEvent.setup();
    renderHeader(baseContext);

    const trigger = screen.getByRole('button', { name: 'Notifications: 2' });
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Notifications' });
    expect(document.activeElement).toBe(dialog);

    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('dialog', { name: 'Notifications' }),
    ).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });
});
