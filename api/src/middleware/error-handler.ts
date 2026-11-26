import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ApiError } from '../common/api-error.js';
import { logger } from '../common/logger.js';

type NodeEnvironment = 'development' | 'test' | 'production';

export function createErrorHandler(nodeEnvironment: NodeEnvironment): ErrorRequestHandler {
  return (error: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    let apiError: ApiError;
    if (error instanceof ApiError) {
      apiError = error;
    } else if (error instanceof ZodError) {
      apiError = new ApiError(
        422,
        'VALIDATION_ERROR',
        'Request validation failed.',
        error.issues.map((issue) => ({
          path: issue.path.map(String).join('.'),
          message: issue.message,
        })),
      );
    } else if (hasErrorType(error, 'entity.parse.failed')) {
      apiError = new ApiError(400, 'MALFORMED_REQUEST', 'The request body contains invalid JSON.');
    } else if (hasErrorType(error, 'entity.too.large')) {
      apiError = new ApiError(413, 'PAYLOAD_TOO_LARGE', 'The request body exceeds the allowed size.');
    } else {
      logger.error({ err: error }, 'Unhandled API error');
      apiError = new ApiError(
        500,
        'INTERNAL_SERVER_ERROR',
        nodeEnvironment === 'production' ? 'An unexpected error occurred.' : errorMessage(error),
      );
    }

    res.status(apiError.status).json({
      error: {
        code: apiError.code,
        message: apiError.message,
        status: apiError.status,
        details: apiError.details,
      },
    });
  };
}

function hasErrorType(error: unknown, type: string): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    error.type === type
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'An unexpected error occurred.';
}
