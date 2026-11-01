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

  static badRequest(code: string, message: string): AppError {
    return new AppError(400, code, message);
  }

  static unauthorized(
    code = "UNAUTHORIZED",
    message = "Kredensial otentikasi tidak sah."
  ): AppError {
    return new AppError(401, code, message);
  }

  static forbidden(
    code = "FORBIDDEN",
    message = "Anda tidak memiliki izin untuk mengakses sumber daya ini."
  ): AppError {
    return new AppError(403, code, message);
  }

  static notFound(
    message = "Data yang diminta tidak ditemukan.",
    code = "NOT_FOUND"
  ): AppError {
    return new AppError(404, code, message);
  }

  static conflict(
    code: string,
    message: string,
    currentData?: unknown
  ): AppError {
    return new AppError(409, code, message, currentData);
  }

  static tooManyRequests(
    message: string,
    code = "RATE_LIMIT_EXCEEDED"
  ): AppError {
    return new AppError(429, code, message);
  }

  static internal(
    message = "Terjadi kesalahan sistem internal tak terduga."
  ): AppError {
    return new AppError(500, "INTERNAL_SERVER_ERROR", message);
  }
}
