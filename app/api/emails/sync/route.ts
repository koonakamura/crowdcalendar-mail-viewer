import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncEmails } from "@/lib/gmail";

export async function POST() {
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
    const result = await syncEmails(accessToken, session.user?.email || "");
    return NextResponse.json({
      message: `同期完了: ${result.newCount}件の新規メールを取得しました（全${result.total}件中）`,
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