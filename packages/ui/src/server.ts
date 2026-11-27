/**
 * `@partrunner-ai/ui/server`: the parts a Server Component can render directly.
 *
 * The main entry is one `"use client"` bundle (see tsup.config.ts). From a
 * Server Component every part of it is a Client Component, so its props must
 * cross the RSC boundary. Two things fail there:
 *
 *  - a function prop, such as `icon={Truck}` on `StatTile` or `EmptyState`:
 *    React cannot serialise a component function;
 *  - `Card asChild` in a list: Next can drop one `Slot`-rendered item on the
 *    Flight path (#34, PMO 143c1bdd).
 *
 * This entry ships without the directive. Its parts render on the server, so
 * nothing crosses the boundary. They use the same markup and classes as the
 * main entry, so they look the same.
 *
 * Rules for this file:
 *  - No hooks, no context, no browser API anywhere in the import graph. The
 *    server-entry test scans the built graph: no "use client" module, and
 *    from `react` only named imports that its `react-server` build exports
 *    (no namespace or default import). The package artifact check runs the
 *    same scan against that build's real export list, under
 *    `node --conditions=react-server`. Neither renders the bundle there:
 *    lucide-react 1.x creates a context when it loads, which a bundler keeps
 *    on the client and plain Node does not.
 *  - `forwardRef`, `cloneElement` and `Children` are allowed: they are part of
 *    React's server API.
 *  - An icon is an element (`icon={<Truck />}`), never a component.
 */
export {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type CardContentProps,
  type CardDescriptionProps,
  type CardHeaderProps,
  type CardPadding,
  type CardProps,
  type CardTitleProps,
  type CardTone,
} from './Card';
export { Slot, type SlotAllProps, type SlotProps } from './Slot';
export { StatTile, type StatTileProps } from './server/StatTile';
export { type StatTone } from './StatTile';
export {
  StatTileGrid,
  type StatTileGridColumns,
  type StatTileGridProps,
} from './StatTileGrid';
export { EmptyState, type EmptyStateProps } from './server/EmptyState';
