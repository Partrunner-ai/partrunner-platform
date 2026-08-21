import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProgressDots, Stepper } from './Stepper';

const STEPS = ['Cuenta', 'Documentos', 'Revisión'];

describe('Stepper', () => {
  it('marks only the active step as the current one', () => {
    render(<Stepper steps={STEPS} current={1} />);
    const items = screen.getAllByRole('listitem');
    expect(items[0]!.className).toContain('pr-stepper__step--done');
    expect(items[1]!.getAttribute('aria-current')).toBe('step');
    expect(items[2]!.className).toContain('pr-stepper__step--future');
  });

  it('lets the user revisit completed steps but never skip ahead', async () => {
    const user = userEvent.setup();
    const onStepSelect = vi.fn();
    render(<Stepper steps={STEPS} current={1} onStepSelect={onStepSelect} />);
    // Only the done step renders as a control; current and future stay inert.
    // Its accessible name carries the completed state.
    expect(screen.getAllByRole('button')).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: /Cuenta.*completado/ }));
    expect(onStepSelect).toHaveBeenCalledWith(0);
  });

  it('stays inert without a handler', () => {
    render(<Stepper steps={STEPS} current={2} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('names the sequence for assistive tech', () => {
    render(<Stepper steps={STEPS} current={0} label="Registro" />);
    expect(screen.getByRole('navigation', { name: 'Registro' })).toBeTruthy();
  });
});

describe('ProgressDots', () => {
  it('collapses to a single announced position', () => {
    render(<ProgressDots count={6} current={1} />);
    expect(screen.getByRole('img', { name: 'Paso 2 de 6' })).toBeTruthy();
  });

  it('stretches only the current dot', () => {
    const { container } = render(<ProgressDots count={4} current={2} />);
    const dots = container.querySelectorAll('.pr-progress-dots__dot');
    expect(dots).toHaveLength(4);
    expect(dots[2]!.className).toContain('pr-progress-dots__dot--current');
    expect(dots[1]!.className).toContain('pr-progress-dots__dot--done');
    expect(dots[3]!.className).not.toContain('pr-progress-dots__dot--current');
  });
});
