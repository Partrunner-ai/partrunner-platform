import { useCallback, useId, type ReactNode, type RefObject } from 'react';
import { X } from 'lucide-react';
import { DialogLayer } from './DialogLayer';

export type DialogSize = 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl';

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  /** Rendered under the title and wired to `aria-describedby`. */
  description?: ReactNode;
  size?: DialogSize;
  /** Pinned to the bottom, outside the scrolling body. */
  footer?: ReactNode;
  /** Escape and backdrop clicks stop closing it — for a destructive confirm. */
  dismissible?: boolean;
  /**
   * Keep Escape and the close button, but ignore clicks on the backdrop. For a
   * long form where a stray click outside would throw away typing.
   *
   * `dismissible={false}` is the stricter thing: it removes every exit but your
   * own footer button.
   */
  closeOnBackdrop?: boolean;
  /** Drop the header's close button while keeping Escape and the backdrop. */
  hideClose?: boolean;
  closeLabel?: string;
  /** Replaces the whole title/close row. The dialog still owns the labelling. */
  headerSlot?: ReactNode;
  /** Extra classes on the scrolling body, for a form that manages its own padding. */
  bodyClassName?: string;
  /**
   * Focus this on open instead of the first control in the body. Point it at the
   * title when landing on a field would be wrong — a destructive confirm, say.
   */
  initialFocusRef?: RefObject<HTMLElement | null>;
  className?: string;
  children?: ReactNode;
}

/**
 * Modal dialog.
 *
 * The behaviour — portal, layer stack, focus trap, background `inert`, scroll
 * lock — lives in `DialogLayer`; this owns the chrome. See that file for why a
 * stack is needed rather than per-component effects.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  size = 'md',
  closeOnBackdrop = true,
  hideClose = false,
  headerSlot,
  bodyClassName,
  footer,
  dismissible = true,
  closeLabel = 'Cerrar',
  initialFocusRef,
  className,
  children,
}: DialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  // First control in the BODY, not first in DOM order — that would be the close
  // button in the header, so a keyboard user's first Enter would dismiss the
  // dialog. Falls back to the panel when the body has no controls.
  const resolveInitialFocus = useCallback((panel: HTMLElement) => {
    const body = panel.querySelector<HTMLElement>('.pr-dialog__body');
    return body?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    ) ?? null;
  }, []);

  return (
    <DialogLayer
      open={open}
      onClose={onClose}
      dismissible={dismissible}
      closeOnBackdrop={closeOnBackdrop}
      ariaLabelledBy={titleId}
      ariaDescribedBy={description ? descriptionId : undefined}
      initialFocusRef={initialFocusRef}
      resolveInitialFocus={initialFocusRef ? undefined : resolveInitialFocus}
      rootClassName="pr-dialog"
      backdropClassName="pr-dialog__backdrop"
      panelClassName={`pr-dialog__panel pr-dialog__panel--${size}${className ? ` ${className}` : ''}`}
    >
      {headerSlot ? (
        /* A custom header still has to carry the accessible name, so the title is
           rendered for screen readers even when it is not shown. */
        <header className="pr-dialog__header pr-dialog__header--custom">
          <span id={titleId} className="pr-visually-hidden">
            {title}
          </span>
          {headerSlot}
        </header>
      ) : (
        <header className="pr-dialog__header">
          <div className="pr-dialog__heading">
            <h2 id={titleId} className="pr-dialog__title">
              {title}
            </h2>
            {description && (
              <p id={descriptionId} className="pr-dialog__description">
                {description}
              </p>
            )}
          </div>
          {dismissible && !hideClose && (
            <button
              type="button"
              className="pr-dialog__close"
              onClick={onClose}
              aria-label={closeLabel}
            >
              <X size={18} aria-hidden />
            </button>
          )}
        </header>
      )}

      <div className={['pr-dialog__body', bodyClassName].filter(Boolean).join(' ')}>
        {children}
      </div>

      {footer && <footer className="pr-dialog__footer">{footer}</footer>}
    </DialogLayer>
  );
}
