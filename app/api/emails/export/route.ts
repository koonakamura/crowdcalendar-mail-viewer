import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const calendarTypes = searchParams.get("calendarTypes")?.split(",").filter(Boolean) || [];
  const assignedUsers = searchParams.get("assignedUsers")?.split(",").filter(Boolean) || [];
  const company = searchParams.get("company") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const appointmentFrom = searchParams.get("appointmentFrom") || "";
  const appointmentTo = searchParams.get("appointmentTo") || "";

  const where: Prisma.EmailWhereInput = {};
  if (calendarTypes.length > 0) where.calendarType = { in: calendarTypes };
  if (assignedUsers.length > 0) where.assignedUser = { in: assignedUsers };
  if (company) where.companyName = { contains: company, mode: "insensitive" };
  if (dateFrom || dateTo) {
    where.receivedAt = {};
    if (dateFrom) (where.receivedAt as any).gte = new Date(dateFrom);
    if (dateTo) (where.receivedAt as any).lte = new Date(dateTo + "T23:59:59");
  }
  if (appointmentFrom || appointmentTo) {
    where.appointmentDatetime = {};
    if (appointmentFrom) (where.appointmentDatetime as any).gte = new Date(appointmentFrom);
    if (appointmentTo) (where.appointmentDatetime as any).lte = new Date(appointmentTo + "T23:59:59");
  }

  const emails = await prisma.email.findMany({
    where,
    orderBy: { receivedAt: "desc" },
  });

  function getQaValue(qaData: any, ...keys: string[]): string {
    if (!qaData || !Array.isArray(qaData)) return "";
    for (const key of keys) {
      const item = (qaData as any[]).find((qa: any) => qa.q && qa.q.includes(key));
      if (item) return item.a;
    }
    return "";
  }

  const BOM = "\uFEFF";
  const headers = [
    "受信日時",
    "カレンダー種別",
    "会社名",
    "予定日時",
    "予定終了",
    "予定追加ユーザー",
    "登録者",
    "メールアドレス",
    "電話番号",
    "先方参加者",
    "支援中のサービス",
    "取得者",
    "QAメールアドレス",
    "提案取得者所属",
    "先方連絡先",
    "課題・興味",
    "その他",
    "URL",
    "備考",
  ];

  const rows = emails.map((e) => {
    return [
      formatDateJST(e.receivedAt),
      e.calendarType,
      e.companyName,
      formatDateJST(e.appointmentDatetime),
      e.appointmentEnd ? formatDateJST(e.appointmentEnd) : "",
      e.assignedUser || "",
      e.registrant || "",
      e.emailAddress || "",
      e.phoneNumber || "",
      getQaValue(e.qaData, "先方参加者", "参加予定", "役職", "氏名"),
      getQaValue(e.qaData, "支援中のサービス", "現在提供している支援サービス"),
      getQaValue(e.qaData, "取得者", "面談調整"),
      getQaValue(e.qaData, "メールアドレスを教えて", "メールアドレス"),
      getQaValue(e.qaData, "提案取得者所属"),
      getQaValue(e.qaData, "先方連絡先", "ご連絡先"),
      getQaValue(e.qaData, "課題感", "興味"),
      getQaValue(e.qaData, "その他", "ご要望"),
      e.crowdCalendarUrl || "",
      e.note || "",
    ].map(escapeCsv);
  });

  const csv = BOM + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  const now = new Date();
  const filename = "crowdcalendar_" + now.getFullYear() + String(now.getMonth() + 1).padStart(2, "0") + String(now.getDate()).padStart(2, "0") + "_" + String(now.getHours()).padStart(2, "0") + String(now.getMinutes()).padStart(2, "0") + String(now.getSeconds()).padStart(2, "0") + ".csv";

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=\"" + filename + "\"",
    },
  });
}

function formatDateJST(date: Date): string {
  const jst = new Date(new Date(date).getTime() + 9 * 60 * 60 * 1000);
  const y = jst.getUTCFullYear();
  const m = String(jst.getUTCMonth() + 1).padStart(2, "0");
  const d = String(jst.getUTCDate()).padStart(2, "0");
  const h = String(jst.getUTCHours()).padStart(2, "0");
  const min = String(jst.getUTCMinutes()).padStart(2, "0");
  return y + "/" + m + "/" + d + " " + h + ":" + min;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}
