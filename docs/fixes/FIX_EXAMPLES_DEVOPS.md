# DevOps & Infrastructure Fix Examples

## 20. Health Check Endpoint

```javascript
// src/app/api/health/route.js
import { NextResponse } from 'next/server';
import { getUsageDb } from '@/lib/usageDb';
import { getDb } from '@/lib/localDb';

export async function GET() {
  const startTime = Date.now();
  const checks = {};
  
  // Check 1: Memory usage
  const memoryUsage = process.memoryUsage();
  checks.memory = {
    status: memoryUsage.heapUsed < 500 * 1024 * 1024 ? 'ok' : 'warning', // 500MB threshold
    heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + 'MB',
    heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + 'MB',
    rss: Math.round(memoryUsage.rss / 1024 / 1024) + 'MB'
  };
  
  // Check 2: Database connectivity
  try {
    const db = await getDb();
    await db.read();
    checks.database = {
      status: 'ok',
      size: db.data ? Object.keys(db.data).length : 0
    };
  } catch (error) {
    checks.database = {
      status: 'error',
      error: error.message
    };
  }
  
  // Check 3: Usage database
  try {
    const usageDb = await getUsageDb();
    const tableCount = usageDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().length;
    checks.usageDatabase = {
      status: 'ok',
      tables: tableCount
    };
  } catch (error) {
    checks.usageDatabase = {
      status: 'error',
      error: error.message
    };
  }
  
  // Check 4: Disk space
  try {
    const fs = await import('fs/promises');
    const stats = await fs.statfs(process.cwd());
    const freeGB = (stats.bfree * stats.bsize) / (1024 * 1024 * 1024);
    checks.disk = {
      status: freeGB > 1 ? 'ok' : 'warning', // 1GB threshold
      free: Math.round(freeGB * 100) / 100 + 'GB'
    };
  } catch (error) {
    checks.disk = {
      status: 'unknown',
      error: error.message
    };
  }
  
  // Check 5: Uptime
  checks.uptime = {
    status: 'ok',
    seconds: Math.floor(process.uptime()),
    human: formatUptime(process.uptime())
  };
  
  // Check 6: Environment
  checks.environment = {
    status: 'ok',
    nodeVersion: process.version,
    env: process.env.NODE_ENV || 'development',
    platform: process.platform,
    arch: process.arch
  };
  
  // Determine overall status
  const hasError = Object.values(checks).some(check => check.status === 'error');
  const hasWarning = Object.values(checks).some(check => check.status === 'warning');
  
  let overallStatus;
  if (hasError) {
    overallStatus = 'error';
  } else if (hasWarning) {
    overallStatus = 'warning';
  } else {
    overallStatus = 'healthy';
  }
  
  const response = {
    status: overallStatus,
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.0.0',
    checks,
    duration: Date.now() - startTime + 'ms'
  };
  
  return NextResponse.json(response, {
    status: hasError ? 503 : 200,
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'X-Health-Check': 'true'
    }
  });
}

function formatUptime(seconds) {
  const days = Math.floor(seconds / (24 * 60 * 60));
  const hours = Math.floor((seconds % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((seconds % (60 * 60)) / 60);
  const secs = Math.floor(seconds % 60);
  
  if (days > 0) return `${days}d ${hours}h ${minutes}m`;
  if (hours > 0) return `${hours}h ${minutes}m ${secs}s`;
  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

// Readiness probe (simpler, for load balancers)
export async function readiness() {
  try {
    // Quick database check
    await getDb();
    return NextResponse.json({ status: 'ready' }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ 
      status: 'not ready',
      error: error.message 
    }, { status: 503 });
  }
}

// Liveness probe (for container orchestration)
export async function liveness() {
  return NextResponse.json({ 
    status: 'alive',
    timestamp: new Date().toISOString()
  }, { status: 200 });
}
```

## 21. Rate Limiting per API Key

```javascript
// src/lib/apiRateLimiter.js
import { RateLimiterMemory } from 'rate-limiter-flexible';

const API_LIMITS = {
  // Default limits
  default: { points: 60, duration: 60 }, // 60 requests per minute
  
  // Per model limits (higher for cheaper models)
  'gpt-3.5-turbo': { points: 100, duration: 60 },
  'gpt-4': { points: 30, duration: 60 },
  'claude-3': { points: 30, duration: 60 },
  
  // Per endpoint limits
  '/v1/chat/completions': { multiplier: 1 },
  '/v1/embeddings': { multiplier: 2 }, // More requests allowed
};

const limiters = new Map();

export function getRateLimiter(apiKey, model, endpoint) {
  const key = `${apiKey}:${model}:${endpoint}`;
  
  if (!limiters.has(key)) {
    // Get appropriate limits
    const modelLimits = API_LIMITS[model] || API_LIMITS.default;
    const endpointMultiplier = API_LIMITS[endpoint]?.multiplier || 1;
    
    limiters.set(key, new RateLimiterMemory({
      points: Math.floor(modelLimits.points * endpointMultiplier),
      duration: modelLimits.duration,
      blockDuration: modelLimits.duration
    }));
  }
  
  return limiters.get(key);
}

export async function checkApiRateLimit(apiKey, model, endpoint) {
  const limiter = getRateLimiter(apiKey, model, endpoint);
  const key = `${apiKey}:${model}:${endpoint}`;
  
  try {
    await limiter.consume(key);
    return { allowed: true };
  } catch (rlRejected) {
    const retryAfter = Math.ceil(rlRejected.msBeforeNext / 1000);
    
    return {
      allowed: false,
      retryAfter,
      remaining: 0,
      limit: limiter.points
    };
  }
}

// Clean up old limiters periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, limiter] of limiters.entries()) {
    // Remove limiters that haven't been used in 10 minutes
    if (limiter.lastConsumed && now - limiter.lastConsumed > 10 * 60 * 1000) {
      limiters.delete(key);
    }
  }
}, 5 * 60 * 1000); // Check every 5 minutes
```

## 22. Request Body Size Limit Middleware

```javascript
// src/middleware/bodyLimit.js
const MAX_BODY_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_CHAT_BODY_SIZE = 2 * 1024 * 1024; // 2MB for chat endpoints

export function createBodyLimitMiddleware() {
  return async (request, next) => {
    const contentLength = parseInt(request.headers.get('content-length') || '0');
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // Different limits for different endpoints
    let maxSize = MAX_BODY_SIZE;
    if (pathname.includes('/chat/completions')) {
      maxSize = MAX_CHAT_BODY_SIZE;
    }
    
    if (contentLength > maxSize) {
      return new Response(
        JSON.stringify({
          error: 'Request body too large',
          maxSize,
          actualSize: contentLength
        }),
        {
          status: 413,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    // For streaming requests, also check during reading
    if (request.body && contentLength === 0) {
      // Content-Length not provided, we'll check during reading
      const reader = request.body.getReader();
      let totalSize = 0;
      
      const stream = new ReadableStream({
        async start(controller) {
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              
              totalSize += value.length;
              
              if (totalSize > maxSize) {
                controller.error(new Error(`Request body exceeds limit of ${maxSize} bytes`));
                return;
              }
              
              controller.enqueue(value);
            }
            controller.close();
          } catch (error) {
            controller.error(error);
          }
        }
      });
      
      return next(new Request(request.url, {
        method: request.method,
        headers: request.headers,
        body: stream,
        duplex: 'half'
      }));
    }
    
    return next(request);
  };
}
```

## 23. Graceful Shutdown Handler

```javascript
// src/lib/gracefulShutdown.js
let isShuttingDown = false;
let activeRequests = 0;
const shutdownCallbacks = [];

export function initGracefulShutdown() {
  const gracefulShutdown = async (signal) => {
    if (isShuttingDown) {
      console.log(`[Shutdown] Already shutting down, ignoring ${signal}`);
      return;
    }
    
    isShuttingDown = true;
    console.log(`[Shutdown] Received ${signal}. Starting graceful shutdown...`);
    
    // Set a timeout for forced shutdown
    const forceTimeout = setTimeout(() => {
      console.error('[Shutdown] Forced shutdown after timeout');
      process.exit(1);
    }, 30000); // 30 seconds
    
    try {
      // 1. Stop accepting new requests
      console.log('[Shutdown] Stopping new request acceptance');
      
      // 2. Wait for active requests to complete
      if (activeRequests > 0) {
        console.log(`[Shutdown] Waiting for ${activeRequests} active requests to complete`);
        await new Promise((resolve) => {
          const checkInterval = setInterval(() => {
            if (activeRequests === 0) {
              clearInterval(checkInterval);
              resolve();
            }
          }, 100);
          
          // Maximum wait time
          setTimeout(() => {
            clearInterval(checkInterval);
            resolve();
          }, 15000); // 15 seconds max
        });
      }
      
      // 3. Execute cleanup callbacks
      console.log('[Shutdown] Running cleanup callbacks');
      for (const callback of shutdownCallbacks) {
        try {
          await callback();
        } catch (error) {
          console.error('[Shutdown] Cleanup callback error:', error);
        }
      }
      
      // 4. Close database connections
      console.log('[Shutdown] Closing database connections');
      await closeDatabases();
      
      // 5. Clear timeout and exit
      clearTimeout(forceTimeout);
      console.log('[Shutdown] Graceful shutdown complete');
      process.exit(0);
      
    } catch (error) {
      console.error('[Shutdown] Error during shutdown:', error);
      clearTimeout(forceTimeout);
      process.exit(1);
    }
  };
  
  // Register signal handlers
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  
  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('[Shutdown] Uncaught exception:', error);
    gracefulShutdown('uncaughtException');
  });
  
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Shutdown] Unhandled rejection at:', promise, 'reason:', reason);
    gracefulShutdown('unhandledRejection');
  });
}

export function trackRequestStart() {
  if (isShuttingDown) {
    throw new Error('Server is shutting down');
  }
  activeRequests++;
  return () => {
    activeRequests--;
  };
}

export function addShutdownCallback(callback) {
  shutdownCallbacks.push(callback);
}

export function isServerShuttingDown() {
  return isShuttingDown;
}

// Database cleanup helper
async function closeDatabases() {
  try {
    // Close lowdb connections if any
    const { getDb } = await import('@/lib/localDb');
    const db = await getDb();
    if (db && db.close) {
      await db.close();
    }
    
    // Close SQLite connections
    const { getUsageDb } = await import('@/lib/usageDb');
    const usageDb = await getUsageDb();
    if (usageDb && usageDb.close) {
      usageDb.close();
    }
    
    console.log('[Shutdown] Databases closed successfully');
  } catch (error) {
    console.error('[Shutdown] Error closing databases:', error);
  }
}
```

## 24. Enhanced Error Response Standard

```javascript
// src/lib/apiResponse.js
import { NextResponse } from 'next/server';

// Standard error codes
export const ErrorCodes = {
  // Authentication errors
  AUTH_INVALID_CREDENTIALS: 'AUTH_INVALID_CREDENTIALS',
  AUTH_TOKEN_EXPIRED: 'AUTH_TOKEN_EXPIRED',
  AUTH_TOKEN_INVALID: 'AUTH_TOKEN_INVALID',
  AUTH_UNAUTHORIZED: 'AUTH_UNAUTHORIZED',
  
  // Validation errors
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_REQUEST_BODY: 'INVALID_REQUEST_BODY',
  MISSING_REQUIRED_FIELD: 'MISSING_REQUIRED_FIELD',
  
  // Resource errors
  RESOURCE_NOT_FOUND: 'RESOURCE_NOT_FOUND',
  RESOURCE_ALREADY_EXISTS: 'RESOURCE_ALREADY_EXISTS',
  
  // Rate limiting
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Provider errors
  PROVIDER_ERROR: 'PROVIDER_ERROR',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_QUOTA_EXCEEDED: 'PROVIDER_QUOTA_EXCEEDED',
  
  // Database errors
  DATABASE_ERROR: 'DATABASE_ERROR',
  
  // Internal errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
};

// Error classes
export class ApiError extends Error {
  constructor(message, statusCode = 500, code = ErrorCodes.INTERNAL_ERROR, details = null) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
  }
}

export class ValidationError extends ApiError {
  constructor(message, details = null) {
    super(message, 400, ErrorCodes.VALIDATION_ERROR, details);
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication required') {
    super(message, 401, ErrorCodes.AUTH_UNAUTHORIZED);
    this.name = 'AuthenticationError';
  }
}

export class NotFoundError extends ApiError {
  constructor(resource = 'Resource') {
    super(`${resource} not found`, 404, ErrorCodes.RESOURCE_NOT_FOUND);
    this.name = 'NotFoundError';
  }
}

export class RateLimitError extends ApiError {
  constructor(retryAfter) {
    super('Rate limit exceeded', 429, ErrorCodes.RATE_LIMIT_EXCEEDED);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

// Response helpers
export function successResponse(data, status = 200, meta = {}) {
  return NextResponse.json({
    success: true,
    data,
    meta: {
      timestamp: new Date().toISOString(),
      ...meta
    }
  }, { status });
}

export function errorResponse(error, requestId = null) {
  const statusCode = error.statusCode || 500;
  const code = error.code || ErrorCodes.INTERNAL_ERROR;
  
  // Log error for debugging (except validation errors)
  if (statusCode >= 500) {
    console.error(`[API Error] ${code}: ${error.message}`, {
      stack: error.stack,
      details: error.details,
      requestId
    });
  }
  
  return NextResponse.json({
    success: false,
    error: {
      message: process.env.NODE_ENV === 'production' && statusCode >= 500
        ? 'Internal server error'
        : error.message,
      code,
      details: error.details,
      retryAfter: error.retryAfter
    },
    meta: {
      timestamp: new Date().toISOString(),
      requestId
    }
  }, { 
    status: statusCode,
    headers: requestId ? { 'x-request-id': requestId } : {}
  });
}

// Error handling middleware
export function withErrorHandling(handler) {
  return async (request, ...args) => {
    try {
      return await handler(request, ...args);
    } catch (error) {
      if (error instanceof ApiError) {
        return errorResponse(error, request.requestId);
      }
      
      // Unexpected error
      console.error('Unexpected error:', error);
      return errorResponse(
        new ApiError('Internal server error', 500, ErrorCodes.INTERNAL_ERROR),
        request.requestId
      );
    }
  };
}

// Validation helper
export function validateBody(schema) {
  return async (request) => {
    try {
      const body = await request.json();
      const result = schema.safeParse(body);
      
      if (!result.success) {
        throw new ValidationError('Invalid request body', {
          errors: result.error.errors
        });
      }
      
      return result.data;
    } catch (error) {
      if (error instanceof ValidationError) {
        throw error;
      }
      throw new ValidationError('Invalid JSON in request body');
    }
  };
}
```

## 25. Docker Image Optimization

```dockerfile
# Dockerfile
# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY open-sse/package*.json ./open-sse/

# Install dependencies with cache optimization
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY . .

# Build Next.js application
RUN npm run build

# Production stage
FROM node:20-alpine AS runner

# Install runtime dependencies
RUN apk add --no-cache curl

WORKDIR /app

# Copy built application
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/open-sse ./open-sse

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Set permissions
RUN chown -R nextjs:nodejs /app

USER nextjs

# Expose port
EXPOSE 20128

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:20128/api/health || exit 1

# Environment
ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

# Start application
CMD ["node", "server.js"]
```

## 26. Development Docker Compose

```yaml
# docker-compose.dev.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile.dev
    ports:
      - "20128:20128"
    environment:
      - NODE_ENV=development
      - JWT_SECRET=dev-secret-not-for-production
      - API_KEY_SECRET=dev-api-key-secret
      - LOG_LEVEL=debug
    volumes:
      - .:/app
      - /app/node_modules
      - /app/.next
    command: npm run dev
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:20128/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes

  # Optional: PostgreSQL for production-like testing
  postgres:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=9router
      - POSTGRES_PASSWORD=9router_dev
      - POSTGRES_DB=9router
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

volumes:
  redis_data:
  postgres_data:
```

## DevOps Best Practices

1. **Use Health Checks** - For container orchestration and load balancers
2. **Implement Graceful Shutdown** - Handle SIGTERM/SIGINT properly
3. **Standardize Error Responses** - Consistent API error format
4. **Optimize Docker Images** - Multi-stage builds, non-root users
5. **Use Docker Compose** - For development environment
6. **Set Proper Resource Limits** - CPU and memory limits in containers
7. **Use Environment Variables** - For configuration, not hardcoding
8. **Monitor Container Health** - Regular health checks and logging
9. **Implement Request Body Limits** - Prevent memory exhaustion
10. **Use Rate Limiting** - Protect against abuse