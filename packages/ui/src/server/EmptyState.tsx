import { renderEmptyState, type EmptyStateMarkupProps } from '../Feedback';

/**
 * `EmptyState` props on the server entry. Same as the client props, except that
 * `icon` is an element (`icon={<Inbox />}`), not a component (`icon={Inbox}`).
 */
export type EmptyStateProps = EmptyStateMarkupProps;

/**
 * Server-safe `EmptyState`: the same markup and classes as the client one, as a
 * plain function with no hooks and no ref. Render it from a Server Component.
 */
export function EmptyState(props: EmptyStateProps) {
  return renderEmptyState(props);
}
