import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const email = await prisma.email.findUnique({
    where: { id: parseInt(id) },
  });

  if (!email) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(email);
}