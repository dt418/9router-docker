export class AppError extends Error {
  constructor(message, statusCode, code, details = {}) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    this.timestamp = new Date().toISOString();
  }

  toJSON() {
    return {
      error: {
        message: this.message,
        code: this.code,
        details: this.details,
        timestamp: this.timestamp,
      }
    };
  }
}

export class NotFoundError extends AppError {
  constructor(resource, id) {
    super(`${resource} with id ${id} not found`, 404, 'NOT_FOUND', { resource, id });
    this.name = 'NotFoundError';
  }
}

export class ValidationError extends AppError {
  constructor(message, errors = []) {
    super(message, 400, 'VALIDATION_ERROR', { errors });
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AUTH_ERROR');
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter) {
    super('Too many requests', 429, 'RATE_LIMIT_ERROR', { retryAfter });
    this.name = 'RateLimitError';
  }
}

export class ProviderError extends AppError {
  constructor(provider, message, statusCode = 500) {
    super(message, statusCode, 'PROVIDER_ERROR', { provider });
    this.name = 'ProviderError';
  }
}

export function errorHandler(error, req, res) {
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}`, {
    error: error.message,
    stack: error.stack,
    code: error.code,
    userId: req.user?.id,
    ip: req.ip,
  });

  if (error.isOperational) {
    return res.status(error.statusCode).json(error.toJSON());
  }

  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      }
    });
  }

  return res.status(500).json({
    error: {
      message: error.message,
      code: 'INTERNAL_ERROR',
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }
  });
}

export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}