import { createRef, type ReactNode } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ItemList, ItemRow, type ItemRowLinkProps } from './ItemList';

describe('ItemList', () => {
  it('renders a labelled list with divided rows by default', () => {
    const { getByRole } = render(
      <ItemList aria-label="Flotas">
        <ItemRow title="Uno" />
        <ItemRow title="Dos" />
      </ItemList>,
    );
    const list = getByRole('list', { name: 'Flotas' });
    expect(list.className).toContain('pr-item-list--divided');
    expect(list.querySelectorAll('li')).toHaveLength(2);
  });

  it('supports compact density and no dividers', () => {
    const { getByRole } = render(<ItemList aria-label="x" density="compact" divided={false} />);
    const cls = getByRole('list').className;
    expect(cls).toContain('pr-item-list--compact');
    expect(cls).not.toContain('pr-item-list--divided');
  });
});

describe('ItemRow', () => {
  it('renders one button by default and calls onClick', () => {
    const onClick = vi.fn();
    const { getAllByRole, getByRole } = render(
      <ItemList aria-label="x">
        <ItemRow title="Transportes Ruiz" onClick={onClick} />
      </ItemList>,
    );
    expect(getAllByRole('button')).toHaveLength(1);
    const button = getByRole('button', { name: /Transportes Ruiz/ });
    expect(button.getAttribute('type')).toBe('button');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders a link when href is set', () => {
    const { getByRole, queryByRole } = render(
      <ItemList aria-label="x">
        <ItemRow title="Ir" href="/bandeja?f=2" />
      </ItemList>,
    );
    expect(getByRole('link', { name: 'Ir' }).getAttribute('href')).toBe('/bandeja?f=2');
    expect(queryByRole('button')).toBeNull();
  });

  it('uses a router LinkComponent when given', () => {
    const Custom = ({ href, children, ...props }: ItemRowLinkProps & { children: ReactNode }) => (
      <a href={href} data-router="yes" {...props}>
        {children}
      </a>
    );
    const { getByRole } = render(
      <ItemList aria-label="x">
        <ItemRow title="Ir" href="/a" LinkComponent={Custom} />
      </ItemList>,
    );
    expect(getByRole('link').getAttribute('data-router')).toBe('yes');
  });

  it('sets aria-current and a data flag when selected', () => {
    const { getByRole, container } = render(
      <ItemList aria-label="x">
        <ItemRow title="Uno" selected />
        <ItemRow title="Dos" />
      </ItemList>,
    );
    expect(getByRole('button', { name: 'Uno' }).getAttribute('aria-current')).toBe('true');
    expect(getByRole('button', { name: 'Dos' }).getAttribute('aria-current')).toBeNull();
    expect(container.querySelectorAll('li[data-selected]')).toHaveLength(1);
  });

  it('shows leading, trailing, meta, description and the unread dot', () => {
    const { container } = render(
      <ItemList aria-label="x">
        <ItemRow
          title="Ruiz"
          description="¿Cuándo pagan?"
          descriptionLines={2}
          meta="hace 3 h"
          leading={<i data-testid="lead" />}
          trailing={<b data-testid="trail" />}
          unread
        />
      </ItemList>,
    );
    expect(container.querySelector('.pr-item-row__meta')?.textContent).toBe('hace 3 h');
    expect(container.querySelector('.pr-item-row__description--2')?.textContent).toBe('¿Cuándo pagan?');
    expect(container.querySelector('.pr-item-row__dot')).not.toBeNull();
    expect(container.querySelector('[data-testid="lead"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="trail"]')).not.toBeNull();
    expect(container.querySelector('li[data-unread]')).not.toBeNull();
  });

  it('puts the unread dot on the leading element when there is one', () => {
    const { container } = render(
      <ItemList aria-label="x">
        <ItemRow title="A" leading={<i data-testid="lead" />} unread />
        <ItemRow title="B" unread />
      </ItemList>,
    );
    const [withLeading, withoutLeading] = Array.from(container.querySelectorAll('li'));
    expect(withLeading?.querySelector('.pr-item-row__leading .pr-item-row__dot--overlay')).not.toBeNull();
    expect(withLeading?.querySelector('.pr-item-row__top .pr-item-row__dot')).toBeNull();
    expect(withoutLeading?.querySelector('.pr-item-row__top .pr-item-row__dot')).not.toBeNull();
    expect(withoutLeading?.querySelector('.pr-item-row__dot--overlay')).toBeNull();
  });

  it('does not fire onClick when disabled and marks a disabled link', () => {
    const onClick = vi.fn();
    const { getByRole } = render(
      <ItemList aria-label="x">
        <ItemRow title="Off" disabled onClick={onClick} />
        <ItemRow title="Link off" href="/a" disabled />
      </ItemList>,
    );
    fireEvent.click(getByRole('button', { name: 'Off' }));
    expect(onClick).not.toHaveBeenCalled();
    expect(getByRole('button', { name: 'Off' }).hasAttribute('disabled')).toBe(true);
    expect(document.querySelector('a[aria-disabled="true"]')?.hasAttribute('href')).toBe(false);
  });

  it('forwards ref, class and rest props to the li', () => {
    const ref = createRef<HTMLLIElement>();
    render(
      <ItemList aria-label="x">
        <ItemRow ref={ref} title="A" className="extra" id="r1" />
      </ItemList>,
    );
    expect(ref.current?.tagName).toBe('LI');
    expect(ref.current?.id).toBe('r1');
    expect(ref.current?.className).toContain('extra');
  });

  it('exposes data-tone only when a tone is set', () => {
    const { container } = render(
      <ItemList aria-label="x">
        <ItemRow title="A" tone="danger" />
        <ItemRow title="B" selected />
        <ItemRow title="C" tone="info" selected />
      </ItemList>,
    );
    const rows = container.querySelectorAll('li');
    expect(rows[0]?.getAttribute('data-tone')).toBe('danger');
    expect(rows[1]?.hasAttribute('data-tone')).toBe(false);
    expect(rows[2]?.getAttribute('data-tone')).toBe('info');
    expect(rows[2]?.hasAttribute('data-selected')).toBe(true);
  });

  it('renders the footer as a third line inside the one control', () => {
    const { container, getAllByRole } = render(
      <ItemList aria-label="x">
        <ItemRow title="A" description="Hola" footer="En proceso · 1 chat" />
        <ItemRow title="B" />
      </ItemList>,
    );
    const footer = container.querySelector('.pr-item-row__footer');
    expect(footer?.textContent).toBe('En proceso · 1 chat');
    expect(footer?.closest('.pr-item-row__main')).not.toBeNull();
    expect(container.querySelectorAll('.pr-item-row__footer')).toHaveLength(1);
    expect(getAllByRole('button')).toHaveLength(2);
  });

  it('gives an unread row a hidden text label before the title', () => {
    const { getByRole } = render(
      <ItemList aria-label="x">
        <ItemRow title="Transportes Ruiz" unread onClick={() => {}} />
      </ItemList>,
    );
    const button = getByRole('button', { name: 'No leído, Transportes Ruiz' });
    expect(button.querySelector('.pr-visually-hidden')?.textContent).toBe('No leído, ');
  });

  it('adds no unread label to a read row', () => {
    const { container } = render(
      <ItemList aria-label="x">
        <ItemRow title="Transportes Ruiz" onClick={() => {}} />
      </ItemList>,
    );
    expect(container.querySelector('.pr-visually-hidden')).toBeNull();
  });

  it('takes a custom unread label', () => {
    const { getByRole } = render(
      <ItemList aria-label="x">
        <ItemRow title="Fleet" unread unreadLabel="Unread" leading={<span>L</span>} onClick={() => {}} />
      </ItemList>,
    );
    expect(getByRole('button', { name: /Unread, Fleet/ })).toBeTruthy();
  });
});
