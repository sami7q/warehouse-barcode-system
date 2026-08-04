/**
 * Drizzle wraps driver errors in DrizzleQueryError; the SQLite message
 * ("UNIQUE constraint failed") lives down the `cause` chain.
 */
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 10; depth++) {
    if (String(current).includes("UNIQUE constraint failed")) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
