# Monitoring & Logging Fix Examples

## 19. Structured Logging System

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

## 27. Monitoring Integration Example

```javascript
// src/lib/monitoring.js
import { Counter, Histogram, Gauge, register } from 'prom-client';

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

// Health check metrics
export const healthCheckStatus = new Gauge({
  name: 'health_check_status',
  help: 'Health check status (1 = healthy, 0 = unhealthy)',
  labelNames: ['component']
});

export const databaseConnections = new Gauge({
  name: 'database_connections',
  help: 'Number of active database connections',
  labelNames: ['database']
});

export const memoryUsage = new Gauge({
  name: 'memory_usage_bytes',
  help: 'Memory usage in bytes',
  labelNames: ['type'] // heapUsed, heapTotal, rss, external
});

// Update memory metrics periodically
setInterval(() => {
  const mem = process.memoryUsage();
  memoryUsage.set({ type: 'heapUsed' }, mem.heapUsed);
  memoryUsage.set({ type: 'heapTotal' }, mem.heapTotal);
  memoryUsage.set({ type: 'rss' }, mem.rss);
  memoryUsage.set({ type: 'external' }, mem.external);
}, 30000); // Every 30 seconds
```

## Monitoring Best Practices

1. **Use Structured Logging** - JSON format for easy parsing and querying
2. **Include Request IDs** - For tracing requests across services
3. **Set Up Metrics Collection** - Use Prometheus or similar
4. **Monitor Key Metrics**:
   - Request latency (p50, p95, p99)
   - Error rates by endpoint
   - Provider success/failure rates
   - Database connection pool usage
   - Memory and CPU usage
5. **Create Alerts** - For critical thresholds
6. **Implement Health Checks** - For load balancers and orchestration
7. **Distributed Tracing** - Use OpenTelemetry for complex systems
8. **Log Aggregation** - Centralize logs with ELK or similar stack

## Example Prometheus Queries

```promql
# Request rate
rate(http_requests_total[5m])

# Error rate
rate(http_requests_total{status_code=~"5.."}[5m]) / rate(http_requests_total[5m])

# 95th percentile latency
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))

# Provider error rate
rate(provider_errors_total[5m])

# Active requests
active_requests
```

## Recommended Tools

- **Logging**: Winston, Pino, Bunyan
- **Metrics**: Prometheus, StatsD, Datadog
- **Tracing**: Jaeger, Zipkin, OpenTelemetry
- **Error Tracking**: Sentry, Bugsnag, Rollbar
- **Health Checks**: terminus, @godaddy/terminus
- **Dashboards**: Grafana, Kibana, Datadog