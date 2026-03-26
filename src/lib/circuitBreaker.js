class CircuitBreaker {
  constructor(provider, options = {}) {
    this.provider = provider;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.halfOpenMax = options.halfOpenMax || 3;

    this.state = 'CLOSED';
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

  reset() {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    this.lastFailureTime = null;
  }
}

const breakers = new Map();

export function getCircuitBreaker(provider, options = {}) {
  if (!breakers.has(provider)) {
    breakers.set(provider, new CircuitBreaker(provider, options));
  }
  return breakers.get(provider);
}

export async function callProviderWithCircuitBreaker(provider, operation, options = {}) {
  const breaker = getCircuitBreaker(provider, options);
  return breaker.execute(operation);
}

export function getAllBreakerStatuses() {
  const statuses = {};
  for (const [provider, breaker] of breakers.entries()) {
    statuses[provider] = breaker.getStatus();
  }
  return statuses;
}

export function resetAllBreakers() {
  for (const [, breaker] of breakers.entries()) {
    breaker.reset();
  }
  breakers.clear();
  console.log('[CircuitBreaker] All breakers reset');
}

export { CircuitBreaker };