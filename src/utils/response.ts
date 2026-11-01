import { Response } from "express";

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface ErrorDetail {
  field?: string;
  message: string;
}

export interface ErrorPayload {
  code: string;
  message: string;
  details?: ErrorDetail[];
  currentData?: any;
}

/**
 * Sends a standardized JSON envelope (`{ success: true, data, meta: null, error: null }`)
 * for non-paginated API responses.
 */
export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: null,
    error: null,
  });
}

/**
 * Sends a standardized JSON envelope containing an array of items alongside pagination metadata.
 */
export function sendPaginated<T>(
  res: Response,
  data: T[],
  meta: PaginationMeta,
  statusCode = 200
) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta,
    error: null,
  });
}

/**
 * Sends a standardized error JSON envelope (`{ success: false, data: null, meta: null, error }`),
 * optionally including field-level validation issues or `currentData` on HTTP 409 conflicts.
 */
export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: ErrorDetail[],
  currentData?: any
) {
  const errorObj: ErrorPayload = {
    code,
    message,
  };

  if (details && details.length > 0) {
    errorObj.details = details;
  }

  if (currentData !== undefined) {
    errorObj.currentData = currentData;
  }

  return res.status(statusCode).json({
    success: false,
    data: null,
    meta: null,
    error: errorObj,
  });
}
