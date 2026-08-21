import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ValidationSummary } from './ValidationSummary';

const ERRORS = [
  { fieldId: 'route-region', label: 'Región', message: 'Selecciona una región.' },
  { fieldId: 'route-driver', label: 'Operador', message: 'Selecciona un operador.' },
];

describe('ValidationSummary', () => {
  it('renders nothing when there is nothing to fix', () => {
    const { container } = render(<ValidationSummary errors={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('announces one summary and links each error to its field', () => {
    render(<ValidationSummary errors={ERRORS} />);

    const summary = screen.getByRole('alert');
    expect(summary.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('heading', { name: 'Corrige los siguientes campos' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Región: Selecciona una región.' }).getAttribute('href')).toBe(
      '#route-region',
    );
    expect(screen.getByRole('link', { name: 'Operador: Selecciona un operador.' }).getAttribute('href')).toBe(
      '#route-driver',
    );
  });

  it('only takes focus when a form explicitly asks it to', () => {
    const first = render(<ValidationSummary errors={ERRORS} />);
    expect(document.activeElement).not.toBe(screen.getByRole('alert'));
    first.unmount();

    render(<ValidationSummary errors={ERRORS} focusOnMount />);
    expect(document.activeElement).toBe(screen.getByRole('alert'));
  });
});
