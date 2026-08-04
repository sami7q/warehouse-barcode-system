import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { renderBarcodeSvg } from "@/lib/barcode-svg";

export const dynamic = "force-dynamic";

/**
 * GET /api/barcode?text=... — render any text as a barcode SVG
 * (EAN-13 for valid 13-digit input, Code 128 otherwise).
 * Used by the "صانع باركود" tab and label previews.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "غير مصرح" }, { status: 401 });
  }

  const text = req.nextUrl.searchParams.get("text")?.trim();
  if (!text) {
    return NextResponse.json({ error: "أدخل نصاً للباركود" }, { status: 400 });
  }

  try {
    const svg = renderBarcodeSvg(text);
    return new NextResponse(svg, {
      headers: { "Content-Type": "image/svg+xml", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json(
      { error: "تعذر توليد الباركود من هذا النص" },
      { status: 400 },
    );
  }
}
