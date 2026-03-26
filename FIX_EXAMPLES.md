# Code Fix Examples

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

// Provider node schema
export const providerNodeSchema = z.object({
  name: z.string().trim().min(1).max(100),
  prefix: z.string().trim().min(1).max(50),
  baseUrl: urlSchema.optional(),
  apiType: z.enum(['chat', 'responses']).optional(),
  type: z.enum(['openai-compatible', 'anthropic-compatible']).optional(),
});

// Validation middleware
export function validate(schema) {
  return async (req) => {
    try {
      const body = await req.json();
      const validated = schema.parse(body);
      return { success: true, data: validated };
    } catch (error) {
      return { 
        success: false, 
        error: error.errors?.[0]?.message || 'Validation failed' 
      };
    }
  };
}
```

## 2. Performance Fixes

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
  }
  
  return redis;
}

// Cache wrapper
export async function cached(key, fetchFn, ttl = 300) {
  const redis = getRedisClient();
  
  try {
    const cached = await redis.get(key);
    if (cached) {
      return JSON.parse(cached);
    }
    
    const data = await fetchFn();
    await redis.setex(key, ttl, JSON.stringify(data));
    return data;
  } catch (error) {
    console.warn('[Cache] Error:', error.message);
    return fetchFn(); // Fallback to direct fetch
  }
}
```

### 2.2 Optimized Database Operations
```javascript
// src/lib/db/optimized.js
class WriteBatcher {
  constructor(db, delay = 100) {
    this.db = db;
    this.delay = delay;
    this.queue = [];
    this.timeout = null;
  }
  
  write(data) {
    this.queue.push(data);
    
    if (this.timeout) clearTimeout(this.timeout);
    this.timeout = setTimeout(() => this.flush(), this.delay);
  }
  
  async flush() {
    if (this.queue.length === 0) return;
    
    const batch = [...this.queue];
    this.queue = [];
    
    try {
      this.db.data = { ...this.db.data, ...batch };
      await this.db.write();
    } catch (error) {
      console.error('[DB] Batch write failed:', error);
      // Re-queue failed writes
      this.queue.push(...batch);
    }
  }
}

// Usage
const batcher = new WriteBatcher(db);
batcher.write({ providerConnections: updatedConnections });
```

### 2.3 Connection Pooling
```javascript
// src/lib/http/pool.js
import { Agent, setGlobalDispatcher } from 'undici';

const pool = new Agent({
  connections: 100,
  pipelining: 10,
  connect: {
    timeout: 10000,
    keepAlive: true,
  },
  tls: {
    rejectUnauthorized: true,
  },
});

// Set as global dispatcher
setGlobalDispatcher(pool);

// Monitor pool stats
setInterval(() => {
  const stats = pool.stats;
  console.log('[HTTP Pool]', {
    connected: stats.connected,
    free: stats.free,
    pending: stats.pending,
    requests: stats.requests,
  });
}, 60000);
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
    super(`${resource} not found`, 404, 'NOT_FOUND', { resource, id });
  }
}

export class ValidationError extends AppError {
  constructor(field, message) {
    super(`Validation failed: ${field} - ${message}`, 400, 'VALIDATION_ERROR', { field, message });
  }
}

export class RateLimitError extends AppError {
  constructor(retryAfter) {
    super('Too many requests', 429, 'RATE_LIMIT_EXCEEDED', { retryAfter });
  }
}
```

### 3.2 Global Error Handler
```javascript
// src/lib/errorHandler.js
import { AppError } from './errors.js';

export function errorHandler(error, req, res) {
  // Log with context
  console.error('[ERROR]', {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.url,
    error: error.message,
    stack: error.stack,
    userId: req.user?.id,
    requestId: req.headers['x-request-id'],
  });
  
  // Operational errors (expected)
  if (error.isOperational) {
    return res.status(error.statusCode).json(error.toJSON());
  }
  
  // Programming errors (unexpected)
  console.error('[FATAL]', error);
  
  // Don't leak internal errors in production
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : error.message;
    
  return res.status(500).json({
    error: {
      message,
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    }
  });
}

// Async error wrapper
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
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
    
    // Log to error reporting service
    if (typeof window !== 'undefined') {
      window.errorReporter?.captureException(error, {
        extra: errorInfo,
        tags: { component: this.props.name || 'Unknown' }
      });
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <details>
            <summary>Error Details</summary>
            <pre>{this.state.error?.toString()}</pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false, error: null })}
            className="retry-button"
          >
            Try Again
          </button>
        </div>
      );
    }
    
    return this.props.children;
  }
}

// Usage
<ErrorBoundary name="ChatComponent">
  <Chat />
</ErrorBoundary>
```

## 4. Database Improvements

### 4.1 Schema Validation with JSON Schema
```javascript
// src/lib/db/schema.js
export const providerConnectionSchema = {
  type: 'object',
  required: ['id', 'provider', 'authType'],
  properties: {
    id: { type: 'string', format: 'uuid' },
    provider: { type: 'string', minLength: 1 },
    authType: { enum: ['oauth', 'apikey'] },
    name: { type: ['string', 'null'] },
    priority: { type: 'integer', minimum: 1 },
    isActive: { type: 'boolean' },
    createdAt: { type: 'string', format: 'date-time' },
    updatedAt: { type: 'string', format: 'date-time' },
  },
  additionalProperties: true,
};

// Validation function
import Ajv from 'ajv';

const ajv = new Ajv({ allErrors: true });

export function validateConnection(data) {
  const validate = ajv.compile(providerConnectionSchema);
  const valid = validate(data);
  
  if (!valid) {
    throw new ValidationError('Invalid provider connection', validate.errors);
  }
  
  return data;
}
```

### 4.2 Database Backup Strategy
```javascript
// src/lib/db/backup.js
import fs from 'fs';
import path from 'path';

export class DatabaseBackup {
  constructor(dbPath, backupDir) {
    this.dbPath = dbPath;
    this.backupDir = backupDir;
    this.maxBackups = 10;
  }
  
  async createBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-${timestamp}.json`;
    const backupPath = path.join(this.backupDir, backupName);
    
    // Copy database file
    await fs.promises.copyFile(this.dbPath, backupPath);
    
    // Cleanup old backups
    await this.cleanupOldBackups();
    
    console.log(`[Backup] Created: ${backupName}`);
    return backupPath;
  }
  
  async cleanupOldBackups() {
    const files = await fs.promises.readdir(this.backupDir);
    const backups = files
      .filter(f => f.startsWith('backup-'))
      .sort()
      .reverse();
    
    if (backups.length > this.maxBackups) {
      const toDelete = backups.slice(this.maxBackups);
      for (const file of toDelete) {
        await fs.promises.unlink(path.join(this.backupDir, file));
      }
    }
  }
  
  async restoreBackup(backupName) {
    const backupPath = path.join(this.backupDir, backupName);
    
    // Verify backup exists
    await fs.promises.access(backupPath);
    
    // Create current backup before restore
    await this.createBackup();
    
    // Restore
    await fs.promises.copyFile(backupPath, this.dbPath);
    console.log(`[Backup] Restored: ${backupName}`);
  }
}
```

## 5. Monitoring and Logging

### 5.1 Structured Logging
```javascript
// src/lib/logger.js
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { 
    service: '9router',
    version: process.env.npm_package_version 
  },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      ),
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error' 
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log' 
    }),
  ],
});

// Request logging middleware
export function requestLogger(req, res, next) {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers['x-request-id'],
    });
  });
  
  next();
}

export default logger;
```

### 5.2 Health Check Endpoint
```javascript
// src/app/api/health/route.js
import { NextResponse } from 'next/server';

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      disk: await checkDisk(),
    }
  };
  
  const isHealthy = Object.values(checks.checks)
    .every(check => check.status === 'ok');
  
  return NextResponse.json(checks, {
    status: isHealthy ? 200 : 503,
    headers: {
      'Cache-Control': 'no-cache',
    }
  });
}

async function checkDatabase() {
  try {
    // Simple query to check database connectivity
    await db.read();
    return { status: 'ok', latency: '0ms' };
  } catch (error) {
    return { 
      status: 'error', 
      error: error.message 
    };
  }
}
```

## 6. Testing Utilities

### 6.1 Test Setup
```javascript
// tests/setup.js
import { beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

// Mock environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret';
process.env.DATA_DIR = path.join(__dirname, '../.test-data');

// Setup before all tests
beforeAll(async () => {
  // Create test data directory
  await fs.promises.mkdir(process.env.DATA_DIR, { recursive: true });
});

// Cleanup after all tests
afterAll(async () => {
  // Remove test data directory
  await fs.promises.rm(process.env.DATA_DIR, { recursive: true, force: true });
});
```

### 6.2 API Test Helpers
```javascript
// tests/helpers/api.js
import { createMocks } from 'node-mocks-http';

export async function testApiRoute(handler, { method = 'GET', body, query, headers } = {}) {
  const { req, res } = createMocks({ method, body, query, headers });
  
  await handler(req, res);
  
  return {
    status: res.statusCode,
    body: JSON.parse(res._getData()),
    headers: res._getHeaders(),
  };
}

// Example usage
it('should return 401 without auth', async () => {
  const { status, body } = await testApiRoute(PATCH, {
    method: 'PATCH',
    body: { setting: 'value' },
  });
  
  expect(status).toBe(401);
  expect(body.error).toMatch(/unauthorized/i);
});
```

## 7. Production Deployment Checklist

### 7.1 Environment Variables Setup
```bash
# .env.production
# Security
JWT_SECRET=$(openssl rand -hex 32)
API_KEY_SECRET=$(openssl rand -hex 32)
MACHINE_ID_SALT=$(openssl rand -hex 16)

# Database
DATA_DIR=/var/lib/9router/data
BACKUP_DIR=/var/lib/9router/backups

# Features
NODE_ENV=production
ENABLE_REQUEST_LOGS=false
ENABLE_TRANSLATOR=true

# Monitoring
LOG_LEVEL=warn
SENTRY_DSN=

# Network
CORS_ORIGINS=https://dashboard.9router.com
AUTH_COOKIE_SECURE=true
```

### 7.2 Docker Compose for Production
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "20128:20128"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - DATA_DIR=/data
    volumes:
      - data:/data
      - ./backups:/backups
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:20128/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
    
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
    restart: unless-stopped
    
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
      - prometheus-data:/prometheus
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana:latest
    environment:
      - GF_SECURITY_ADMIN_PASSWORD=${GRAFANA_PASSWORD}
    volumes:
      - grafana-data:/var/lib/grafana
    ports:
      - "3000:3000"

volumes:
  data:
  redis-data:
  prometheus-data:
  grafana-data:
```

### 7.3 Nginx Configuration
```nginx
# nginx.conf
server {
    listen 443 ssl http2;
    server_name api.9router.com;
    
    # SSL
    ssl_certificate /etc/ssl/certs/9router.crt;
    ssl_certificate_key /etc/ssl/private/9router.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    # Proxy
    location / {
        proxy_pass http://app:20128;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

---

## Updated Code Examples (2026-03-25)

### 16. Circuit Breaker for Provider Fallback

```javascript
// src/lib/circuitBreaker.js
class CircuitBreaker {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000; // 1 minute
    this.halfOpenMax = options.halfOpenMax || 3;
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.lastFailureTime = null;
  }
  
  async execute(operation) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        throw new Error(`Circuit breaker OPEN for ${this.provider}. Try again in ${Math.ceil((this.nextAttempt - Date.now()) / 1000)}s`);
      }
      this.state = 'HALF_OPEN';
      this.successCount = 0;
    }
    
    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }
  
  onSuccess() {
    this.failureCount = 0;
    this.lastFailureTime = null;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.halfOpenMax) {
        this.state = 'CLOSED';
        console.log(`[CircuitBreaker] ${this.provider} state: CLOSED`);
      }
    }
  }
  
  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.log(`[CircuitBreaker] ${this.provider} state: OPEN (half-open failed)`);
    } else if (this.failureCount >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.resetTimeout;
      console.log(`[CircuitBreaker] ${this.provider} state: OPEN (${this.failureCount} failures)`);
    }
  }
  
  getStatus() {
    return {
      provider: this.provider,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.state === 'OPEN' ? this.nextAttempt : null
    };
  }
}

// Usage in provider fallback
const breakers = new Map();

export function getCircuitBreaker(provider) {
  if (!breakers.has(provider)) {
    breakers.set(provider, new CircuitBreaker(provider));
  }
  return breakers.get(provider);
}

export async function callProviderWithCircuitBreaker(provider, operation) {
  const breaker = getCircuitBreaker(provider);
  return breaker.execute(operation);
}
```

### 17. SQLite WAL Mode Configuration

```javascript
// src/lib/sqliteConfig.js
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

export function createOptimizedDatabase(dbPath) {
  // Ensure directory exists
  const dir = path.dirname(dbPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  
  const db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : null
  });
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Optimize performance settings
  db.pragma('synchronous = NORMAL'); // Good balance of safety and performance
  db.pragma('cache_size = -64000');  // 64MB cache
  db.pragma('temp_store = MEMORY');  // Store temp tables in memory
  db.pragma('mmap_size = 268435456'); // 256MB mmap
  
  // Set busy timeout for concurrent access
  db.pragma('busy_timeout = 5000'); // 5 seconds
  
  return db;
}

// WAL checkpointing
export function setupWALCheckpoint(db, intervalMs = 300000) { // 5 minutes
  setInterval(() => {
    try {
      const result = db.pragma('wal_checkpoint(TRUNCATE)');
      if (result[0].busy > 0) {
        console.warn(`[SQLite] WAL checkpoint had ${result[0].busy} busy pages`);
      }
    } catch (error) {
      console.error('[SQLite] WAL checkpoint failed:', error);
    }
  }, intervalMs);
}
```

### 18. Atomic Write for lowdb

```javascript
// src/lib/atomicLowDb.js
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import fs from 'fs/promises';
import path from 'path';

class AtomicLowDB {
  constructor(adapter, defaultData = {}) {
    this.db = new Low(adapter, defaultData);
    this.adapter = adapter;
    this.writeQueue = [];
    this.isWriting = false;
  }
  
  async read() {
    await this.db.read();
    return this.db.data;
  }
  
  async write() {
    // Add to write queue
    return new Promise((resolve, reject) => {
      this.writeQueue.push({ resolve, reject });
      this.processWriteQueue();
    });
  }
  
  async processWriteQueue() {
    if (this.isWriting || this.writeQueue.length === 0) {
      return;
    }
    
    this.isWriting = true;
    
    try {
      // Get current data
      const data = this.db.data;
      const filePath = this.adapter.filename;
      const tempPath = `${filePath}.tmp.${Date.now()}`;
      
      // Write to temporary file
      await fs.writeFile(tempPath, JSON.stringify(data, null, 2));
      
      // Atomic rename (POSIX guarantee)
      await fs.rename(tempPath, filePath);
      
      // Resolve all queued promises
      while (this.writeQueue.length > 0) {
        const { resolve } = this.writeQueue.shift();
        resolve();
      }
    } catch (error) {
      // Reject all queued promises
      while (this.writeQueue.length > 0) {
        const { reject } = this.writeQueue.shift();
        reject(error);
      }
    } finally {
      this.isWriting = false;
      
      // Process any new writes that came in
      if (this.writeQueue.length > 0) {
        setTimeout(() => this.processWriteQueue(), 0);
      }
    }
  }
  
  // Delegate other methods to underlying db
  get data() {
    return this.db.data;
  }
  
  set data(value) {
    this.db.data = value;
  }
}

export { AtomicLowDB };
```

### 19. Structured Logging System

```javascript
// src/lib/structuredLogger.js
import { randomUUID } from 'crypto';

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
  TRACE: 4
};

const currentLevel = LOG_LEVELS[process.env.LOG_LEVEL || 'INFO'] || LOG_LEVELS.INFO;

class StructuredLogger {
  constructor(context = {}) {
    this.context = context;
  }
  
  setRequestId(requestId) {
    this.context.requestId = requestId;
    return this;
  }
  
  setUserId(userId) {
    this.context.userId = userId;
    return this;
  }
  
  setProvider(provider) {
    this.context.provider = provider;
    return this;
  }
  
  setModel(model) {
    this.context.model = model;
    return this;
  }
  
  log(level, message, data = {}) {
    if (LOG_LEVELS[level] > currentLevel) {
      return;
    }
    
    const logEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...this.context,
      ...data
    };
    
    // Remove undefined values
    Object.keys(logEntry).forEach(key => {
      if (logEntry[key] === undefined) {
        delete logEntry[key];
      }
    });
    
    const logString = JSON.stringify(logEntry);
    
    if (level === 'ERROR' || level === 'WARN') {
      console.error(logString);
    } else {
      console.log(logString);
    }
  }
  
  error(message, error = null, data = {}) {
    const errorData = error ? {
      error: error.message,
      errorName: error.name,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    } : {};
    
    this.log('ERROR', message, { ...errorData, ...data });
  }
  
  warn(message, data = {}) {
    this.log('WARN', message, data);
  }
  
  info(message, data = {}) {
    this.log('INFO', message, data);
  }
  
  debug(message, data = {}) {
    this.log('DEBUG', message, data);
  }
  
  trace(message, data = {}) {
    this.log('TRACE', message, data);
  }
  
  child(context = {}) {
    return new StructuredLogger({
      ...this.context,
      ...context
    });
  }
}

// Request middleware
export function createRequestLogger() {
  return (handler) => async (request, ...args) => {
    const requestId = randomUUID();
    const logger = new StructuredLogger({ requestId });
    
    // Log request
    logger.info('Request started', {
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.ip
    });
    
    const startTime = Date.now();
    
    try {
      // Add requestId to request for downstream use
      request.requestId = requestId;
      request.logger = logger;
      
      const response = await handler(request, ...args);
      
      const duration = Date.now() - startTime;
      
      // Log response
      logger.info('Request completed', {
        statusCode: response.status,
        duration,
        contentLength: response.headers.get('content-length')
      });
      
      // Add request ID to response headers
      response.headers.set('x-request-id', requestId);
      
      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Request failed', error, {
        duration
      });
      
      throw error;
    }
  };
}

// Singleton instance
export const logger = new StructuredLogger();

// Usage example
export function logProviderCall(provider, model, duration, success, error = null) {
  logger.info('Provider call', {
    provider,
    model,
    duration,
    success,
    error: error ? error.message : undefined
  });
}
```

### 20. Health Check Endpoint

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

### 21. Rate Limiting per API Key

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

### 22. Request Body Size Limit Middleware

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

### 23. Graceful Shutdown Handler

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

### 24. Enhanced Error Response Standard

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

### 25. Docker Image Optimization

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

### 26. Development Docker Compose

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

### 27. Monitoring Integration Example

```javascript
// src/lib/monitoring.js
import { Counter, Histogram, register } from 'prom-client';

// Create metrics
export const requestCounter = new Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'provider']
});

export const requestDuration = new Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'provider'],
  buckets: [0.1, 0.5, 1, 2, 5, 10, 30]
});

export const providerErrors = new Counter({
  name: 'provider_errors_total',
  help: 'Total number of provider errors',
  labelNames: ['provider', 'model', 'error_type']
});

export const activeRequests = new Gauge({
  name: 'active_requests',
  help: 'Number of active requests',
  labelNames: ['provider', 'model']
});

// Metrics endpoint
export async function getMetrics() {
  return await register.metrics();
}

// Middleware for collecting metrics
export function metricsMiddleware(handler) {
  return async (request, ...args) => {
    const start = Date.now();
    const method = request.method;
    const route = new URL(request.url).pathname;
    
    try {
      const response = await handler(request, ...args);
      const duration = (Date.now() - start) / 1000;
      
      requestCounter.inc({ method, route, status_code: response.status });
      requestDuration.observe({ method, route, status_code: response.status }, duration);
      
      return response;
    } catch (error) {
      const duration = (Date.now() - start) / 1000;
      
      requestCounter.inc({ method, route, status_code: 500 });
      requestDuration.observe({ method, route, status_code: 500 }, duration);
      
      throw error;
    }
  };
}

// Provider metrics tracking
export function trackProviderCall(provider, model, duration, success, error = null) {
  const labels = { provider, model };
  
  if (success) {
    requestDuration.observe({ ...labels, status_code: 200 }, duration);
  } else {
    providerErrors.inc({ 
      ...labels, 
      error_type: error?.name || 'unknown' 
    });
  }
}
```

This comprehensive set of fixes addresses the major security, performance, and reliability issues identified in the code review. Implementing these changes will significantly improve the production readiness of the 9Router application.
