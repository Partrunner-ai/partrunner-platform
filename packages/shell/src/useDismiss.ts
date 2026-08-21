import { useEffect, type RefObject } from 'react';

/**
 * Close a popover on outside-click and Escape without a popover dependency.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
  returnFocusRef?: RefObject<HTMLElement | null>,
): void {
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        queueMicrotask(() => returnFocusRef?.current?.focus());
      }
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, open, onClose, returnFocusRef]);
}
