import type { ReactNode } from 'react';

export function joinIds(...values: Array<string | undefined>): string | undefined {
  const ids = values.flatMap((value) => value?.split(/\s+/).filter(Boolean) ?? []);
  return ids.length > 0 ? [...new Set(ids)].join(' ') : undefined;
}

export function isPresent(value: ReactNode): boolean {
  return value !== undefined && value !== null && value !== false;
}
