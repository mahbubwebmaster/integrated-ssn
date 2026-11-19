import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    // Strictly restricted to SUPER_ADMIN
    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "অননুমোদিত: অডিট ট্রেইল শুধুমাত্র সুপার অ্যাডমিনের জন্য সংরক্ষিত (Forbidden: Audit logs are strictly restricted to Super Admin).",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const actionType = searchParams.get("actionType");
    const search = searchParams.get("search")?.toLowerCase().trim();

    const where: any = {};

    if (actionType && actionType !== "ALL") {
      where.actionType = actionType;
    }

    if (search) {
      where.OR = [
        { details: { contains: search } },
        { actionType: { contains: search } },
        { entityId: { contains: search } },
        { user: { name: { contains: search } } },
        { user: { email: { contains: search } } },
      ];
    }

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });

    return NextResponse.json({ success: true, logs });
  } catch (error: unknown) {
    if (error && typeof error === "object" && (error as any).digest === "HANGING_PROMISE_REJECTION") {
      throw error;
    }
    console.error("Failed to fetch audit logs:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
