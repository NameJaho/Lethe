type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function rateLimitConfig() {
  const maxAttempts = Number.parseInt(process.env.RATE_LIMIT_MAX_ATTEMPTS ?? "8", 10);
  const windowSeconds = Number.parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS ?? "600", 10);

  return {
    maxAttempts: Number.isFinite(maxAttempts) && maxAttempts > 0 ? maxAttempts : 8,
    windowMs:
      Number.isFinite(windowSeconds) && windowSeconds > 0 ? windowSeconds * 1000 : 600000
  };
}

export function checkRateLimit(key: string) {
  const now = Date.now();
  const { maxAttempts, windowMs } = rateLimitConfig();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const bucket = { count: 1, resetAt: now + windowMs };
    buckets.set(key, bucket);

    return {
      allowed: true,
      remaining: maxAttempts - 1,
      retryAfterSeconds: Math.ceil(windowMs / 1000)
    };
  }

  existing.count += 1;

  if (existing.count > maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    };
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxAttempts - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  };
}
