import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProgressBar, ProgressRing } from './Progress';

describe('ProgressRing', () => {
  it('announces the rounded percentage by default', () => {
    render(<ProgressRing value={66.6} />);
    expect(screen.getByRole('img', { name: '67%' })).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy();
  });

  it('clamps out-of-range values instead of distorting the ring', () => {
    render(<ProgressRing value={140} />);
    expect(screen.getByRole('img', { name: '100%' })).toBeTruthy();
  });

  it('can drop the centre label while keeping the accessible name', () => {
    render(<ProgressRing value={30} showValue={false} label="Expediente 30%" />);
    expect(screen.getByRole('img', { name: 'Expediente 30%' })).toBeTruthy();
    expect(screen.queryByText('30%')).toBeNull();
  });

  it('strokes the value arc with the brand sweep', () => {
    const { container } = render(<ProgressRing value={50} />);
    const value = container.querySelector('.pr-progress-ring__value');
    expect(value!.getAttribute('stroke')).toMatch(/^url\(#/);
  });
});

describe('ProgressBar', () => {
  it('exposes the value through the progressbar role', () => {
    render(<ProgressBar value={40} label="Documentos" />);
    const bar = screen.getByRole('progressbar', { name: 'Documentos' });
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
  });

  it('turns success on completion by default', () => {
    render(<ProgressBar value={100} />);
    expect(screen.getByRole('progressbar').className).toContain('pr-progress-bar--complete');
  });

  it('keeps the accent when completion has no meaning', () => {
    render(<ProgressBar value={100} completeTone={false} />);
    expect(screen.getByRole('progressbar').className).not.toContain('pr-progress-bar--complete');
  });
});
