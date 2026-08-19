import { NextRequest, NextResponse } from "next/server";
import { desc } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { employeeCreateSchema } from "@/lib/validation";
import { isUniqueViolation } from "@/lib/db-errors";

export const dynamic = "force-dynamic";

const BCRYPT_COST = 10;

/**
 * GET /api/users — admin-only. Lists employee accounts (never the admin
 * row, never password_hash).
 */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "هذا الإجراء متاح للمدير فقط" },
      { status: 403 },
    );
  }

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return NextResponse.json({ users: rows.filter((u) => u.role !== "admin") });
}

/**
 * POST /api/users — admin-only. Creates a read-only employee login. Role is
 * always hardcoded to "employee" here — admin accounts are never created
 * through this endpoint, only via the one-time seed script.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  if (session.user.role !== "admin") {
    return NextResponse.json(
      { error: "هذا الإجراء متاح للمدير فقط" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "جسم الطلب غير صالح" }, { status: 400 });
  }

  const parsed = employeeCreateSchema.safeParse(body);
  if (!parsed.success) {
    const message =
      parsed.error.issues[0]?.message ?? "البيانات المدخلة غير صالحة";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const { email, password } = parsed.data;
  const db = getDb();
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  try {
    const [created] = await db
      .insert(users)
      .values({
        email,
        passwordHash,
        role: "employee",
        createdAt: Date.now(),
      })
      .returning({
        id: users.id,
        email: users.email,
        role: users.role,
        createdAt: users.createdAt,
      });
    return NextResponse.json({ user: created }, { status: 201 });
  } catch (err) {
    if (isUniqueViolation(err)) {
      return NextResponse.json(
        { error: "هذا البريد الإلكتروني مستخدم بالفعل" },
        { status: 409 },
      );
    }
    throw err;
  }
}
