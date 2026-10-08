// Verbatim port of packages/ui/src/Slot.tsx + Card.tsx (types stripped),
// with NO 'use client' directive, imported directly (no @partrunner-ai/ui
// bundle, no client-boundary crossing) to isolate whether the "use client"
// hoist in dist/index.js is what triggers the drop.
import { Children, cloneElement, forwardRef, isValidElement } from 'react';

function composeRefs(...refs) {
  return (node) => {
    for (const ref of refs) {
      if (typeof ref === 'function') ref(node);
      else if (ref) ref.current = node;
    }
  };
}

function mergeProps(slotProps, childProps) {
  const merged = { ...slotProps };
  for (const key of Object.keys(childProps)) {
    const slotValue = slotProps[key];
    const childValue = childProps[key];
    if (/^on[A-Z]/.test(key)) {
      if (typeof slotValue === 'function' && typeof childValue === 'function') {
        merged[key] = (...args) => {
          childValue(...args);
          slotValue(...args);
        };
      } else {
        merged[key] = childValue ?? slotValue;
      }
    } else if (key === 'className') {
      merged.className = [slotValue, childValue].filter(Boolean).join(' ');
    } else if (key === 'style') {
      merged.style = { ...slotValue, ...childValue };
    } else {
      merged[key] = childValue;
    }
  }
  return merged;
}

export const LocalSlot = forwardRef(function Slot({ children, decorate, ...slotProps }, slotRef) {
  const rest = slotProps;
  const decorateChildren = decorate;
  if (!isValidElement(children)) {
    if (Children.count(children) > 1) {
      throw new Error('asChild expects exactly one React element child.');
    }
    return null;
  }
  const child = children;
  const childRef = child.ref ?? child.props.ref;
  const merged = mergeProps(rest, child.props);
  return cloneElement(child, {
    ...merged,
    ref: slotRef ? composeRefs(slotRef, childRef) : childRef,
    ...(decorateChildren ? { children: decorateChildren(child.props.children) } : null),
  });
});

export const LocalCard = forwardRef(function Card(
  {
    padding = 'md',
    raised = false,
    interactive = false,
    glass = false,
    tone = 'neutral',
    toneBorder = false,
    gradient = false,
    asChild = false,
    shadow = false,
    className,
    ...rest
  },
  ref,
) {
  const classes = [
    'pr-card',
    padding === 'none' ? null : `pr-card--pad-${padding}`,
    raised ? 'pr-card--raised' : null,
    shadow && !raised ? 'pr-card--shadow' : null,
    interactive ? 'pr-card--interactive' : null,
    tone !== 'neutral' ? `pr-card--${tone}` : null,
    toneBorder && tone !== 'neutral' ? 'pr-card--tone-border' : null,
    glass ? 'pr-card--glass' : null,
    gradient && !glass ? 'pr-card--gradient' : null,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  const Comp = asChild ? LocalSlot : 'div';
  return <Comp ref={ref} className={classes} {...rest} />;
});
