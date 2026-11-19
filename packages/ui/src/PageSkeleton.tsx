import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { Skeleton } from './Skeleton';

export type PageSkeletonVariant = 'table' | 'dashboard' | 'detail' | 'cards' | 'chat';

export interface PageSkeletonProps extends HTMLAttributes<HTMLDivElement> {
  /** The page shape to imitate. Default `table`. */
  variant?: PageSkeletonVariant;
  /** Announced once to assistive technology. Default "Cargando…". */
  label?: string;
  /** `table` only: body rows. Default 8. */
  rows?: number;
  /** `table` only: columns. Default 5. */
  columns?: number;
}

/** Varied widths so a table does not read as a grid of identical bars. */
const CELL_WIDTHS = [72, 54, 86, 44, 64, 78, 50, 68];

function Bar({ w, h = 14, shape = 'text' }: { w: number | string; h?: number; shape?: 'text' | 'block' }) {
  return <Skeleton shape={shape} width={w} height={h} />;
}

function PageHead() {
  return (
    <div className="pr-page-skeleton__head">
      <Bar w={220} h={26} shape="block" />
      <Bar w={340} h={14} />
    </div>
  );
}

function TableLayout({ rows, columns }: { rows: number; columns: number }) {
  return (
    <>
      <PageHead />
      <div className="pr-page-skeleton__toolbar">
        <Skeleton width={260} height={36} className="pr-page-skeleton__field" />
        <Skeleton width={96} height={32} className="pr-page-skeleton__pill" />
        <Skeleton width={112} height={32} className="pr-page-skeleton__pill" />
        <span className="pr-page-skeleton__spacer" />
        <Skeleton width={120} height={36} className="pr-page-skeleton__field" />
      </div>
      <div className="pr-page-skeleton__panel">
        <div className="pr-page-skeleton__row pr-page-skeleton__row--head">
          {Array.from({ length: columns }, (_, c) => (
            <Bar key={c} w={`${40 + ((c * 13) % 30)}%`} h={11} />
          ))}
        </div>
        {Array.from({ length: rows }, (_, r) => (
          <div key={r} className="pr-page-skeleton__row">
            {Array.from({ length: columns }, (_, c) => (
              <Bar key={c} w={`${CELL_WIDTHS[(r * 3 + c * 5) % CELL_WIDTHS.length]}%`} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

function DashboardLayout() {
  return (
    <>
      <PageHead />
      <div className="pr-page-skeleton__kpis">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="pr-page-skeleton__panel pr-page-skeleton__kpi">
            <Bar w="45%" h={11} />
            <Bar w="60%" h={28} shape="block" />
            <Bar w="35%" h={11} />
          </div>
        ))}
      </div>
      <div className="pr-page-skeleton__split">
        <div className="pr-page-skeleton__panel pr-page-skeleton__chart">
          <Bar w={160} h={16} />
          <Skeleton className="pr-page-skeleton__chart-area" />
        </div>
        <div className="pr-page-skeleton__panel pr-page-skeleton__list">
          <Bar w={120} h={16} />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="pr-page-skeleton__item">
              <Skeleton shape="circle" width={28} height={28} />
              <div className="pr-page-skeleton__item-text">
                <Bar w={`${70 - i * 6}%`} />
                <Bar w="40%" h={11} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function DetailLayout() {
  return (
    <>
      <Bar w={84} h={14} />
      <div className="pr-page-skeleton__head">
        <Bar w={280} h={28} shape="block" />
        <div className="pr-page-skeleton__meta">
          <Bar w={72} h={22} shape="block" />
          <Bar w={120} h={12} />
          <Bar w={96} h={12} />
        </div>
      </div>
      <div className="pr-page-skeleton__split pr-page-skeleton__split--detail">
        <div className="pr-page-skeleton__panel pr-page-skeleton__card">
          <Bar w={140} h={16} />
          {[96, 100, 88, 94, 60].map((w, i) => (
            <Bar key={i} w={`${w}%`} />
          ))}
          <div className="pr-page-skeleton__gap" />
          <Bar w={120} h={16} />
          {[100, 82, 90, 48].map((w, i) => (
            <Bar key={i} w={`${w}%`} />
          ))}
        </div>
        <div className="pr-page-skeleton__panel pr-page-skeleton__card">
          <Bar w={100} h={16} />
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="pr-page-skeleton__kv">
              <Bar w={72} h={11} />
              <Bar w={`${60 - i * 5}%`} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function CardsLayout() {
  return (
    <>
      <PageHead />
      <div className="pr-page-skeleton__grid">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="pr-page-skeleton__panel pr-page-skeleton__card">
            <Bar w="55%" h={18} />
            <Bar w="92%" />
            <Bar w="68%" />
            <div className="pr-page-skeleton__footer">
              <Bar w={64} h={22} shape="block" />
              <Bar w={80} h={12} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ChatLayout() {
  const bubbles: Array<['in' | 'out', number]> = [
    ['in', 52],
    ['out', 38],
    ['in', 64],
    ['out', 44],
  ];
  return (
    <div className="pr-page-skeleton__chat">
      <div className="pr-page-skeleton__panel pr-page-skeleton__convs">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="pr-page-skeleton__item">
            <Skeleton shape="circle" width={36} height={36} />
            <div className="pr-page-skeleton__item-text">
              <Bar w={`${68 - (i % 3) * 10}%`} />
              <Bar w={`${88 - (i % 4) * 8}%`} h={11} />
            </div>
          </div>
        ))}
      </div>
      <div className="pr-page-skeleton__panel pr-page-skeleton__pane">
        <div className="pr-page-skeleton__item">
          <Skeleton shape="circle" width={36} height={36} />
          <Bar w={160} h={16} />
        </div>
        <div className="pr-page-skeleton__messages">
          {bubbles.map(([side, w], i) => (
            <div key={i} className="pr-page-skeleton__bubble" data-side={side} style={{ width: `${w}%` }}>
              <Bar w="90%" />
              <Bar w="55%" />
            </div>
          ))}
        </div>
        <Skeleton height={44} className="pr-page-skeleton__field" />
      </div>
    </div>
  );
}

/**
 * A full-page loading placeholder that imitates the shape of the real page, so
 * the screen does not jump when data arrives.
 *
 * Built on {@link Skeleton}. It is one busy status region with a single
 * announcement; every bar inside stays hidden from assistive technology. It
 * carries no outer page padding: place it in the app content area (or inside
 * `Page`). It fades in after a short delay so a fast load never flashes it, and
 * all motion stops under `prefers-reduced-motion`.
 */
export const PageSkeleton = forwardRef<HTMLDivElement, PageSkeletonProps>(function PageSkeleton(
  { variant = 'table', label = 'Cargando…', rows = 8, columns = 5, className, ...rest },
  ref,
) {
  let layout: ReactNode;
  switch (variant) {
    case 'dashboard':
      layout = <DashboardLayout />;
      break;
    case 'detail':
      layout = <DetailLayout />;
      break;
    case 'cards':
      layout = <CardsLayout />;
      break;
    case 'chat':
      layout = <ChatLayout />;
      break;
    default:
      layout = <TableLayout rows={rows} columns={columns} />;
  }
  return (
    <div
      ref={ref}
      role="status"
      aria-busy="true"
      data-pr-loading=""
      {...rest}
      data-slot="page-skeleton"
      data-variant={variant}
      className={['pr-page-skeleton', className].filter(Boolean).join(' ')}
    >
      <span className="pr-visually-hidden">{label}</span>
      <div className="pr-page-skeleton__body" aria-hidden>
        {layout}
      </div>
    </div>
  );
});
