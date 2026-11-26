import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultMasterData } from "@/lib/seed";
import { hashPassword } from "@/lib/password";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const userRole = session.user.role;
    if (userRole !== "SUPER_ADMIN" && userRole !== "UPAZILA_ADMIN") {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত: শুধুমাত্র সুপার অ্যাডমিন বা উপজেলা অ্যাডমিন ইউজার তালিকা দেখতে পারেন (Forbidden)" },
        { status: 403 }
      );
    }

    await ensureDefaultMasterData();

    const whereClause =
      userRole === "UPAZILA_ADMIN" && (session.user as any).upazilaName
        ? { upazilaName: (session.user as any).upazilaName }
        : {};

    const users = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        designation: true,
        email: true,
        role: true,
        phone: true,
        phoneVerified: true,
        image: true,
        isEmailVerified: true,
        departmentId: true,
        district: true,
        upazilaName: true,
        unionName: true,
        wardNo: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: true,
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ success: true, users });
  } catch (error: unknown) {
    console.error("Failed to fetch users:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    if (session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত: শুধুমাত্র সুপার অ্যাডমিন ইউজার তৈরি করতে পারেন (Forbidden: Super Admin only)" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, designation, email, role, departmentId, district, upazilaName, unionName, wardNo, password, isActive } = body;

    if (!name || !email || !role || !password || String(password).length < 6) {
      return NextResponse.json(
        { success: false, error: "Name, email, role, and a password (min 6 characters) are required." },
        { status: 400 }
      );
    }

    const created = await prisma.user.create({
      data: {
        name: name.trim(),
        designation: designation ? String(designation).trim() : null,
        email: email.trim().toLowerCase(),
        passwordHash: hashPassword(String(password)),
        role,
        departmentId: departmentId || null,
        district: district || "নেত্রকোণা",
        upazilaName: upazilaName || null,
        unionName: unionName || null,
        wardNo: wardNo || null,
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      },
      select: {
        id: true,
        name: true,
        designation: true,
        email: true,
        role: true,
        phone: true,
        phoneVerified: true,
        image: true,
        isEmailVerified: true,
        departmentId: true,
        district: true,
        upazilaName: true,
        unionName: true,
        wardNo: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        department: true,
      },
    });

    return NextResponse.json({ success: true, user: created });
  } catch (error: unknown) {
    console.error("Failed to create user:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
