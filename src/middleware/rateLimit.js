const rateLimitStore = new Map();

const LIMITS = {
  login: { points: 5, duration: 15 * 60 * 1000 },
  api: { points: 100, duration: 60 * 1000 },
  default: { points: 60, duration: 60 * 1000 },
};

function cleanupExpired(key) {
  const record = rateLimitStore.get(key);
  if (!record) return;

  const now = Date.now();
  if (now > record.resetTime) {
    rateLimitStore.delete(key);
  }
}

export function rateLimit(limiterName = 'default') {
  return async (req) => {
    const limit = LIMITS[limiterName] || LIMITS.default;
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() 
      || req.headers.get('x-real-ip') 
      || 'unknown';
    const key = `${limiterName}:${ip}`;

    cleanupExpired(key);

    const record = rateLimitStore.get(key) || {
      points: limit.points,
      resetTime: Date.now() + limit.duration,
      blockedUntil: null,
    };

    if (record.blockedUntil && Date.now() < record.blockedUntil) {
      const retryAfter = Math.ceil((record.blockedUntil - Date.now()) / 1000);
      return new Response(
        JSON.stringify({ error: 'Too many requests', retryAfter }),
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'Content-Type': 'application/json'
          }
        }
      );
    }

    if (record.points <= 0) {
      record.blockedUntil = record.resetTime;
      rateLimitStore.set(key, record);
      const retryAfter = Math.ceil((record.resetTime - Date.now()) / 1000);
      return new Response(
        JSON.stringify({ error: 'Too many requests', retryAfter }),
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'Content-Type': 'application/json'
          }
        }
      );
    }

    record.points--;
    rateLimitStore.set(key, record);

    return null;
  };
}

export async function checkRateLimit(key, limit = LIMITS.default) {
  cleanupExpired(key);

  const record = rateLimitStore.get(key) || {
    points: limit.points,
    resetTime: Date.now() + limit.duration,
  };

  if (record.points <= 0) {
    return {
      allowed: false,
      remaining: 0,
      resetTime: record.resetTime,
    };
  }

  record.points--;
  rateLimitStore.set(key, record);

  return {
    allowed: true,
    remaining: record.points,
    resetTime: record.resetTime,
  };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, record] of rateLimitStore.entries()) {
    if (now > record.resetTime) {
      rateLimitStore.delete(key);
    }
  }
}, 60 * 1000);