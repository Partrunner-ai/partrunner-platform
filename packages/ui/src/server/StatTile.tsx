import { renderStatTile, type StatTileMarkupProps } from '../StatTile';

/**
 * `StatTile` props on the server entry. Same as the client props, except that
 * `icon` is an element (`icon={<Truck />}`), not a component (`icon={Truck}`).
 */
export type StatTileProps = StatTileMarkupProps;

/**
 * Server-safe `StatTile`: the same markup and classes as the client tile, as a
 * plain function with no hooks and no ref. Render it from a Server Component.
 */
export function StatTile(props: StatTileProps) {
  return renderStatTile(props);
}
