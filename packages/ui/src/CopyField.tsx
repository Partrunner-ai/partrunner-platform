import { forwardRef, useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { Check, Copy } from 'lucide-react';

export interface CopyFieldProps extends HTMLAttributes<HTMLDivElement> {
  /** The text that gets copied — shown verbatim in the field. */
  value: string;
  /** Accessible name of the copy control. Stable — the confirmation is announced
   * through the live region instead of renaming a focused button. */
  copyLabel?: string;
  /** Announced once the value lands on the clipboard. */
  copiedLabel?: string;
  /** Announced when clipboard access is unavailable and the text was selected instead. */
  fallbackLabel?: string;
  /** How long the confirmation shows, in ms. */
  resetAfter?: number;
}

/**
 * A read-only value with its copy affordance attached — invite links, API keys,
 * tracking IDs. The confirmation is announced through a live region because the
 * icon swap alone is invisible to assistive tech.
 *
 * Clipboard access needs a secure context; when it is unavailable the control
 * falls back to selecting the text so the user can copy by hand.
 */
export const CopyField = forwardRef<HTMLDivElement, CopyFieldProps>(function CopyField(
  {
    value,
    copyLabel = 'Copiar',
    copiedLabel = 'Copiado',
    fallbackLabel = 'Texto seleccionado; copia manualmente',
    resetAfter = 1500,
    className,
    ...rest
  },
  ref,
) {
  const [copied, setCopied] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const valueRef = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // A confirmation is about ONE value. When the value changes underneath it —
  // a regenerated invite link, a re-rendered list — the checkmark would be
  // claiming the clipboard holds something it no longer does.
  useEffect(() => {
    clearTimeout(timer.current);
    setCopied(false);
    setAnnouncement('');
  }, [value]);

  useEffect(() => () => clearTimeout(timer.current), []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setAnnouncement(copiedLabel);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        setCopied(false);
        setAnnouncement('');
      }, resetAfter);
    } catch {
      const node = valueRef.current;
      if (node) {
        const range = document.createRange();
        range.selectNodeContents(node);
        const selection = window.getSelection();
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      // Without this, a screen-reader user who pressed "Copiar" gets silence.
      setAnnouncement(fallbackLabel);
    }
  };

  return (
    <div ref={ref} className={['pr-copy-field', className].filter(Boolean).join(' ')} {...rest}>
      <span ref={valueRef} className="pr-copy-field__value" title={value}>
        {value}
      </span>
      <button
        type="button"
        className="pr-copy-field__button"
        onClick={handleCopy}
        aria-label={copyLabel}
      >
        {copied ? <Check size={15} aria-hidden /> : <Copy size={15} aria-hidden />}
      </button>
      <span className="pr-visually-hidden" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
});
