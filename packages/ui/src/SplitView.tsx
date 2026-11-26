import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Button } from './Button';

export type SplitViewListWidth = 'sm' | 'md' | 'lg';
export type SplitViewHeight = 'fill' | 'auto';

export interface SplitViewProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  /** The master list, usually an `ItemList`. It scrolls on its own in `fill` height. */
  list: ReactNode;
  /** Fixed above the scrolling list, such as a `SearchField`. */
  listHeader?: ReactNode;
  /** The open record, or an `EmptyState` when nothing is selected. */
  detail: ReactNode;
  /** List pane width on wide screens: `sm` 280px, `md` 360px, `lg` 440px. Defaults to `md`. */
  listWidth?: SplitViewListWidth;
  /** Narrow screens show one pane. `true` shows the detail in place of the list. */
  detailOpen?: boolean;
  /** Narrow screens: shows a back button above the detail when given. */
  onBack?: () => void;
  backLabel?: string;
  listLabel?: string;
  detailLabel?: string;
  /**
   * `fill` (default): the frame has a fixed height and each pane scrolls on its own.
   * The default is `min(72vh, 900px)`. To size it from the page, pass `style={{ height }}`
   * or a class, or put it in a flex column parent: the frame also has `flex: 1 1 auto`
   * and `min-height: 0`. `auto`: the frame grows with its content and the page scrolls.
   */
  height?: SplitViewHeight;
}

/**
 * Master-detail layout: a list pane on the start side and a detail pane beside it,
 * inside one bordered frame. From 900px wide both panes show. Below, one pane
 * shows at a time, chosen by `detailOpen`. CSS only; no measurement.
 */
export const SplitView = forwardRef<HTMLDivElement, SplitViewProps>(function SplitView(
  {
    list,
    listHeader,
    detail,
    listWidth = 'md',
    detailOpen = false,
    onBack,
    backLabel = 'Volver a la lista',
    listLabel = 'Lista',
    detailLabel = 'Detalle',
    height = 'fill',
    className,
    ...rest
  },
  ref,
) {
  return (
    <div
      ref={ref}
      {...rest}
      data-slot="split-view"
      data-detail-open={detailOpen ? '' : undefined}
      className={[
        'pr-split-view',
        `pr-split-view--list-${listWidth}`,
        `pr-split-view--${height}`,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <section aria-label={listLabel} className="pr-split-view__list">
        {listHeader != null ? <div className="pr-split-view__list-header">{listHeader}</div> : null}
        <div className="pr-split-view__list-scroll">{list}</div>
      </section>
      <section aria-label={detailLabel} className="pr-split-view__detail">
        {onBack ? (
          <div className="pr-split-view__back">
            <Button variant="ghost" size="sm" icon={ChevronLeft} onClick={onBack}>
              {backLabel}
            </Button>
          </div>
        ) : null}
        <div className="pr-split-view__detail-scroll">{detail}</div>
      </section>
    </div>
  );
});
