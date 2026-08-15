interface Bucket {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter {
  private buckets = new Map<string, Bucket>();

  isAllowed(key: string, maxRequests: number, windowMs: number): { allowed: boolean; resetAt: number } {
    const now = Date.now();
    let bucket = this.buckets.get(key);

    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 1, resetAt: now + windowMs };
      this.buckets.set(key, bucket);
      return { allowed: true, resetAt: bucket.resetAt };
    }

    if (bucket.count >= maxRequests) {
      return { allowed: false, resetAt: bucket.resetAt };
    }

    bucket.count += 1;
    return { allowed: true, resetAt: bucket.resetAt };
  }
}

const limiter = new InMemoryRateLimiter();

export function isRateAllowed(key: string, maxRequests: number, windowMs: number): boolean {
  return limiter.isAllowed(key, maxRequests, windowMs).allowed;
}
