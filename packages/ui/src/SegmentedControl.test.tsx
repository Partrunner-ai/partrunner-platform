import { useState } from 'react';
import { fireEvent, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SegmentedControl, type SegmentedOption } from './SegmentedControl';

type View = 'all' | 'mine' | 'team' | 'archived';

const OPTIONS: ReadonlyArray<SegmentedOption<View>> = [
  { value: 'all', label: 'Todas', count: 128 },
  { value: 'mine', label: 'Mis' },
  { value: 'team', label: 'Equipo', disabled: true },
  { value: 'archived', label: 'Archivadas' },
];

function Controlled({ initial = 'all' as View | null, onChange = vi.fn() }) {
  const [value, setValue] = useState<View | null>(initial);
  return (
    <SegmentedControl
      aria-label="Vista"
      value={value}
      onChange={(next) => {
        onChange(next);
        setValue(next);
      }}
      options={OPTIONS}
    />
  );
}

describe('SegmentedControl', () => {
  it('is a radiogroup of radios with one checked, focusable option', () => {
    const { getByRole, getAllByRole } = render(<Controlled />);
    const group = getByRole('radiogroup', { name: 'Vista' });
    expect(group.className).toContain('pr-segmented--md');
    const radios = getAllByRole('radio');
    expect(radios).toHaveLength(4);
    expect(getByRole('radio', { name: 'Todas 128' }).getAttribute('aria-checked')).toBe('true');
    expect(radios.map((radio) => radio.getAttribute('tabindex'))).toEqual(['0', '-1', '-1', '-1']);
    expect(getByRole('radio', { name: 'Equipo' })).toHaveProperty('disabled', true);
  });

  it('gives the tab stop to the first enabled option when nothing is checked', () => {
    const { getAllByRole } = render(<Controlled initial={null} />);
    expect(getAllByRole('radio').map((radio) => radio.getAttribute('aria-checked'))).toEqual([
      'false',
      'false',
      'false',
      'false',
    ]);
    expect(getAllByRole('radio').map((radio) => radio.getAttribute('tabindex'))).toEqual([
      '0',
      '-1',
      '-1',
      '-1',
    ]);
  });

  it('selects on click and calls nothing for a click on the checked option', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Controlled onChange={onChange} />);
    fireEvent.click(getByRole('radio', { name: 'Todas 128' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(getByRole('radio', { name: 'Mis' }));
    expect(onChange).toHaveBeenCalledWith('mine');
    expect(getByRole('radio', { name: 'Mis' }).getAttribute('aria-checked')).toBe('true');
    expect(getByRole('radio', { name: 'Todas 128' }).getAttribute('aria-checked')).toBe('false');
  });

  it('moves and selects with the arrow keys, wrapping and skipping disabled options', () => {
    const onChange = vi.fn();
    const { getByRole } = render(<Controlled onChange={onChange} />);
    const all = getByRole('radio', { name: 'Todas 128' });
    const mine = getByRole('radio', { name: 'Mis' });
    const archived = getByRole('radio', { name: 'Archivadas' });

    all.focus();
    fireEvent.keyDown(all, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('mine');
    expect(document.activeElement).toBe(mine);

    fireEvent.keyDown(mine, { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('archived');
    expect(document.activeElement).toBe(archived);

    fireEvent.keyDown(archived, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenLastCalledWith('all');
    expect(document.activeElement).toBe(all);

    fireEvent.keyDown(all, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenLastCalledWith('archived');
    fireEvent.keyDown(archived, { key: 'Home' });
    expect(onChange).toHaveBeenLastCalledWith('all');
    fireEvent.keyDown(all, { key: 'End' });
    expect(onChange).toHaveBeenLastCalledWith('archived');
    expect(onChange).toHaveBeenCalledTimes(6);
  });

  it('swaps Left and Right in a right-to-left group', () => {
    const onChange = vi.fn();
    const { getByRole } = render(
      <SegmentedControl
        aria-label="Vista"
        dir="rtl"
        value="all"
        onChange={onChange}
        options={OPTIONS}
      />,
    );
    fireEvent.keyDown(getByRole('radio', { name: 'Todas 128' }), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenCalledWith('mine');
  });

  it('treats a value that matches no option as unchecked', () => {
    const { getAllByRole, getByRole } = render(
      <SegmentedControl
        aria-label="Vista"
        value={'gone' as View}
        onChange={() => {}}
        options={OPTIONS}
      />,
    );
    expect(getAllByRole('radio').every((radio) => radio.getAttribute('aria-checked') === 'false'))
      .toBe(true);
    expect(getByRole('radio', { name: 'Todas 128' }).getAttribute('tabindex')).toBe('0');
  });

  it('marks the whole group disabled when every option is', () => {
    const { getByRole, getAllByRole } = render(
      <SegmentedControl
        aria-label="Vista"
        value="all"
        onChange={() => {}}
        options={OPTIONS.map((option) => ({ ...option, disabled: true }))}
      />,
    );
    expect(getByRole('radiogroup', { name: 'Vista' }).getAttribute('aria-disabled')).toBe('true');
    expect(getAllByRole('radio').every((radio) => radio.getAttribute('tabindex') === '-1')).toBe(
      true,
    );
  });

  it('takes size, fullWidth, id and an aria-labelledby alternative', () => {
    const { getByRole } = render(
      <>
        <span id="view-label">Vista</span>
        <SegmentedControl
          aria-labelledby="view-label"
          id="view"
          size="lg"
          fullWidth
          className="extra"
          value="all"
          onChange={() => {}}
          options={OPTIONS}
        />
      </>,
    );
    const group = getByRole('radiogroup', { name: 'Vista' });
    expect(group.id).toBe('view');
    expect(group.className).toBe('pr-segmented pr-segmented--lg pr-segmented--block extra');
    expect(getByRole('radio', { name: 'Mis' }).id).toBe('view-mine');
  });
});
