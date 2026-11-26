import { useState, type CSSProperties, type ReactNode } from 'react';
import { SegmentedControl } from '../src';

const OPTIONS = [
  { value: 'day', label: 'Día' },
  { value: 'week', label: 'Semana' },
  { value: 'month', label: 'Mes' },
] as const;

function Control({ fullWidth }: { fullWidth?: boolean }) {
  const [value, setValue] = useState<(typeof OPTIONS)[number]['value']>('day');
  return (
    <SegmentedControl
      aria-label="Periodo"
      options={OPTIONS}
      value={value}
      onValueChange={setValue}
      fullWidth={fullWidth}
    />
  );
}

/** One container with the control as its direct child, in the layout under test. */
export function SegmentedIn({
  layout,
  fullWidth,
  width,
}: {
  layout: 'row' | 'column' | 'grid' | 'block';
  fullWidth?: boolean;
  width: number;
}) {
  const base: CSSProperties = { width, boxSizing: 'border-box' };
  const style: CSSProperties =
    layout === 'row'
      ? { ...base, display: 'flex', alignItems: 'center' }
      : layout === 'column'
        ? { ...base, display: 'flex', flexDirection: 'column' }
        : layout === 'grid'
          ? { ...base, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)' }
          : base;
  const sibling: ReactNode =
    layout === 'row' ? <div data-testid="tall" style={{ height: 64, width: 40 }} /> : null;
  return (
    <div data-testid="box" style={style}>
      <Control fullWidth={fullWidth} />
      {sibling}
    </div>
  );
}
