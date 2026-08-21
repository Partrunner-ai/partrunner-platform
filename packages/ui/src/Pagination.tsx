import { useEffect, type ReactNode } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from './Button';

export interface PaginationSummary {
  /** Current one-based page. */
  page: number;
  pageSize: number;
  totalItems: number;
  pageCount: number;
  /** One-based index of the first visible item, or zero when the result is empty. */
  start: number;
  /** One-based index of the last visible item, or zero when the result is empty. */
  end: number;
}

export interface PaginationLabels {
  previous: string;
  next: string;
  summary: (value: PaginationSummary) => ReactNode;
}

export interface PaginationProps {
  /** Current page. Pagination is controlled and pages are one-based. */
  page: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
  /** Blocks both controls. Apps can use this while loading a requested page. */
  disabled?: boolean;
  labels?: Partial<PaginationLabels>;
  className?: string;
  'aria-label'?: string;
}

const DEFAULT_LABELS: PaginationLabels = {
  previous: 'Previous page',
  next: 'Next page',
  summary: ({ start, end, totalItems }) => `${start}–${end} of ${totalItems}`,
};

function positiveInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value > 0;
}

function nonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function validationMessage(page: number, pageSize: number, totalItems: number): string | null {
  if (!positiveInteger(page)) return '`page` must be a positive integer';
  if (!positiveInteger(pageSize)) return '`pageSize` must be a positive integer';
  if (!nonNegativeInteger(totalItems)) return '`totalItems` must be a non-negative integer';

  const pageCount = Math.ceil(totalItems / pageSize);
  if (page > Math.max(1, pageCount)) return '`page` must be within the available page range';
  return null;
}

function fallbackSummary(pageSize: number, totalItems: number): PaginationSummary {
  const safePageSize = positiveInteger(pageSize) ? pageSize : 1;
  const safeTotalItems = nonNegativeInteger(totalItems) ? totalItems : 0;
  const pageCount = Math.ceil(safeTotalItems / safePageSize);

  return {
    page: 1,
    pageSize: safePageSize,
    totalItems: safeTotalItems,
    pageCount,
    start: safeTotalItems === 0 ? 0 : 1,
    end: Math.min(safePageSize, safeTotalItems),
  };
}

function paginationSummary(page: number, pageSize: number, totalItems: number): PaginationSummary {
  const pageCount = Math.ceil(totalItems / pageSize);
  const start = totalItems === 0 ? 0 : (page - 1) * pageSize + 1;

  return {
    page,
    pageSize,
    totalItems,
    pageCount,
    start,
    end: totalItems === 0 ? 0 : Math.min(page * pageSize, totalItems),
  };
}

/**
 * Controlled previous/next pagination for result sets.
 *
 * The caller owns data and page state. This module owns the range math, valid
 * callback bounds, responsive presentation, and accessible announcements.
 */
export function Pagination({
  page,
  pageSize,
  totalItems,
  onPageChange,
  disabled = false,
  labels,
  className,
  'aria-label': ariaLabel = 'Pagination',
}: PaginationProps) {
  const invalidReason = validationMessage(page, pageSize, totalItems);
  const value = invalidReason
    ? fallbackSummary(pageSize, totalItems)
    : paginationSummary(page, pageSize, totalItems);

  useEffect(() => {
    if (!invalidReason) return;
    console.warn(`[Pagination] ${invalidReason}. Navigation is disabled.`);
  }, [invalidReason]);

  const previousLabel = labels?.previous?.trim() || DEFAULT_LABELS.previous;
  const nextLabel = labels?.next?.trim() || DEFAULT_LABELS.next;
  const renderSummary = labels?.summary ?? DEFAULT_LABELS.summary;
  const navigationDisabled = disabled || invalidReason !== null || value.pageCount === 0;
  const canGoPrevious = !navigationDisabled && page > 1;
  const canGoNext = !navigationDisabled && page < value.pageCount;

  return (
    <nav
      aria-label={ariaLabel}
      className={['pr-pagination', className].filter(Boolean).join(' ')}
    >
      <span
        className="pr-pagination__summary"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {renderSummary(value)}
      </span>

      <div className="pr-pagination__controls">
        <Button
          type="button"
          size="sm"
          variant="outline"
          icon={ChevronLeft}
          aria-label={previousLabel}
          disabled={!canGoPrevious}
          onClick={() => {
            if (canGoPrevious) onPageChange(page - 1);
          }}
        >
          <span className="pr-pagination__button-label">{previousLabel}</span>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          icon={ChevronRight}
          iconPosition="right"
          aria-label={nextLabel}
          disabled={!canGoNext}
          onClick={() => {
            if (canGoNext) onPageChange(page + 1);
          }}
        >
          <span className="pr-pagination__button-label">{nextLabel}</span>
        </Button>
      </div>
    </nav>
  );
}
