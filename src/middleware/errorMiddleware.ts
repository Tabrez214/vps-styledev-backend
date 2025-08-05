import { Request, Response, NextFunction, ErrorRequestHandler } from 'express';

/**
 * Custom error class for API errors with status code
 */
export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Custom error class for validation errors
 */
export class ValidationError extends ApiError {
  errors: any[];

  constructor(message: string, errors: any[] = []) {
    super(400, message);
    this.errors = errors;
  }
}

/**
 * Custom error class for not found errors
 */
export class NotFoundError extends ApiError {
  constructor(message: string = 'Resource not found') {
    super(404, message);
  }
}

/**
 * Custom error class for authentication errors
 */
export class AuthenticationError extends ApiError {
  constructor(message: string = 'Authentication required') {
    super(401, message);
  }
}

/**
 * Custom error class for authorization errors
 */
export class AuthorizationError extends ApiError {
  constructor(message: string = 'Not authorized') {
    super(403, message);
  }
}

/**
 * Global error handler middleware
 */
export const errorHandler: ErrorRequestHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  console.error('Error:', err);

  // Handle ApiError instances
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err instanceof ValidationError ? err.errors : undefined
    });
    return;
  }

  // Handle Mongoose validation errors
  if (err.name === 'ValidationError') {
    res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err
    });
    return;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired token'
    });
    return;
  }

  // Handle other errors
  res.status(500).json({
    success: false,
    message: 'Internal server error'
  });
};

/**
 * Async handler to wrap async route handlers
 */
export const asyncHandler = (fn: Function) => (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
