import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId");
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.toLowerCase().trim();

    const userRole = session.user.role;
    const userDeptId = session.user.departmentId;

    const where: any = {};

    // DEPT_OFFICER sees batches for their department
    if (userRole === "DEPT_OFFICER" || userRole === "DEPARTMENT_OFFICER") {
      if (userDeptId) {
        where.departmentId = userDeptId;
      }
    } else if (departmentId && departmentId !== "ALL") {
      where.departmentId = departmentId;
    }

    if (status && status !== "ALL") {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { batchCode: { contains: search } },
        { fileName: { contains: search } },
        { scheme: { name: { contains: search } } },
        { scheme: { nameBn: { contains: search } } },
        { department: { name: { contains: search } } },
        { department: { nameBn: { contains: search } } },
        { uploadedByUser: { name: { contains: search } } },
      ];
    }

    const batches = await prisma.uploadBatch.findMany({
      where,
      include: {
        department: true,
        scheme: true,
        uploadedByUser: {
          select: {
            id: true,
            name: true,
            email: true,
            designation: true,
            role: true,
          },
        },
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ success: true, batches });
  } catch (error: unknown) {
    if (error && typeof error === "object" && (error as any).digest === "HANGING_PROMISE_REJECTION") {
      throw error;
    }
    console.error("Failed to fetch batches:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
