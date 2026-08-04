/**
 * Drizzle wraps driver errors in DrizzleQueryError; the SQLite message
 * ("UNIQUE constraint failed") lives down the `cause` chain.
 */
export function isUniqueViolation(err: unknown): boolean {
  return causeChainIncludes(err, ["UNIQUE constraint failed"]);
}

/** SQLite/libSQL single-writer contention (SQLITE_BUSY / locked). */
export function isBusyError(err: unknown): boolean {
  return causeChainIncludes(err, [
    "SQLITE_BUSY",
    "database is locked",
    "database table is locked",
  ]);
}

function causeChainIncludes(err: unknown, needles: string[]): boolean {
  let current: unknown = err;
  for (let depth = 0; current && depth < 10; depth++) {
    const text = String(current);
    if (needles.some((n) => text.includes(n))) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
