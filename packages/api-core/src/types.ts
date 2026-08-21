/**
 * The shared HTTP response envelope. Every PartRunner API endpoint returns
 * this shape so clients can branch on `success` without knowing the endpoint.
 *
 * Product-domain request and persistence types remain in consuming
 * applications rather than this platform package.
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
  /**
   * Supports both a simple list and structured validation details.
   */
  details?: string[] | Record<string, unknown>;
}
