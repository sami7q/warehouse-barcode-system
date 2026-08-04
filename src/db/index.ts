import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | null = null;

/**
 * Lazily create the Drizzle client from env. Lazy so that tests can point
 * TURSO_DATABASE_URL at a throwaway file before first use.
 */
export function getDb(): Db {
  if (!_db) {
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) {
      throw new Error("TURSO_DATABASE_URL is not set");
    }
    const client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
    _db = drizzle(client, { schema });
  }
  return _db;
}

/** Test-only: drop the cached client so a new env URL takes effect. */
export function resetDbForTests() {
  _db = null;
}
