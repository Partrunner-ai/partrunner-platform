import {
  forwardRef,
  useRef,
  type ClipboardEvent,
  type HTMLAttributes,
  type KeyboardEvent,
} from 'react';

export interface OtpInputProps
  extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange' | 'defaultValue'> {
  /** Digits collected so far; length ≤ `length`. Controlled. */
  value: string;
  onValueChange: (value: string) => void;
  /** Fires once when the final digit lands. */
  onComplete?: (value: string) => void;
  length?: number;
  disabled?: boolean;
  invalid?: boolean;
  /** Accessible name of the group. */
  label?: string;
  /** Accessible name per box; receives 1-based position. */
  digitLabel?: (digit: number, length: number) => string;
}

/**
 * One box per digit, because a code arrives as digits: typing auto-advances,
 * Backspace walks back, and pasting the whole code from SMS/mail distributes it
 * — the three behaviours every hand-rolled OTP field forgets at least one of.
 *
 * `autocomplete="one-time-code"` sits on the first box so the platform can
 * offer the SMS code; the paste handler takes it from there.
 */
export const OtpInput = forwardRef<HTMLDivElement, OtpInputProps>(function OtpInput(
  {
    value,
    onValueChange,
    onComplete,
    length = 6,
    disabled = false,
    invalid = false,
    label = 'Código de verificación',
    digitLabel = (digit, total) => `Dígito ${digit} de ${total}`,
    className,
    ...rest
  },
  ref,
) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);

  const commit = (next: string) => {
    const digits = next.replace(/\D/g, '').slice(0, length);
    onValueChange(digits);
    if (digits.length === length && digits !== value) onComplete?.(digits);
  };

  /**
   * The code is contiguous and the caret can never outrun it: writing into a
   * box past the collected digits clamps to the append position, so the box
   * that paints the digit is always the box the focus logic reasons about.
   */
  const handleInput = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1);
    if (!digit) return;
    const at = Math.min(index, value.length);
    commit(value.slice(0, at) + digit + value.slice(at + 1));
    boxes.current[Math.min(at + 1, length - 1)]?.focus();
  };

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (index < value.length) {
        // A digit under the caret: delete it in place.
        commit(value.slice(0, index) + value.slice(index + 1));
      } else if (value.length > 0) {
        // An empty box, however far ahead: one keypress takes the last
        // collected digit and lands the caret on its box — never a silent
        // no-op that only walks focus.
        commit(value.slice(0, -1));
        boxes.current[value.length - 1]?.focus();
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      boxes.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault();
      boxes.current[index + 1]?.focus();
    }
  };

  const handlePaste = (index: number, event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const digits = event.clipboardData.getData('text').replace(/\D/g, '');
    if (!digits) return;
    // Overwrite from the caret and keep the tail — a short paste over a full
    // code corrects digits instead of discarding the rest.
    const at = Math.min(index, value.length);
    const next = (value.slice(0, at) + digits + value.slice(at + digits.length)).slice(0, length);
    commit(next);
    boxes.current[Math.min(next.length, length - 1)]?.focus();
  };

  return (
    <div
      ref={ref}
      role="group"
      aria-label={label}
      className={['pr-otp', invalid ? 'pr-otp--invalid' : null, className]
        .filter(Boolean)
        .join(' ')}
      {...rest}
    >
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(node) => {
            boxes.current[index] = node;
          }}
          className="pr-otp__box"
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          value={value[index] ?? ''}
          disabled={disabled}
          aria-label={digitLabel(index + 1, length)}
          aria-invalid={invalid || undefined}
          onChange={(event) => handleInput(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={(event) => handlePaste(index, event)}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
});
