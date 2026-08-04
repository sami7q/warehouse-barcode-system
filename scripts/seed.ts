/**
 * One-time seed: creates the first admin login from ADMIN_EMAIL / ADMIN_PASSWORD.
 * Run with: npm run seed
 */
import "dotenv/config";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import * as schema from "../src/db/schema";

async function main() {
  const url = process.env.TURSO_DATABASE_URL;
  if (!url) throw new Error("TURSO_DATABASE_URL is not set");

  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error("ADMIN_EMAIL and ADMIN_PASSWORD must be set in the environment");
  }

  const client = createClient({
    url,
    authToken: process.env.TURSO_AUTH_TOKEN || undefined,
  });
  const db = drizzle(client, { schema });

  await migrate(db, { migrationsFolder: "./drizzle" });

  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await db.query.users.findFirst({
    where: eq(schema.users.email, email),
  });

  if (existing) {
    await db
      .update(schema.users)
      .set({ passwordHash })
      .where(eq(schema.users.id, existing.id));
    console.log(`Admin user updated: ${email}`);
  } else {
    await db.insert(schema.users).values({
      email,
      passwordHash,
      role: "admin",
      createdAt: Date.now(),
    });
    console.log(`Admin user created: ${email}`);
  }

  client.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
