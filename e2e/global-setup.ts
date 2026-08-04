import fs from "node:fs";
import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import bcrypt from "bcryptjs";
import * as schema from "../src/db/schema";
import { ADMIN_EMAIL, ADMIN_PASSWORD } from "./credentials";

/** Fresh throwaway DB (e2e.db) with the admin login seeded. */
export default async function globalSetup() {
  const dbFile = path.join(process.cwd(), "e2e.db");
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    try {
      fs.rmSync(dbFile + suffix);
    } catch {
      // not present — fine
    }
  }

  const client = createClient({ url: `file:${dbFile.replace(/\\/g, "/")}` });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: "./drizzle" });

  await db.insert(schema.users).values({
    email: ADMIN_EMAIL,
    passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 10),
    role: "admin",
    createdAt: Date.now(),
  });

  client.close();
}
