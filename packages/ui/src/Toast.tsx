import { type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, Loader2, X, XCircle } from 'lucide-react';
import { Toaster as SonnerToaster, toast as sonnerToast, type ExternalToast } from 'sonner';

/**
 * Toasts: the result of an action the person just did.
 *
 * The package wraps `sonner` and owns every visual and timing decision, so an app
 * imports `Toaster` and `toast` from here and never from `sonner`. One app mounts
 * one `Toaster`; every `toast.*` call anywhere in that app shows in it.
 *
 * For a state that stays until somebody fixes it, use `Notice`. For a field, use
 * `FormField`. Before an action that cannot be undone, use `ConfirmDialog`.
 */

export type ToastId = string | number;
export type ToastTone = 'success' | 'info' | 'warning' | 'error';

export interface ToastAction {
  /** A verb for what the button does again or undoes: «Reintentar», «Deshacer». */
  label: ReactNode;
  /** Runs, then the toast closes. */
  onClick: () => void;
}

export interface ToastOptions {
  /** One short line under the title. The title says what happened; this says what follows. */
  description?: ReactNode;
  /** At most one action. The close button is always there, so there is no «Cancelar». */
  action?: ToastAction;
  /**
   * Gives the toast a stable identity. A second call with the same id replaces the
   * first in place, which is how a «Guardando…» toast becomes «Guardado».
   */
  id?: ToastId;
  /**
   * Milliseconds before it closes. Leave it out: the tone sets it (success and info
   * 5 s, warning 8 s, error stays until the person closes it). `Infinity` keeps it.
   */
  duration?: number;
  /** Called when the toast closes for any reason. */
  onClose?: () => void;
}

export interface ToastPromiseMessages<T> {
  loading: ReactNode;
  success: ReactNode | ((data: T) => ReactNode);
  error: ReactNode | ((error: unknown) => ReactNode);
  /** Shown under the error title, for example what the person can do next. */
  errorDescription?: ReactNode;
  /** Shown on the error toast, usually «Reintentar». */
  errorAction?: ToastAction;
}

/** @internal Package timing, read by the tests. Not exported from the package entry. */
export const TOAST_DURATION: Record<ToastTone, number> = {
  success: 5000,
  info: 5000,
  warning: 8000,
  error: Infinity,
};

/** No more than three at once; a fourth waits until one closes. */
export const TOAST_VISIBLE_LIMIT = 3;

function toSonner(tone: ToastTone | 'loading', options: ToastOptions = {}): ExternalToast {
  const { description, action, id, duration, onClose } = options;
  return {
    id,
    description,
    action: action ? { label: action.label, onClick: () => action.onClick() } : undefined,
    duration: tone === 'loading' ? Infinity : (duration ?? TOAST_DURATION[tone]),
    onDismiss: onClose ? () => onClose() : undefined,
    onAutoClose: onClose ? () => onClose() : undefined,
  };
}

/**
 * The toaster region is polite: success, info and warning wait for the screen
 * reader to finish. An error must interrupt, so its title is an `alert` of its own.
 */
function title(tone: ToastTone | 'loading', message: ReactNode): ReactNode {
  if (tone !== 'error') return message;
  return (
    <span role="alert" aria-atomic="true">
      {message}
    </span>
  );
}

/** A static map, not `sonnerToast[tone]`: the package artifact audit rejects computed calls. */
const SHOW_TONE: Record<ToastTone, (message: ReactNode, data: ExternalToast) => ToastId> = {
  success: (message, data) => sonnerToast.success(message, data),
  info: (message, data) => sonnerToast.info(message, data),
  warning: (message, data) => sonnerToast.warning(message, data),
  error: (message, data) => sonnerToast.error(message, data),
};

function show(tone: ToastTone, message: ReactNode, options?: ToastOptions): ToastId {
  const display = SHOW_TONE[tone];
  return display(title(tone, message), toSonner(tone, options));
}

function resolve<V>(value: ReactNode | ((input: V) => ReactNode), input: V): ReactNode {
  return typeof value === 'function' ? (value as (input: V) => ReactNode)(input) : value;
}

export const toast = {
  /** The action worked. Closes after 5 s. */
  success: (message: ReactNode, options?: ToastOptions): ToastId => show('success', message, options),
  /** A neutral fact about the action, for example «Exportación en cola». Closes after 5 s. */
  info: (message: ReactNode, options?: ToastOptions): ToastId => show('info', message, options),
  /** The action worked in part. Closes after 8 s. */
  warning: (message: ReactNode, options?: ToastOptions): ToastId => show('warning', message, options),
  /** The action failed. Stays until the person closes it; give a «Reintentar» action when one helps. */
  error: (message: ReactNode, options?: ToastOptions): ToastId => show('error', message, options),
  /**
   * Work in progress that the person waits for. It stays until you replace it: call
   * `toast.success`/`toast.error` with the same `id`, or `toast.dismiss(id)`.
   */
  loading: (message: ReactNode, options?: Omit<ToastOptions, 'duration' | 'action'>): ToastId =>
    sonnerToast.loading(message, toSonner('loading', options)),
  /**
   * Shows `loading`, then replaces it with `success` or `error` when the promise
   * settles. Returns the promise unchanged, so the caller can still await it.
   */
  promise: <T,>(promise: Promise<T> | (() => Promise<T>), messages: ToastPromiseMessages<T>): Promise<T> => {
    const id = sonnerToast.loading(messages.loading, toSonner('loading'));
    const running = typeof promise === 'function' ? promise() : promise;
    running.then(
      (data) => {
        show('success', resolve(messages.success, data), { id });
      },
      (error: unknown) => {
        show('error', resolve(messages.error, error), {
          id,
          description: messages.errorDescription,
          action: messages.errorAction,
        });
      },
    );
    return running;
  },
  /** Closes one toast, or every toast when called without an id. */
  dismiss: (id?: ToastId): void => {
    sonnerToast.dismiss(id);
  },
};

export interface ToasterProps {
  /** Accessible name of the region. */
  label?: string;
  /** Accessible name of the close button on each toast. */
  closeLabel?: string;
}

const ICON_SIZE = 18;

const ICONS = {
  success: <CheckCircle2 size={ICON_SIZE} aria-hidden />,
  info: <Info size={ICON_SIZE} aria-hidden />,
  warning: <AlertTriangle size={ICON_SIZE} aria-hidden />,
  error: <XCircle size={ICON_SIZE} aria-hidden />,
  loading: <Loader2 className="pr-toast__spinner" size={ICON_SIZE} aria-hidden />,
  close: <X size={16} aria-hidden />,
};

const CLASS_NAMES = {
  toast: 'pr-toast',
  content: 'pr-toast__content',
  title: 'pr-toast__title',
  description: 'pr-toast__description',
  icon: 'pr-toast__icon',
  loader: 'pr-toast__loader',
  closeButton: 'pr-toast__close',
  actionButton: 'pr-toast__action pr-btn pr-btn--secondary pr-btn--sm',
  cancelButton: 'pr-toast__action pr-btn pr-btn--ghost pr-btn--sm',
  success: 'pr-toast--success',
  info: 'pr-toast--info',
  warning: 'pr-toast--warning',
  error: 'pr-toast--error',
  loading: 'pr-toast--loading',
  default: 'pr-toast--info',
};

/**
 * Mount once, near the root of the app (in Next, inside the root layout's `<body>`).
 * Position, width, timing and look are fixed by the package on purpose: the same
 * result looks and behaves the same in every app.
 */
export function Toaster({ label = 'Notificaciones', closeLabel = 'Cerrar notificación' }: ToasterProps) {
  return (
    <SonnerToaster
      className="pr-toaster"
      position="bottom-right"
      expand
      visibleToasts={TOAST_VISIBLE_LIMIT}
      duration={TOAST_DURATION.info}
      gap={8}
      offset={24}
      mobileOffset={16}
      closeButton
      containerAriaLabel={label}
      icons={ICONS}
      toastOptions={{ unstyled: true, classNames: CLASS_NAMES, closeButtonAriaLabel: closeLabel }}
    />
  );
}
