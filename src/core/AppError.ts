/**
 * Operational HTTP error carrying a machine-readable error code and optional
 * entity snapshot for optimistic concurrency conflict responses (HTTP 409).
 */
export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly isOperational: boolean;
  public readonly currentData?: unknown;

  constructor(
    statusCode: number,
    code: string,
    message: string,
    currentData?: unknown
  ) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;
    this.currentData = currentData;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  /**
   * Produces an HTTP 400 error when client input violates business or domain constraints
   * that cannot be caught by static schema validation alone (such as deleting an in-use category).
   */
  static badRequest(code: string, message: string): AppError {
    return new AppError(400, code, message);
  }

  /**
   * Produces an HTTP 401 error when credentials are missing, expired, or fail signature checks.
   */
  static unauthorized(
    code = "UNAUTHORIZED",
    message = "Kredensial otentikasi tidak sah."
  ): AppError {
    return new AppError(401, code, message);
  }

  /**
   * Produces an HTTP 403 error when an authenticated user lacks role permissions,
   * uses a revoked session token, or attempts cross-tenant site_id access.
   */
  static forbidden(
    code = "FORBIDDEN",
    message = "Anda tidak memiliki izin untuk mengakses sumber daya ini."
  ): AppError {
    return new AppError(403, code, message);
  }

  /**
   * Produces an HTTP 404 error when a target record does not exist within the active tenant scope.
   */
  static notFound(
    message = "Data yang diminta tidak ditemukan.",
    code = "NOT_FOUND"
  ): AppError {
    return new AppError(404, code, message);
  }

  /**
   * Produces an HTTP 409 error for unique slug collisions or optimistic locking conflicts,
   * optionally attaching the latest database state so the client can reconcile changes.
   */
  static conflict(
    code: string,
    message: string,
    currentData?: unknown
  ): AppError {
    return new AppError(409, code, message, currentData);
  }

  /**
   * Produces an HTTP 429 error when IP rate limits or per-account failed login thresholds are exceeded.
   */
  static tooManyRequests(
    message: string,
    code = "RATE_LIMIT_EXCEEDED"
  ): AppError {
    return new AppError(429, code, message);
  }

  /**
   * Produces an HTTP 500 error with a safe public message to avoid leaking internal stack traces.
   */
  static internal(
    message = "Terjadi kesalahan sistem internal tak terduga."
  ): AppError {
    return new AppError(500, "INTERNAL_SERVER_ERROR", message);
  }
}
