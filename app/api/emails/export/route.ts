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
  const calendarType = searchParams.get("calendarType") || "";
  const company = searchParams.get("company") || "";
  const assignedUser = searchParams.get("assignedUser") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";

  const where: Prisma.EmailWhereInput = {};
  if (calendarType) where.calendarType = { contains: calendarType, mode: "insensitive" };
  if (company) where.companyName = { contains: company, mode: "insensitive" };
  if (assignedUser) where.assignedUser = { contains: assignedUser, mode: "insensitive" };
  if (dateFrom) where.receivedAt = { ...((where.receivedAt as any) || {}), gte: new Date(dateFrom) };
  if (dateTo) where.receivedAt = { ...((where.receivedAt as any) || {}), lte: new Date(dateTo + "T23:59:59") };

  const emails = await prisma.email.findMany({ where, orderBy: { receivedAt: "desc" } });

  const BOM = "\uFEFF";
  const headers = [
    "受信日時", "カレンダー種別", "会社名", "登録者", "メールアドレス",
    "電話番号", "予定日時", "予定終了", "URL", "予定追加ユーザー", "備考", "Q&A",
  ];

  const rows = emails.map((e) => {
    const qaStr = e.qaData
      ? (e.qaData as any[]).map((qa: any) => `${qa.q}: ${qa.a}`).join(" / ")
      : "";
    return [
      formatDate(e.receivedAt), e.calendarType, e.companyName,
      e.registrant || "", e.emailAddress || "", e.phoneNumber || "",
      formatDate(e.appointmentDatetime), e.appointmentEnd ? formatDate(e.appointmentEnd) : "",
      e.crowdCalendarUrl || "", e.assignedUser || "", e.note || "", qaStr,
    ].map(escapeCsv);
  });

  const csv = BOM + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");

  const now = new Date();
  const filename = `crowdcalendar_${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}_${String(now.getHours()).padStart(2, "0")}${String(now.getMinutes()).padStart(2, "0")}${String(now.getSeconds()).padStart(2, "0")}.csv`;

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}

function formatDate(date: Date): string {
  const d = new Date(date);
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function escapeCsv(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}