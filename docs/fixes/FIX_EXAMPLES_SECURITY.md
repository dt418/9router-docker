# Security & Error Handling Fix Examples

## 1. Security Fixes

### 1.1 Secure JWT Secret Management
```javascript
// src/lib/secrets.js
import { randomBytes } from 'crypto';

const REQUIRED_ENV_VARS = [
  'JWT_SECRET',
  'API_KEY_SECRET', 
  'MACHINE_ID_SALT'
];

export function initializeSecrets() {
  const missing = [];
  
  REQUIRED_ENV_VARS.forEach(varName => {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  });
  
  if (missing.length > 0 && process.env.NODE_ENV === 'production') {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  // Generate secure defaults for development
  if (missing.includes('JWT_SECRET')) {
    process.env.JWT_SECRET = randomBytes(32).toString('hex');
    console.warn('[SECURITY] Generated JWT_SECRET for development. Set this in production!');
  }
  
  // ... similar for others
}
```

### 1.2 Rate Limiting Middleware
```javascript
// src/middleware/rateLimit.js
import { RateLimiterMemory } from 'rate-limiter-flexible';

const limiters = {
  login: new RateLimiterMemory({
    points: 5,
    duration: 15 * 60, // 15 minutes
    blockDuration: 15 * 60,
  }),
  
  api: new RateLimiterMemory({
    points: 100,
    duration: 60, // 1 minute
  }),
};

export async function rateLimit(req, limiterName = 'api') {
  const limiter = limiters[limiterName];
  if (!limiter) return true;
  
  const ip = req.headers.get('x-forwarded-for') || req.ip;
  
  try {
    await limiter.consume(ip);
    return true;
  } catch (rlRejected) {
    const retryAfter = Math.ceil(rlRejected.msBeforeNext / 1000);
    
    return new Response(
      JSON.stringify({
        error: 'Too many requests',
        retryAfter
      }),
      {
        status: 429,
        headers: {
          'Retry-After': retryAfter.toString(),
          'Content-Type': 'application/json'
        }
      }
    );
  }
}
```

### 1.3 Input Validation Utilities
```javascript
// src/lib/validation.js
import { z } from 'zod';

// URL validation schema
export const urlSchema = z.string().url().refine(
  (url) => {
    try {
      const parsed = new URL(url);
      // Block internal networks
      const blocked = ['localhost', '127.0.0.1', '10.', '192.168.', '172.'];
      return !blocked.some(b => parsed.hostname.includes(b));
    } catch {
      return false;
    }
  },
  { message: 'Invalid or internal URL' }
);

// Provider node validation
export const providerNodeSchema = z.object({
  name: z.string().min(1).max(100),
  prefix: z.string().min(1).max(50),
  baseUrl: urlSchema,
  apiType: z.enum(['openai', 'anthropic', 'google', 'custom']),
  type: z.enum(['primary', 'backup', 'test']),
});

// Validate and sanitize input
export function validateInput(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError('Invalid input', result.error.errors);
  }
  return result.data;
}
```

## 2. Performance Fixes (Security-related)

### 2.1 Database Caching Layer
```javascript
// src/lib/cache/redis.js
import Redis from 'ioredis';

let redis = null;

export function getRedisClient() {
  if (!redis) {
    redis = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });
    
    redis.on('error', (error) => {
      console.error('[Redis] Connection error:', error);
    });
    
    redis.on('connect', () => {
      console.log('[Redis] Connected successfully');
    });
  }
  
  return redis;
}

// Cache with automatic expiration
export async function cachedOperation(key, operation, ttlSeconds = 300) {
  const client = getRedisClient();
  
  // Try to get from cache
  const cached = await client.get(key);
  if (cached) {
    return JSON.parse(cached);
  }
  
  // Execute operation
  const result = await operation();
  
  // Cache the result
  await client.setex(key, ttlSeconds, JSON.stringify(result));
  
  return result;
}

// Invalidate cache by pattern
export async function invalidateCache(pattern) {
  const client = getRedisClient();
  const keys = await client.keys(pattern);
  
  if (keys.length > 0) {
    await client.del(...keys);
  }
}
```

## 3. Error Handling Improvements

### 3.1 Structured Error Classes
```javascript
// src/lib/errors.js
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
```

### 3.2 Global Error Handler
```javascript
// src/lib/errorHandler.js
import { AppError } from './errors';

export function errorHandler(error, req, res) {
  // Log error with context
  console.error(`[${new Date().toISOString()}] ${req.method} ${req.url}`, {
    error: error.message,
    stack: error.stack,
    code: error.code,
    userId: req.user?.id,
    ip: req.ip,
  });
  
  // Operational errors (expected) vs programming errors (bugs)
  if (error.isOperational) {
    return res.status(error.statusCode).json(error.toJSON());
  }
  
  // Programming errors - don't leak details in production
  if (process.env.NODE_ENV === 'production') {
    return res.status(500).json({
      error: {
        message: 'Internal server error',
        code: 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
      }
    });
  }
  
  // Development - show full error
  return res.status(500).json({
    error: {
      message: error.message,
      code: 'INTERNAL_ERROR',
      stack: error.stack,
      timestamp: new Date().toISOString(),
    }
  });
}

// Async error wrapper
export function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
```

### 3.3 React Error Boundary
```javascript
// src/components/ErrorBoundary.jsx
"use client";
import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { 
      hasError: false, 
      error: null,
      errorInfo: null 
    };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
    
    // Log to error tracking service
    console.error('Error caught by boundary:', error, errorInfo);
    
    // Send to monitoring service
    if (window.errorReporter) {
      window.errorReporter.captureException(error, {
        extra: errorInfo,
        tags: { component: this.props.name || 'unknown' }
      });
    }
  }

  render() {
    if (this.state.hasError) {
      // Custom fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="error-fallback p-4 border border-red-300 rounded bg-red-50">
          <h2 className="text-lg font-semibold text-red-800">
            Something went wrong
          </h2>
          <p className="text-sm text-red-600 mt-2">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button 
            onClick={() => {
              this.setState({ hasError: false, error: null, errorInfo: null });
              if (this.props.onReset) {
                this.props.onReset();
              }
            }}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Try again
          </button>
          {process.env.NODE_ENV === 'development' && this.state.errorInfo && (
            <details className="mt-4 text-xs text-gray-600">
              <summary>Error details</summary>
              <pre className="mt-2 p-2 bg-gray-100 rounded overflow-auto">
                {this.state.error?.stack}
              </pre>
            </details>
          )}
        </div>
      );
    }

    return this.props.children;
  }
}
```

## Security Best Practices Summary

1. **Always validate and sanitize input** - Use schema validation
2. **Implement rate limiting** - Protect against brute force and DoS
3. **Use secure secrets management** - Never hardcode secrets
4. **Handle errors gracefully** - Don't leak internal details
5. **Log security events** - Monitor for suspicious activity
6. **Use HTTPS** - Encrypt data in transit
7. **Set security headers** - CSP, HSTS, X-Frame-Options
8. **Keep dependencies updated** - Patch security vulnerabilities