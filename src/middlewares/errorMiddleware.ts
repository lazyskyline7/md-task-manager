import { Request, Response } from 'express';
import logger from '../logger.js';
import { AppError } from '../error.js';

/**
 * Global error handling middleware.
 * Catches all errors from routes and middleware (via asyncHandler or next(err)).
 * Distinguishes between operational errors (safe to show) and programming errors (generic message).
 * MUST be defined last in middleware chain to catch all errors.
 */
export const errorMiddleware = (
  err: Error | AppError,
  req: Request,
  res: Response,
) => {
  logger.errorWithContext({
    op: 'EXPRESS_ERROR',
    error: err.message,
  });

  // AppError instances are operational errors - safe to expose to client
  // All other errors are programming errors - hide details with generic message
  const isOperational = err instanceof AppError;
  const statusCode = isOperational ? err.statusCode : 500;
  const message = isOperational ? err.message : 'Internal Server Error';

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
