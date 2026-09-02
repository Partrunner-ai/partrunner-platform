'use client';

import { forwardRef, useEffect, useState, type HTMLAttributes } from 'react';
import { toneFromString, type TintTone } from './tone';

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg';

export interface AvatarProps extends HTMLAttributes<HTMLSpanElement> {
  /** The person's name. It is the accessible name and the source of the initials. */
  name: string;
  /** A photo. While it loads, and if it fails, the initials show. */
  src?: string;
  /** 20, 24, 32 or 40px. */
  size?: AvatarSize;
  /** Defaults to a stable tint hashed from `name`. */
  tone?: TintTone;
  /** Hides the avatar from assistive tech when the name is already visible beside it. */
  decorative?: boolean;
  /** Locale for upper-casing the initials. Defaults to the runtime locale. */
  locale?: string;
}

/** First letter of the first two words, upper-cased for the locale. */
export function avatarInitials(name: string, locale?: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean).slice(0, 2);
  return words
    .map((word) => {
      const first = Array.from(word)[0] ?? '';
      return locale ? first.toLocaleUpperCase(locale) : first.toLocaleUpperCase();
    })
    .join('');
}

/**
 * A person by initials, in a stable tint. The root is the named image; the
 * initials are decoration inside it, so a screen reader hears the name, not
 * two disconnected letters.
 */
export const Avatar = forwardRef<HTMLSpanElement, AvatarProps>(function Avatar(
  { name, src, size = 'sm', tone, decorative = false, locale, className, ...rest },
  ref,
) {
  const [imageFailed, setImageFailed] = useState(false);
  useEffect(() => {
    setImageFailed(false);
  }, [src]);
  const resolvedTone = tone ?? toneFromString(name);
  const showImage = Boolean(src) && !imageFailed;

  return (
    <span
      ref={ref}
      {...rest}
      /* The naming contract is the component's, so it lands after the caller's props. */
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? true : undefined}
      data-slot="avatar"
      className={['pr-avatar', `pr-avatar--${resolvedTone}`, `pr-avatar--${size}`, className]
        .filter(Boolean)
        .join(' ')}
    >
      {showImage ? (
        <img
          className="pr-avatar__image"
          src={src}
          alt=""
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="pr-avatar__initials" aria-hidden>
          {avatarInitials(name, locale)}
        </span>
      )}
    </span>
  );
});
