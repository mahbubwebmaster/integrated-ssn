import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";

async function resolveAdminUser(request: Request) {
  let session = null;
  try {
    session = await auth();
  } catch {
    // Graceful fallback outside NextAuth request scope
  }

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({ where: { id: session.user.id } });
    if (user) return user;
  }

  // Allow header fallback strictly during non-production testing
  if (process.env.NODE_ENV !== "production") {
    const headerUserId = request.headers.get("x-user-id");
    if (headerUserId) {
      const user = await prisma.user.findUnique({ where: { id: headerUserId } });
      if (user) return user;
    }

    const headerEmail = request.headers.get("x-user-email");
    if (headerEmail) {
      const user = await prisma.user.findUnique({ where: { email: headerEmail.toLowerCase().trim() } });
      if (user) return user;
    }
  }

  return null;
}

export async function GET(request: Request) {
  try {
    const currentUser = await resolveAdminUser(request);
    const userRole = currentUser?.role;
    const isSuper = userRole === "SUPER_ADMIN";
    const isUpazila = userRole === "UPAZILA_ADMIN";

    if (!currentUser || (!isSuper && !isUpazila)) {
      return NextResponse.json(
        { success: false, error: "Access Denied: Only Super Admin and Upazila Admin can view user management." },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const roleParam = searchParams.get("role")?.trim() || "";
    let upazilaParam = searchParams.get("upazila")?.trim() || "";
    const departmentId = searchParams.get("departmentId")?.trim() || "";
    const statusParam = searchParams.get("status")?.trim() || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(200, parseInt(searchParams.get("limit") || "10", 10)));
    const exportAll = searchParams.get("all") === "true";

    // If UPAZILA_ADMIN, scope to their upazila
    const userUpazila = currentUser.upazilaName;
    if (isUpazila && userUpazila) {
      upazilaParam = userUpazila;
    }

    const whereClause: any = {};

    if (roleParam && roleParam !== "ALL") {
      if (roleParam === "DEPT_OFFICER") {
        whereClause.OR = [{ role: "DEPT_OFFICER" }, { role: "DEPARTMENT_OFFICER" }];
      } else {
        whereClause.role = roleParam;
      }
    }

    if (upazilaParam && upazilaParam !== "all" && upazilaParam !== "সমগ্র জেলা" && upazilaParam !== "সমগ্র নেত্রকোণা জেলা") {
      whereClause.upazilaName = upazilaParam;
    }

    if (departmentId && departmentId !== "ALL") {
      whereClause.departmentId = departmentId;
    }

    if (statusParam === "ACTIVE") {
      whereClause.isActive = true;
    } else if (statusParam === "INACTIVE") {
      whereClause.isActive = false;
    }

    if (search) {
      const searchConditions = [
        { name: { contains: search } },
        { email: { contains: search } },
        { designation: { contains: search } },
        { phone: { contains: search } },
        { unionName: { contains: search } },
        { upazilaName: { contains: search } },
      ];
      if (whereClause.OR) {
        whereClause.AND = [
          { OR: whereClause.OR },
          { OR: searchConditions },
        ];
        delete whereClause.OR;
      } else {
        whereClause.OR = searchConditions;
      }
    }

    const scopeWhere: any = {};
    if (upazilaParam && upazilaParam !== "all" && upazilaParam !== "সমগ্র জেলা" && upazilaParam !== "সমগ্র নেত্রকোণা জেলা") {
      scopeWhere.upazilaName = upazilaParam;
    }
    if (departmentId && departmentId !== "ALL") {
      scopeWhere.departmentId = departmentId;
    }
    if (search) {
      scopeWhere.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
        { designation: { contains: search } },
        { phone: { contains: search } },
        { unionName: { contains: search } },
        { upazilaName: { contains: search } },
      ];
    }

    const [total, upazilaAdminCount, deptOfficerCount, activeCount] = await Promise.all([
      prisma.user.count({ where: whereClause }),
      prisma.user.count({
        where: {
          ...scopeWhere,
          role: "UPAZILA_ADMIN",
        },
      }),
      prisma.user.count({
        where: {
          ...scopeWhere,
          role: { in: ["DEPT_OFFICER", "DEPARTMENT_OFFICER"] },
        },
      }),
      prisma.user.count({
        where: {
          ...scopeWhere,
          isActive: true,
        },
      }),
    ]);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const effectivePage = Math.min(page, totalPages);
    const skip = exportAll ? undefined : (effectivePage - 1) * limit;
    const take = exportAll ? undefined : limit;

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
      orderBy: [{ role: "asc" }, { upazilaName: "asc" }, { createdAt: "desc" }],
      ...(skip !== undefined ? { skip } : {}),
      ...(take !== undefined ? { take } : {}),
    });

    return NextResponse.json({
      success: true,
      users,
      total,
      stats: {
        total,
        upazilaAdmins: upazilaAdminCount,
        deptOfficers: deptOfficerCount,
        active: activeCount,
      },
      pagination: {
        total,
        page: effectivePage,
        limit,
        totalPages,
        hasNextPage: effectivePage < totalPages,
        hasPrevPage: effectivePage > 1,
      },
    });
  } catch (error: unknown) {
    console.error("Failed to fetch admin users:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await resolveAdminUser(request);
    const userRole = currentUser?.role;
    const isSuper = userRole === "SUPER_ADMIN";
    const isUpazila = userRole === "UPAZILA_ADMIN";

    if (!currentUser || (!isSuper && !isUpazila)) {
      return NextResponse.json(
        { success: false, error: "Access Denied: Only Super Admin and Upazila Admin can create new users." },
        { status: 403 }
      );
    }

    const userUpazila = currentUser.upazilaName;
    const body = await request.json();
    const { name, designation, email, password, role, departmentId, upazilaName, unionName, wardNo } = body;

    if (!name || !email || !role) {
      return NextResponse.json(
        { success: false, error: "Name, email and role are required." },
        { status: 400 }
      );
    }

    // Role restrictions for UPAZILA_ADMIN
    if (isUpazila && (role === "SUPER_ADMIN" || role === "DISTRICT_ADMIN" || role === "UPAZILA_ADMIN")) {
      return NextResponse.json(
        { success: false, error: "উপজেলা এডমিন শুধুমাত্র দপ্তর কর্মকর্তা বা ইউনিয়ন ভিউয়ার তৈরি করতে পারেন।" },
        { status: 403 }
      );
    }

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing) {
      return NextResponse.json(
        { success: false, error: "A user with this email address already exists." },
        { status: 409 }
      );
    }

    // Role specific requirements
    if (role === "DEPT_OFFICER" && !departmentId) {
      return NextResponse.json(
        { success: false, error: "Department assignment is required for Department Officers." },
        { status: 400 }
      );
    }

    const assignedUpazila = isUpazila ? userUpazila : (role === "DISTRICT_ADMIN" || role === "SUPER_ADMIN" ? null : (upazilaName || null));

    const created = await prisma.user.create({
      data: {
        name: name.trim(),
        designation: designation ? String(designation).trim() : (role === "DISTRICT_ADMIN" ? "জেলা প্রশাসক ও জেলা ম্যাজিস্ট্রেট" : null),
        email: email.trim().toLowerCase(),
        passwordHash: hashPassword(password || "admin123"),
        role,
        departmentId: role === "DEPT_OFFICER" ? (departmentId || null) : null,
        district: "নেত্রকোণা",
        districtName: "নেত্রকোণা",
        upazilaName: assignedUpazila,
        unionName: role === "UNION_VIEWER" ? (unionName || null) : null,
        wardNo: role === "UNION_VIEWER" ? (wardNo || null) : null,
        isActive: true,
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

    return NextResponse.json({
      success: true,
      message: "User account created successfully.",
      user: created,
    });
  } catch (error: unknown) {
    console.error("Failed to create user:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const currentUser = await resolveAdminUser(request);
    const userRole = currentUser?.role;
    const isSuper = userRole === "SUPER_ADMIN";
    const isUpazila = userRole === "UPAZILA_ADMIN";

    if (!currentUser || (!isSuper && !isUpazila)) {
      return NextResponse.json(
        { success: false, error: "Access Denied: Only Super Admin and Upazila Admin can manage users." },
        { status: 403 }
      );
    }

    const userUpazila = currentUser.upazilaName;
    const body = await request.json();
    const { userId, action, newPassword, name, designation, departmentId, upazilaName, unionName, role, isActive } = body;

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "Target userId is required." },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    // UPAZILA_ADMIN can only manage users in their own upazila and cannot manage SUPER_ADMIN
    if (isUpazila) {
      if (targetUser.role === "SUPER_ADMIN") {
        return NextResponse.json(
          { success: false, error: "উপজেলা এডমিন সুপার এডমিন অ্যাকাউন্টে পরিবর্তন করতে পারবেন না।" },
          { status: 403 }
        );
      }
      if (targetUser.upazilaName && userUpazila && targetUser.upazilaName !== userUpazila) {
        return NextResponse.json(
          { success: false, error: "আপনি শুধুমাত্র আপনার উপজেলার ইউজারদের পরিচালনা করতে পারেন।" },
          { status: 403 }
        );
      }
    }

    if (action === "reset_password") {
      if (!newPassword || String(newPassword).length < 6) {
        return NextResponse.json(
          { success: false, error: "Password must be at least 6 characters long." },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: hashPassword(String(newPassword)),
          password: null,
        },
      });

      return NextResponse.json({
        success: true,
        message: "পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে (Password reset successfully).",
      });
    }

    if (action === "update_details") {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          name: name !== undefined ? String(name).trim() : undefined,
          designation: designation !== undefined ? (designation ? String(designation).trim() : null) : undefined,
          departmentId: departmentId !== undefined ? departmentId : undefined,
          upazilaName: isSuper && upazilaName !== undefined ? upazilaName : undefined,
          unionName: unionName !== undefined ? unionName : undefined,
          role: isSuper && role !== undefined ? role : undefined,
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

      return NextResponse.json({
        success: true,
        message: "ইউজার তথ্য সফলভাবে আপডেট হয়েছে (User details updated).",
        user: updated,
      });
    }

    if (action === "toggle_active") {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          isActive: !targetUser.isActive,
        },
      });

      return NextResponse.json({
        success: true,
        message: `User is now ${updated.isActive ? "Active" : "Inactive"}.`,
        isActive: updated.isActive,
      });
    }

    return NextResponse.json(
      { success: false, error: "Unknown action specified." },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error("Failed to update user:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const currentUser = await resolveAdminUser(request);

    // Strict Role Enforcement: ONLY SUPER_ADMIN can delete users
    if (!currentUser || currentUser.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error:
            "অননুমোদিত অ্যাক্সেস: শুধুমাত্র সিস্টেম সুপার এডমিন (SUPER_ADMIN) ব্যবহারকারী মুছে ফেলতে পারেন। উপজেলা এডমিন বা অন্য কোনো রোলের ইউজার ডিলিট করার এখতিয়ার নেই (Forbidden: Only Super Admin can delete users).",
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const body = await request.json().catch(() => ({}));
    const userId = (body.userId || searchParams.get("userId") || searchParams.get("id") || "").trim();

    if (!userId) {
      return NextResponse.json(
        { success: false, error: "মুছে ফেলার জন্য ইউজার আইডি (userId) আবশ্যক।" },
        { status: 400 }
      );
    }

    // Safety: Super Admin cannot delete their own active account
    if (currentUser.id === userId) {
      return NextResponse.json(
        {
          success: false,
          error: "নিরাপত্তা সতর্কতা: আপনি আপনার নিজের সুপার এডমিন অ্যাকাউন্ট মুছে ফেলতে পারবেন না।",
        },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!targetUser) {
      return NextResponse.json(
        { success: false, error: "ব্যবহারকারী অ্যাকাউন্টটি খুঁজে পাওয়া যায়নি।" },
        { status: 404 }
      );
    }

    // Atomic deletion inside transaction with AuditLog
    await prisma.$transaction(async (tx) => {
      // Record in AuditLog
      await tx.auditLog.create({
        data: {
          userId: currentUser.id,
          actionType: "USER_DELETED",
          entityId: targetUser.id,
          details: `সুপার এডমিন (${currentUser.name}) কর্তৃক ব্যবহারকারী '${targetUser.name}' (ইমেইল: ${targetUser.email}, ভূমিকা: ${targetUser.role}, পদবি: ${targetUser.designation || "N/A"}) কে সিস্টেম থেকে মুছে ফেলা হয়েছে।`,
        },
      });

      // Delete target user
      await tx.user.delete({
        where: { id: userId },
      });
    });

    return NextResponse.json({
      success: true,
      message: `ব্যবহারকারী '${targetUser.name}' সফলভাবে মুছে ফেলা হয়েছে।`,
      deletedUserId: userId,
    });
  } catch (error: unknown) {
    console.error("Failed to delete user:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
