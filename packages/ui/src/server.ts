/**
 * Server-safe subset: components with no client-only hooks, published
 * without the `"use client"` directive so a Server Component can render
 * them directly instead of crossing Next's RSC/Flight client-component
 * boundary.
 *
 * Why this exists: the main entry (`.`) forces `"use client"` onto the
 * whole bundle (see tsup.config.ts) because some components in it do need
 * client hooks. That is correct for those components, but it also drags
 * hook-free ones — `Card` among them — through the client boundary for no
 * reason. A confirmed Next.js RSC/Flight bug can silently drop one
 * `asChild` (`Slot`-rendered) instance from a list of Client Components;
 * it does not reproduce when the same component renders as a plain Server
 * Component. Import from here instead of the main entry when a list of
 * `Card asChild` items renders inside a Server Component. PMO 143c1bdd.
 *
 * Keep this file hook-free. Anything added here must not import `useState`,
 * `useEffect`, or any other client-only API — that would silently break at
 * runtime for a consumer that renders it as a Server Component.
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
  type CardTone,
  type CardProps,
  type CardTitleProps,
} from './Card';
export { Slot, type SlotAllProps, type SlotProps } from './Slot';
