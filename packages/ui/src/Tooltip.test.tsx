import { useRef, useState } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';
import { Tooltip } from './Tooltip';

describe('Tooltip', () => {
  it('opens on hover after the delay and describes rather than labels its trigger', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Archive this route" delay={0}>
        <Button aria-label="Archive">A</Button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button', { name: 'Archive' });

    expect(screen.queryByRole('tooltip')).toBeNull();
    await user.hover(trigger);

    const tip = await screen.findByRole('tooltip');
    expect(tip.textContent).toBe('Archive this route');
    // The button keeps its own accessible name; the tooltip only describes it.
    expect(screen.getByRole('button', { name: 'Archive' })).toBe(trigger);
    expect(trigger.getAttribute('aria-describedby')).toBe(tip.id);

    await user.unhover(trigger);
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  /*
   * These two use real timers with a short delay rather than `vi.useFakeTimers`.
   * Installing fake timers here strands the pending open across `cleanup` and every
   * later test in the file times out — nothing else in this package fakes timers,
   * and a 40ms wait is cheap enough not to be worth the breakage.
   */
  it('waits out the hover delay instead of flashing on a passing cursor', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Archive" delay={40}>
        <button type="button">A</button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole('button'));
    expect(screen.queryByRole('tooltip')).toBeNull();

    await waitFor(() => expect(screen.getByRole('tooltip')).toBeTruthy());
  });

  it('drops the pending open when the cursor leaves before the delay elapses', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Archive" delay={120}>
        <button type="button">A</button>
      </Tooltip>,
    );
    const trigger = screen.getByRole('button');

    await user.hover(trigger);
    await user.unhover(trigger);
    await new Promise((resolve) => setTimeout(resolve, 200));

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('shows immediately for keyboard focus and hides on blur', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Tooltip content="Archive this route" delay={5000}>
          <button type="button">A</button>
        </Tooltip>
        <button type="button">Next</button>
      </div>,
    );

    // Tabbing to it must not sit behind a hover delay — that reads as a dead control.
    await user.tab();
    expect(screen.getByRole('button', { name: 'A' })).toBe(document.activeElement);
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeTruthy());

    await user.tab();
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('dismisses on Escape while the trigger keeps focus', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Archive" delay={0}>
        <button type="button">A</button>
      </Tooltip>,
    );

    await user.tab();
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeTruthy());

    await user.keyboard('{Escape}');

    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
    expect(document.activeElement).toBe(screen.getByRole('button'));
  });

  it('dismisses when the trigger is pressed', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Archive" delay={0}>
        <button type="button">A</button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole('button'));
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeTruthy());

    await user.click(screen.getByRole('button'));

    // Pressing the thing dismisses the hint about it.
    await waitFor(() => expect(screen.queryByRole('tooltip')).toBeNull());
  });

  it('never opens for a touch pointer, which would cover the control just tapped', async () => {
    const user = userEvent.setup();
    render(
      <Tooltip content="Archive" delay={0}>
        <button type="button">A</button>
      </Tooltip>,
    );

    await user.pointer({ keys: '[TouchA]', target: screen.getByRole('button') });

    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('does not open when disabled, and renders nothing extra with empty content', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Tooltip content="Archive" delay={0} disabled>
        <button type="button">A</button>
      </Tooltip>,
    );

    await user.hover(screen.getByRole('button'));
    expect(screen.queryByRole('tooltip')).toBeNull();

    rerender(
      <Tooltip content="" delay={0}>
        <button type="button">A</button>
      </Tooltip>,
    );
    await user.hover(screen.getByRole('button'));

    // No content means no handlers and no describedby — not an empty black box.
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(screen.getByRole('button').getAttribute('aria-describedby')).toBeNull();
  });

  it('chains onto the child handlers and ref instead of replacing them', async () => {
    const user = userEvent.setup();
    const onPointerEnter = vi.fn();
    function Host() {
      const ref = useRef<HTMLButtonElement | null>(null);
      const [tag, setTag] = useState('');
      return (
        <div>
          <Tooltip content="Archive" delay={0}>
            <button
              type="button"
              ref={(node) => {
                ref.current = node;
                if (node) setTag(node.tagName);
              }}
              onPointerEnter={onPointerEnter}
            >
              A
            </button>
          </Tooltip>
          <span data-testid="tag">{tag}</span>
        </div>
      );
    }
    render(<Host />);

    await user.hover(screen.getByRole('button'));

    expect(onPointerEnter).toHaveBeenCalled();
    await waitFor(() => expect(screen.getByRole('tooltip')).toBeTruthy());
    // The child's own callback ref still received the node.
    expect(screen.getByTestId('tag').textContent).toBe('BUTTON');
  });

  it('keeps a describedby the child already had', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <Tooltip content="Archive" delay={0}>
          <button type="button" aria-describedby="hint">
            A
          </button>
        </Tooltip>
        <span id="hint">Existing hint</span>
      </div>,
    );
    const trigger = screen.getByRole('button');

    expect(trigger.getAttribute('aria-describedby')).toBe('hint');
    await user.hover(trigger);
    const tip = await screen.findByRole('tooltip');

    expect(trigger.getAttribute('aria-describedby')).toBe(`hint ${tip.id}`);
  });
});
