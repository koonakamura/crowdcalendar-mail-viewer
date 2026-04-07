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
  const page = parseInt(searchParams.get("page") || "1");
  const perPage = parseInt(searchParams.get("perPage") || "100");
  const sortBy = searchParams.get("sortBy") || "receivedAt";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

  // フィルター（カンマ区切り対応）
  const calendarTypes = searchParams.get("calendarTypes")?.split(",").filter(Boolean) || [];
  const assignedUsers = searchParams.get("assignedUsers")?.split(",").filter(Boolean) || [];
  const company = searchParams.get("company") || "";
  const dateFrom = searchParams.get("dateFrom") || "";
  const dateTo = searchParams.get("dateTo") || "";
  const appointmentFrom = searchParams.get("appointmentFrom") || "";
  const appointmentTo = searchParams.get("appointmentTo") || "";
  const services = searchParams.get("services")?.split(",").filter(Boolean) || [];
  const departments = searchParams.get("departments")?.split(",").filter(Boolean) || [];
  const subjectContains = searchParams.get("subjectContains") || "";

  const where: Prisma.EmailWhereInput = {};

  // マルチセレクトフィルタ: OR条件で複数値に対応
  if (calendarTypes.length > 0) {
    where.calendarType = { in: calendarTypes };
  }
  if (assignedUsers.length > 0) {
    where.assignedUser = { in: assignedUsers };
  }
  if (company) {
    where.companyName = { contains: company, mode: "insensitive" };
  }
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
  if (subjectContains) {
    where.subject = { contains: subjectContains, mode: "insensitive" };
  }

  // サービス・所属フィルタ (QAデータ内のJSONをパス指定で検索)
  if (services.length > 0 || departments.length > 0) {
    const andConditions: Prisma.EmailWhereInput[] = [];
    for (const svc of services) {
      andConditions.push({
        rawBody: { contains: svc, mode: "insensitive" },
      });
    }
    for (const dept of departments) {
      andConditions.push({
        rawBody: { contains: dept, mode: "insensitive" },
      });
    }
    where.AND = andConditions;
  }

  const sortFieldMap: Record<string, string> = {
    receivedAt: "receivedAt", calendarType: "calendarType",
    companyName: "companyName", appointmentDatetime: "appointmentDatetime",
    assignedUser: "assignedUser",
  };
  const orderByField = sortFieldMap[sortBy] || "receivedAt";

  const [emails, totalCount] = await Promise.all([
    prisma.email.findMany({
      where, orderBy: { [orderByField]: sortOrder },
      skip: (page - 1) * perPage, take: perPage,
      select: {
        id: true, gmailMessageId: true, receivedAt: true, subject: true,
        calendarType: true, companyName: true, registrant: true,
        emailAddress: true, phoneNumber: true,
        appointmentDatetime: true, appointmentEnd: true,
        crowdCalendarUrl: true, assignedUser: true, note: true, qaData: true,
      },
    }),
    prisma.email.count({ where }),
  ]);

  // フィルタ選択肢を取得（全データから）
  const [calendarTypeOptions, assignedUserOptions] = await Promise.all([
    prisma.email.findMany({
      distinct: ["calendarType"], select: { calendarType: true },
      orderBy: { calendarType: "asc" },
    }),
    prisma.email.findMany({
      distinct: ["assignedUser"], select: { assignedUser: true },
      where: { assignedUser: { not: null } }, orderBy: { assignedUser: "asc" },
    }),
  ]);

  // QAデータからサービス・所属の選択肢を抽出
  const allQaEmails = await prisma.email.findMany({
    select: { qaData: true },
    where: { qaData: { not: Prisma.DbNull } },
  });

  const servicesSet = new Set<string>();
  const departmentsSet = new Set<string>();
  for (const e of allQaEmails) {
    const qa = e.qaData as { q: string; a: string }[] | null;
    if (!qa) continue;
    for (const item of qa) {
      if (item.q.includes("支援中のサービス") || item.q.includes("現在提供している支援サービス")) {
        if (item.a) servicesSet.add(item.a);
      }
      if (item.q.includes("提案取得者所属")) {
        if (item.a) departmentsSet.add(item.a);
      }
    }
  }

  // 同期ステータス
  const syncStatus = await prisma.syncStatus.findFirst({
    orderBy: { lastSyncedAt: "desc" },
  });
  const totalEmails = await prisma.email.count();

  return NextResponse.json({
    emails, totalCount, page, perPage,
    totalPages: Math.ceil(totalCount / perPage),
    filters: {
      calendarTypes: calendarTypeOptions.map((c) => c.calendarType),
      assignedUsers: assignedUserOptions.map((u) => u.assignedUser).filter(Boolean),
      services: [...servicesSet].sort(),
      departments: [...departmentsSet].sort(),
    },
    syncInfo: {
      lastSyncedAt: syncStatus?.lastSyncedAt || null,
      totalEmails,
    },
  });
}
