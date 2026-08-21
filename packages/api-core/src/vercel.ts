/**
 * @partrunner-ai/api-core/vercel — HTTP adapters for Vercel Serverless Functions.
 *
 * These are typed against `VercelRequest` / `VercelResponse` and therefore only
 * apply to apps on Vercel's Node runtime. Apps on Next.js App Router use
 * Web-standard `Request` / `Response` and should not
 * import from here — an App Router equivalent can be added as `./next` when a
 * second consumer needs one.
 *
 * `@vercel/node` is not a dependency of this package at all — these are `import
 * type` only, so nothing survives compilation. A consumer of this subpath supplies
 * it; a consumer of the root entry point never needs it.
 */

export {
  configureRequestRecorder,
  withHandler,
  type HandlerOptions,
  type Method,
  type RequestRecorder,
} from './vercel/withHandler';

export {
  applyRateLimit,
  checkRateLimit,
} from './vercel/rateLimit';

export {
  configureAdminVerifier,
  extractApiKey,
  hasScope,
  logApiKeyUsage,
  verifyApiKey,
  verifyAuthOrApiKey,
  withApiKeyAuth,
  type AdminVerifier,
  type ApiKey,
  type ApiKeyScope,
} from './vercel/apiKeyAuth';
