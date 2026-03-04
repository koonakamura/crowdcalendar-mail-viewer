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
        id: true, gmailMessageId: true, receivedAt: true,
        calendarType: true, companyName: true, registrant: true,
        emailAddress: true, phoneNumber: true,
        appointmentDatetime: true, appointmentEnd: true,
        crowdCalendarUrl: true, assignedUser: true, note: true, qaData: true,
      },
    }),
    prisma.email.count({ where }),
  ]);

  const [calendarTypes, assignedUsers] = await Promise.all([
    prisma.email.findMany({
      distinct: ["calendarType"], select: { calendarType: true },
      orderBy: { calendarType: "asc" },
    }),
    prisma.email.findMany({
      distinct: ["assignedUser"], select: { assignedUser: true },
      where: { assignedUser: { not: null } }, orderBy: { assignedUser: "asc" },
    }),
  ]);

  return NextResponse.json({
    emails, totalCount, page, perPage,
    totalPages: Math.ceil(totalCount / perPage),
    filters: {
      calendarTypes: calendarTypes.map((c) => c.calendarType),
      assignedUsers: assignedUsers.map((u) => u.assignedUser).filter(Boolean),
    },
  });
}