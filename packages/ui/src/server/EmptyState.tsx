import { renderEmptyState, type EmptyStateMarkupProps } from '../Feedback';
import type { WithoutHandlers } from './props';

/**
 * `EmptyState` props on the server entry. Same as the client props, except that
 * `icon` is an element (`icon={<Inbox />}`), not a component (`icon={Inbox}`),
 * and there are no event handlers (`onClick`, ...).
 */
export type EmptyStateProps = WithoutHandlers<EmptyStateMarkupProps>;

/**
 * Server-safe `EmptyState`: the same markup and classes as the client one, as a
 * plain function with no hooks and no ref. Render it from a Server Component.
 */
export function EmptyState(props: EmptyStateProps) {
  return renderEmptyState(props);
}
