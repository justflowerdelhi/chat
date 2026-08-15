type CacheValue = { value: unknown; expiresAt: number };

class MemoryCache {
  private store = new Map<string, CacheValue>();

  get<T>(key: string): T | undefined {
    const entry = this.store.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }
    return entry.value as T;
  }

  set(key: string, value: unknown, ttlMs: number): void {
    this.store.set(key, { value, expiresAt: Date.now() + ttlMs });
  }

  remove(key: string): void {
    this.store.delete(key);
  }

  removePattern(pattern: (key: string) => boolean): void {
    for (const [key] of this.store) {
      if (pattern(key)) this.store.delete(key);
    }
  }
}

const cache = new MemoryCache();

export async function getOrSet<T>(
  key: string,
  factory: () => Promise<T>,
  ttlMs = 60000
): Promise<T> {
  const existing = cache.get<T>(key);
  if (existing !== undefined) return existing;

  const value = await factory();
  cache.set(key, value, ttlMs);
  return value;
}

export function invalidateCache(pattern: (key: string) => boolean): void {
  cache.removePattern(pattern);
}

export function cacheKey(prefix: string, id: string | number): string {
  return `${prefix}:${id}`;
}
