/**
 * Proves at compile time that the SDK-free options fit the real Sentry SDK.
 * `@sentry/core` is a dev dependency only: the built entry never imports it.
 * `pnpm typecheck` fails here if a Sentry upgrade changes the option shapes.
 */
import type { Breadcrumb, ErrorEvent, Options, TransactionEvent } from '@sentry/core';
import { describe, expect, it } from 'vitest';
import { createErrorReportingOptions } from './observability';

describe('Sentry SDK compatibility', () => {
  it('spreads into Sentry options without casts', () => {
    const options: Partial<Options> = {
      ...createErrorReportingOptions({
        app: 'fds',
        surface: 'backoffice',
        dsn: 'https://k@o1.ingest.sentry.io/1',
      }),
    };
    const event: ErrorEvent = {
      type: undefined,
      message: 'mail flota@example.com',
    };
    const transaction: TransactionEvent = {
      type: 'transaction',
      transaction: 'GET /x/1',
    };
    const crumb: Breadcrumb = {
      category: 'console',
      message: 'flota@example.com',
    };

    const sent = options.beforeSend?.(event, {}) as ErrorEvent;
    const sentTransaction = options.beforeSendTransaction?.(transaction, {}) as TransactionEvent;
    const kept = options.beforeBreadcrumb?.(crumb) as Breadcrumb;

    expect(sent.message).toBe('mail *****************');
    expect(sent.tags).toEqual({ app: 'fds', surface: 'backoffice' });
    expect(sentTransaction.transaction).toBe('GET /x/[id]');
    expect(kept.message).toBe('*****************');
  });
});
