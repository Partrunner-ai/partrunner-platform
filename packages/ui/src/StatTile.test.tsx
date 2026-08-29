import { render } from '@testing-library/react';
import { TrendingUp, Truck } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { StatTile } from './StatTile';

describe('StatTile', () => {
  it('renders label and value', () => {
    const { getByText } = render(<StatTile label="Flotillas" value={42} />);
    expect(getByText('Flotillas')).toBeDefined();
    expect(getByText('42')).toBeDefined();
  });

  it('defaults to the neutral tone class', () => {
    const { container } = render(<StatTile label="Flotillas" value={42} />);
    const root = container.firstElementChild!;
    expect(root.className).toContain('pr-stat-tile--neutral');
    expect(root.className).toContain('pr-stat-tile');
  });

  it('renders the tone modifier for each tone', () => {
    const tones = ['yellow', 'amber', 'blue', 'purple', 'green', 'rose'] as const;
    for (const tone of tones) {
      const { container } = render(<StatTile label="x" value={1} tone={tone} />);
      expect(container.firstElementChild!.className).toContain(`pr-stat-tile--${tone}`);
    }
  });

  it('renders the icon inside the tone chip', () => {
    const { container } = render(<StatTile label="x" value={1} icon={Truck} tone="green" />);
    const chip = container.querySelector('.pr-stat-tile__icon')!;
    expect(chip).not.toBeNull();
    expect(chip.querySelector('svg')).not.toBeNull();
    expect(chip.className).not.toContain('pr-stat-tile__icon--');
  });

  it('hides the icon chip when no icon is given', () => {
    const { container } = render(<StatTile label="x" value={1} />);
    expect(container.querySelector('.pr-stat-tile__icon')).toBeNull();
  });

  it('renders a positive trend with the up modifier and a leading plus', () => {
    const { container, getByText } = render(
      <StatTile label="x" value={1} trendValue={12.5} />,
    );
    const chip = container.querySelector('.pr-stat-tile__trend--up')!;
    expect(chip).not.toBeNull();
    expect(chip.querySelector('svg')).not.toBeNull();
    expect(getByText('+12.5%')).toBeDefined();
  });

  it('renders a negative trend with the down modifier and no plus', () => {
    const { container, getByText } = render(
      <StatTile label="x" value={1} trendValue={-3} />,
    );
    expect(container.querySelector('.pr-stat-tile__trend--down')).not.toBeNull();
    expect(getByText('-3%')).toBeDefined();
  });

  it('hides the whole meta row when trend is null and no footer is given', () => {
    const { container } = render(
      <StatTile label="x" value={1} trendValue={null} />,
    );
    expect(container.querySelector('.pr-stat-tile__meta')).toBeNull();
  });

  it('renders the meta row for a footer alone, without a trend chip', () => {
    const { container, getByText } = render(
      <StatTile label="x" value={1} footer="vs. semana pasada" />,
    );
    expect(container.querySelector('.pr-stat-tile__meta')).not.toBeNull();
    expect(container.querySelector('.pr-stat-tile__trend')).toBeNull();
    expect(getByText('vs. semana pasada')).toBeDefined();
  });

  it('renders the hint line when provided', () => {
    const { getByText } = render(<StatTile label="x" value={1} hint="últimos 30 días" />);
    expect(getByText('últimos 30 días')).toBeDefined();
  });

  it('treats a non-finite trend as absent', () => {
    const { container } = render(
      <StatTile label="x" value={1} trendValue={Number.NaN} />,
    );
    expect(container.querySelector('.pr-stat-tile__trend')).toBeNull();
  });

  it('smoke: renders with an icon and trend together', () => {
    const { container } = render(
      <StatTile label="x" value={1} icon={TrendingUp} trendValue={4} tone="blue" />,
    );
    expect(container.querySelector('.pr-stat-tile__trend--up')).not.toBeNull();
    expect(container.querySelector('.pr-stat-tile__icon')).not.toBeNull();
  });
});
