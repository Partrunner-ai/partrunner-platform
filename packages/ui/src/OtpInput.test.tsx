import { useState } from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { OtpInput } from './OtpInput';

function Controlled({ onComplete }: { onComplete?: (value: string) => void }) {
  const [value, setValue] = useState('');
  return <OtpInput value={value} onValueChange={setValue} onComplete={onComplete} />;
}

function boxes(): HTMLInputElement[] {
  return screen.getAllByRole('textbox') as HTMLInputElement[];
}

describe('OtpInput', () => {
  it('renders one labelled numeric box per digit', () => {
    render(<OtpInput value="" onValueChange={() => {}} length={4} />);
    const all = boxes();
    expect(all).toHaveLength(4);
    expect(all[0]!.getAttribute('aria-label')).toBe('Dígito 1 de 4');
    expect(all[0]!.getAttribute('inputmode')).toBe('numeric');
    expect(all[0]!.getAttribute('autocomplete')).toBe('one-time-code');
    expect(all[1]!.getAttribute('autocomplete')).toBe('off');
  });

  it('advances focus as digits land and completes on the last one', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Controlled onComplete={onComplete} />);
    await user.click(boxes()[0]!);
    await user.keyboard('123456');
    expect(boxes()[5]!.value).toBe('6');
    expect(onComplete).toHaveBeenCalledWith('123456');
  });

  it('ignores anything that is not a digit', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(boxes()[0]!);
    await user.keyboard('a!x');
    expect(boxes()[0]!.value).toBe('');
  });

  it('walks back on Backspace, clearing the previous digit from an empty box', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(boxes()[0]!);
    await user.keyboard('12');
    // Focus sits on box 2 (empty): Backspace must reach back and take the "2".
    await user.keyboard('{Backspace}');
    expect(boxes()[1]!.value).toBe('');
    expect(boxes()[0]!.value).toBe('1');
  });

  it('distributes a pasted code across the boxes', async () => {
    const user = userEvent.setup();
    const onComplete = vi.fn();
    render(<Controlled onComplete={onComplete} />);
    await user.click(boxes()[0]!);
    await user.paste('987654');
    expect(boxes()[0]!.value).toBe('9');
    expect(boxes()[5]!.value).toBe('4');
    expect(onComplete).toHaveBeenCalledWith('987654');
  });

  it('strips non-digits from a paste instead of rejecting it', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(boxes()[0]!);
    await user.paste('12-34');
    expect(boxes()[3]!.value).toBe('4');
  });

  it('clamps typing in a skipped-ahead box to the append position, focus in tow', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(boxes()[0]!);
    await user.keyboard('12');
    // Click the 5th box with only two digits collected: the digit must land in
    // box 3 (the append position) and focus must follow IT, not the click.
    await user.click(boxes()[4]!);
    await user.keyboard('9');
    expect(boxes()[2]!.value).toBe('9');
    expect(boxes()[4]!.value).toBe('');
    expect(document.activeElement).toBe(boxes()[3]);
    await user.keyboard('7');
    expect(boxes()[3]!.value).toBe('7');
  });

  it('deletes on the first Backspace from any empty box, however far ahead', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(boxes()[0]!);
    await user.keyboard('123');
    await user.click(boxes()[5]!);
    await user.keyboard('{Backspace}');
    expect(boxes()[2]!.value).toBe('');
    expect(boxes()[1]!.value).toBe('2');
    expect(document.activeElement).toBe(boxes()[2]);
  });

  it('lets a short paste correct a full code without discarding the tail', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(boxes()[0]!);
    await user.keyboard('123456');
    await user.click(boxes()[0]!);
    await user.paste('99');
    expect(boxes().map((box) => box.value).join('')).toBe('993456');
  });

  it('replaces the final digit by typing over it', async () => {
    const user = userEvent.setup();
    render(<Controlled />);
    await user.click(boxes()[0]!);
    await user.keyboard('123456');
    // Focus stayed on the last box; typing must overwrite, not dead-end.
    await user.keyboard('8');
    expect(boxes()[5]!.value).toBe('8');
  });

  it('flags every box when invalid', () => {
    render(<OtpInput value="" onValueChange={() => {}} invalid />);
    for (const box of boxes()) {
      expect(box.getAttribute('aria-invalid')).toBe('true');
    }
  });
});
