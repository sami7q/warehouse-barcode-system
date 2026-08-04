/**
 * Brute-force protection for the credentials login (Section 2 of the audit).
 *
 * Simple in-memory attempt counter: after MAX_ATTEMPTS consecutive failures
 * for the same email, the account is locked out for LOCKOUT_MS. A successful
 * login clears the counter.
 *
 * Note: memory is per server instance. On Vercel this means the counter is
 * per-lambda-instance, which still blunts online guessing (attackers hit the
 * same warm instance) at this scale; a durable store (Turso table / KV) is
 * the upgrade path if stronger guarantees are ever needed.
 */

export const MAX_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60 * 1000; // 15 minutes
export const WINDOW_MS = 15 * 60 * 1000; // failures older than this are forgotten

type Entry = { count: number; firstFailureAt: number; lockedUntil: number };

const attempts = new Map<string, Entry>();

export function isLockedOut(email: string, now = Date.now()): boolean {
  const entry = attempts.get(email.toLowerCase());
  if (!entry) return false;
  if (entry.lockedUntil > now) return true;
  if (entry.lockedUntil !== 0 && entry.lockedUntil <= now) {
    // lockout expired — start fresh
    attempts.delete(email.toLowerCase());
    return false;
  }
  return false;
}

export function registerFailure(email: string, now = Date.now()): void {
  const key = email.toLowerCase();
  const entry = attempts.get(key);
  if (!entry || now - entry.firstFailureAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstFailureAt: now, lockedUntil: 0 });
    return;
  }
  entry.count += 1;
  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
}

export function registerSuccess(email: string): void {
  attempts.delete(email.toLowerCase());
}

/** Test-only. */
export function resetAllForTests(): void {
  attempts.clear();
}
