import "server-only";

/** Small in-memory limiter for login attempts (per server instance). */
const hits = new Map<string, { count: number; first: number; lockedUntil?: number }>();

export function checkLock(key: string) {
  const h = hits.get(key);
  if (h?.lockedUntil && h.lockedUntil > Date.now()) return Math.ceil((h.lockedUntil - Date.now()) / 60000);
  return 0;
}

export function recordFailure(key: string, max = 5, windowMs = 15 * 60_000, lockMs = 15 * 60_000) {
  const now = Date.now();
  const h = hits.get(key);
  if (!h || now - h.first > windowMs) { hits.set(key, { count: 1, first: now }); return max - 1; }
  h.count++;
  if (h.count >= max) h.lockedUntil = now + lockMs;
  return Math.max(0, max - h.count);
}

export function clearFailures(key: string) { hits.delete(key); }
