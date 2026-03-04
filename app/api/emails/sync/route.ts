import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncEmails } from "@/lib/gmail";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accessToken = (session as any).accessToken;
  if (!accessToken) {
    return NextResponse.json(
      { error: "No access token. Please re-login." },
      { status: 401 }
    );
  }

  try {
    const url = new URL(request.url);
    const resync = url.searchParams.get("resync") === "true";

    if (resync) {
      await prisma.email.deleteMany({});
      await prisma.syncStatus.deleteMany({});
    }

    const result = await syncEmails(accessToken, session.user?.email || "");
    const msg = resync
      ? `再同期完了: ${result.newCount}件のメールを取得しました`
      : `同期完了: ${result.newCount}件の新規メールを取得しました（全${result.total}件中）`;
    return NextResponse.json({
      message: msg,
      ...result,
    });
  } catch (error: any) {
    console.error("Sync error:", error);
    return NextResponse.json(
      { error: "同期に失敗しました: " + error.message },
      { status: 500 }
    );
  }
}