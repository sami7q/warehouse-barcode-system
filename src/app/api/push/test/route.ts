import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { sendTestPush } from "@/lib/push";

export const dynamic = "force-dynamic";

/**
 * POST /api/push/test — send a test notification to the caller's own
 * subscribed devices only (never anyone else's), so an employee can check
 * that their phone actually rings.
 */
export async function POST() {
  const session = await auth();
  const userId = Number(session?.user?.id);
  if (!session?.user || !Number.isInteger(userId)) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }
  const sent = await sendTestPush(userId);
  if (sent === null) {
    return NextResponse.json(
      { error: "الإشعارات غير مهيأة على الخادم" },
      { status: 503 },
    );
  }
  if (sent === 0) {
    return NextResponse.json(
      { error: "لا يوجد جهاز مفعّل لهذا الحساب — فعّل الإشعارات أولاً" },
      { status: 409 },
    );
  }
  return NextResponse.json({ sent });
}
