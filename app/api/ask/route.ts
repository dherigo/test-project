import { NextResponse } from "next/server";
import { handleAsk } from "@/lib/askApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    // 아래에서 BAD_REQUEST로 처리됩니다.
  }
  const result = await handleAsk(body);
  return NextResponse.json(result, { status: result.ok ? 200 : result.code === "BAD_REQUEST" ? 400 : 502 });
}
