import { cloneElement, isValidElement, type ReactNode } from 'react';

/**
 * Gives an icon element the props a component would have set on it, unless the
 * element sets them itself.
 *
 * The server entry takes icons as elements (`icon={<Truck />}`), because a
 * component function cannot cross from a Server Component into a Client
 * Component. The client entry takes the component (`icon={Truck}`) and renders
 * it with these same props. Both paths end here, so `<Truck />` and `Truck`
 * produce the same markup.
 *
 * Only a component element (a lucide icon, an app icon) gets the defaults. A
 * raw `<svg>` or a string is the caller's own markup and stays as it is.
 */
export function withIconDefaults(
  icon: ReactNode,
  defaults: Record<string, unknown>,
): ReactNode {
  if (!isValidElement(icon) || typeof icon.type === 'string') return icon;
  const own = (icon.props ?? {}) as Record<string, unknown>;
  const missing: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(defaults)) {
    if (own[key] === undefined) missing[key] = value;
  }
  return Object.keys(missing).length > 0 ? cloneElement(icon, missing) : icon;
}
