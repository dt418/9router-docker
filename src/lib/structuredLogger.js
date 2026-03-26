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

export const logger = new StructuredLogger();

export function createRequestLogger() {
  return (handler) => async (request, ...args) => {
    const requestId = randomUUID();
    const reqLogger = new StructuredLogger({ requestId });

    reqLogger.info('Request started', {
      method: request.method,
      url: request.url,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for') || request.ip
    });

    const startTime = Date.now();

    try {
      request.requestId = requestId;
      request.logger = reqLogger;

      const response = await handler(request, ...args);

      const duration = Date.now() - startTime;

      reqLogger.info('Request completed', {
        statusCode: response.status,
        duration,
        contentLength: response.headers.get('content-length')
      });

      response.headers.set('x-request-id', requestId);

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      reqLogger.error('Request failed', error, {
        duration
      });

      throw error;
    }
  };
}

export function logProviderCall(provider, model, duration, success, error = null) {
  logger.info('Provider call', {
    provider,
    model,
    duration,
    success,
    error: error ? error.message : undefined
  });
}

export { StructuredLogger, LOG_LEVELS };