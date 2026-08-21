import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, expectTypeOf, it, vi } from 'vitest';
import {
  Pagination,
  type PaginationLabels,
  type PaginationProps,
  type PaginationSummary,
} from './index';

describe('Pagination', () => {
  it('exports the controlled public types from the package seam', () => {
    expectTypeOf<PaginationProps['page']>().toEqualTypeOf<number>();
    expectTypeOf<PaginationProps['onPageChange']>().parameters.toEqualTypeOf<[number]>();
    expectTypeOf<PaginationLabels['summary']>()
      .parameter(0)
      .toEqualTypeOf<PaginationSummary>();
  });

  it('presents the first page and blocks navigation before it', async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={1} pageSize={20} totalItems={45} onPageChange={onPageChange} />,
    );

    expect(screen.getByRole('navigation', { name: 'Pagination' })).not.toBeNull();
    expect(screen.getByRole('status').textContent).toBe('1–20 of 45');
    expect(screen.getByRole('status').getAttribute('aria-live')).toBe('polite');
    expect(screen.getByRole('status').getAttribute('aria-atomic')).toBe('true');

    const previous = screen.getByRole('button', { name: 'Previous page' });
    const next = screen.getByRole('button', { name: 'Next page' });
    expect((previous as HTMLButtonElement).disabled).toBe(true);
    expect((next as HTMLButtonElement).disabled).toBe(false);

    await userEvent.click(previous);
    await userEvent.click(next);
    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('derives a middle-page summary and emits both adjacent pages', async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={2} pageSize={20} totalItems={45} onPageChange={onPageChange} />,
    );

    expect(screen.getByRole('status').textContent).toBe('21–40 of 45');

    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange.mock.calls).toEqual([[1], [3]]);
  });

  it('presents the partial last page and blocks navigation past it', async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination page={3} pageSize={20} totalItems={45} onPageChange={onPageChange} />,
    );

    expect(screen.getByRole('status').textContent).toBe('41–45 of 45');
    expect(
      (screen.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement).disabled,
    ).toBe(false);

    const next = screen.getByRole('button', { name: 'Next page' });
    expect((next as HTMLButtonElement).disabled).toBe(true);
    await userEvent.click(next);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('uses a stable zero state when there are no items', () => {
    render(<Pagination page={1} pageSize={20} totalItems={0} onPageChange={() => {}} />);

    expect(screen.getByRole('status').textContent).toBe('0–0 of 0');
    expect(
      (screen.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('blocks all navigation while the caller is loading or otherwise disabled', async () => {
    const onPageChange = vi.fn();
    render(
      <Pagination
        page={2}
        pageSize={20}
        totalItems={45}
        onPageChange={onPageChange}
        disabled
      />,
    );

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
    expect(buttons.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
    await userEvent.click(buttons[0]!);
    await userEvent.click(buttons[1]!);
    expect(onPageChange).not.toHaveBeenCalled();
  });

  it('supports custom control and summary labels through the same derived value', () => {
    const summary = vi.fn((value: PaginationSummary) => (
      <span>
        Page {value.page} of {value.pageCount}: {value.start} to {value.end}
      </span>
    ));

    render(
      <Pagination
        page={2}
        pageSize={10}
        totalItems={25}
        onPageChange={() => {}}
        aria-label="Results pages"
        className="consumer-pagination"
        labels={{ previous: 'Back', next: 'Forward', summary }}
      />,
    );

    const navigation = screen.getByRole('navigation', { name: 'Results pages' });
    expect(navigation.className).toContain('pr-pagination');
    expect(navigation.className).toContain('consumer-pagination');
    expect(screen.getByRole('button', { name: 'Back' }).textContent).toContain('Back');
    expect(screen.getByRole('button', { name: 'Forward' }).textContent).toContain('Forward');
    expect(screen.getByRole('status').textContent).toBe('Page 2 of 3: 11 to 20');
    expect(summary).toHaveBeenCalledWith({
      page: 2,
      pageSize: 10,
      totalItems: 25,
      pageCount: 3,
      start: 11,
      end: 20,
    });
  });

  it.each([
    ['page below one', { page: 0, pageSize: 20, totalItems: 45 }],
    ['fractional page', { page: 1.5, pageSize: 20, totalItems: 45 }],
    ['zero page size', { page: 1, pageSize: 0, totalItems: 45 }],
    ['fractional page size', { page: 1, pageSize: 2.5, totalItems: 45 }],
    ['negative total', { page: 1, pageSize: 20, totalItems: -1 }],
    ['fractional total', { page: 1, pageSize: 20, totalItems: 1.5 }],
    [
      'unsafe page',
      {
        page: Number.MAX_SAFE_INTEGER + 1,
        pageSize: 1,
        totalItems: Number.MAX_SAFE_INTEGER + 1,
      },
    ],
    [
      'unsafe page size',
      { page: 1, pageSize: Number.MAX_SAFE_INTEGER + 1, totalItems: 1 },
    ],
    [
      'unsafe total',
      { page: 1, pageSize: 1, totalItems: Number.MAX_SAFE_INTEGER + 1 },
    ],
    ['page past the end', { page: 4, pageSize: 20, totalItems: 45 }],
  ])('fails closed and warns for an invalid %s', async (_, props) => {
    const onPageChange = vi.fn();
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});

    render(<Pagination {...props} onPageChange={onPageChange} />);

    expect(
      (screen.getByRole('button', { name: 'Previous page' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(
      (screen.getByRole('button', { name: 'Next page' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    expect(screen.getByRole('status').textContent).toMatch(/\d/);
    await userEvent.click(screen.getByRole('button', { name: 'Previous page' }));
    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).not.toHaveBeenCalled();
    await waitFor(() => expect(warning).toHaveBeenCalledWith(expect.stringContaining('[Pagination]')));

    warning.mockRestore();
  });
});
