import { NextRequest, NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { auth } from "@/auth";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { getVapidPublicKey, isAllowedPushEndpoint } from "@/lib/push";

export const dynamic = "force-dynamic";

const subscriptionSchema = z.object({
  endpoint: z
    .string()
    .max(2048)
    .refine(isAllowedPushEndpoint, "خدمة إشعارات غير معروفة"),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const unsubscribeSchema = z.object({ endpoint: z.string().min(1).max(2048) });

/** GET /api/push — the VAPID public key the browser subscribes with. */
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const publicKey = getVapidPublicKey();
  if (!publicKey) {
    return NextResponse.json(
      { error: "الإشعارات غير مهيأة على الخادم" },
      { status: 503 },
    );
  }
  return NextResponse.json({ publicKey });
}

/**
 * POST /api/push — save this device's push subscription for the signed-in
 * user. Upserts on endpoint, so re-sending the same subscription (done on
 * every page load) just re-binds it to whoever is logged in now.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!session?.user || !Number.isInteger(userId)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "جسم الطلب غير صالح" }, { status: 400 });
  }
  const parsed = subscriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "اشتراك غير صالح" }, { status: 400 });
  }

  const { endpoint, keys } = parsed.data;
  await getDb()
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      createdAt: Date.now(),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: keys.p256dh, auth: keys.auth },
    });
  return NextResponse.json({ ok: true }, { status: 201 });
}

/** DELETE /api/push — forget this device (e.g. on logout). */
export async function DELETE(req: NextRequest) {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!session?.user || !Number.isInteger(userId)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "جسم الطلب غير صالح" }, { status: 400 });
  }
  const parsed = unsubscribeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "اشتراك غير صالح" }, { status: 400 });
  }
  await getDb()
    .delete(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.endpoint, parsed.data.endpoint),
        eq(pushSubscriptions.userId, userId),
      ),
    );
  return NextResponse.json({ ok: true });
}
