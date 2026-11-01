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

export function sendSuccess<T>(res: Response, data: T, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
    meta: null,
    error: null,
  });
}

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
