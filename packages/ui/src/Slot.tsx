import {
  Children,
  cloneElement,
  forwardRef,
  isValidElement,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
  type Ref,
} from 'react';

/**
 * Minimal `asChild` implementation.
 *
 * Deliberately not a dependency on radix-ui. The feature is "merge my props
 * onto the one child you were given"; pulling a package in for it would make
 * seven lockfiles heavier to save writing this once.
 *
 * Merge rules, which are the parts people get wrong:
 *  - event handlers COMPOSE, child first, so a consumer's onClick still runs;
 *  - `className` concatenates rather than one clobbering the other;
 *  - `style` merges with the child winning;
 *  - every other prop lets the CHILD win, because it is the more specific
 *    intent — a `<Link href>` must not be overwritten by ours.
 */
type AnyProps = Record<string, unknown>;

function composeRefs<T>(...refs: Array<Ref<T> | undefined>) {
  return (node: T) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref) (ref as { current: T | null }).current = node;
    }
  };
}

function mergeProps(slotProps: AnyProps, childProps: AnyProps): AnyProps {
  const merged: AnyProps = { ...slotProps };

  for (const key of Object.keys(childProps)) {
    const slotValue = slotProps[key];
    const childValue = childProps[key];

    if (/^on[A-Z]/.test(key)) {
      if (typeof slotValue === 'function' && typeof childValue === 'function') {
        merged[key] = (...args: unknown[]) => {
          (childValue as (...a: unknown[]) => void)(...args);
          (slotValue as (...a: unknown[]) => void)(...args);
        };
      } else {
        merged[key] = childValue ?? slotValue;
      }
    } else if (key === 'className') {
      merged.className = [slotValue, childValue].filter(Boolean).join(' ');
    } else if (key === 'style') {
      merged.style = { ...(slotValue as CSSProperties), ...(childValue as CSSProperties) };
    } else {
      merged[key] = childValue;
    }
  }

  return merged;
}

export interface SlotProps {
  children?: React.ReactNode;
  /**
   * Wrap the child's own children — the escape hatch for decorations that must
   * live INSIDE the slotted element. A button with an icon rendered `asChild`
   * needs `<a class="pr-btn"><Icon/>Text</a>`, not an icon next to the anchor.
   */
  decorate?: (childChildren: React.ReactNode) => React.ReactNode;
}

/**
 * Extra props are forwarded verbatim to the child. Expressed as an intersection
 * rather than an index signature on the interface, which would widen `decorate`
 * to `unknown` and make it uncallable.
 */
export type SlotAllProps = SlotProps & Record<string, unknown>;

/**
 * `forwardRef`, not a plain function component: the peer range still includes
 * React 18, where `ref` is not a regular prop and would be dropped silently.
 */
export const Slot = forwardRef<unknown, SlotAllProps>(function Slot(
  { children, decorate, ...slotProps },
  slotRef,
) {
  const rest = slotProps as AnyProps;
  // The Record<string, unknown> half of the props type widens this, so pin it
  // back to the signature the interface declares.
  const decorateChildren = decorate as SlotProps['decorate'];

  if (!isValidElement(children)) {
    // One child, or nothing to graft onto. Failing loudly here beats rendering
    // a button that silently lost its props.
    if (Children.count(children) > 1) {
      throw new Error('asChild expects exactly one React element child.');
    }
    return null;
  }

  const child = children as ReactElement<AnyProps & { ref?: Ref<unknown> }>;
  const childRef = (child as { ref?: Ref<unknown> }).ref ?? child.props.ref;

  const merged = mergeProps(rest, child.props);

  return cloneElement(child, {
    ...merged,
    ref: slotRef ? composeRefs(slotRef as Ref<unknown>, childRef) : childRef,
    ...(decorateChildren ? { children: decorateChildren(child.props.children as ReactNode) } : null),
  } as AnyProps);
});
