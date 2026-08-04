import { isBusyError } from "./db-errors";

/**
 * Write-safety for product creation (audit Section 3, "real concurrency"):
 * SQLite/libSQL is single-writer, so genuinely parallel insert+update
 * transactions can collide with SQLITE_BUSY. Creation requests are
 * serialized per server instance, and the transaction retries with backoff
 * if the database is still busy (e.g. writes from another instance).
 *
 * Barcode *logical* uniqueness never depends on this: each barcode derives
 * from the row's unique AUTOINCREMENT id, and the column has a UNIQUE index.
 */

let chain: Promise<unknown> = Promise.resolve();

export function serialized<T>(fn: () => Promise<T>): Promise<T> {
  const run = () => fn();
  const next = chain.then(run, run);
  chain = next.catch(() => {
    // keep the chain alive after failures
  });
  return next;
}

const MAX_RETRIES = 5;
const BACKOFF_BASE_MS = 40;

export async function withBusyRetry<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isBusyError(err)) throw err;
      lastError = err;
      await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * (attempt + 1)));
    }
  }
  throw lastError;
}
