import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * Helper to resolve the authenticated user from NextAuth session,
 * custom auth headers, or query/body parameters.
 */
async function resolveUser(request: Request, bodyUserId?: string) {
  let session = null;
  try {
    session = await auth();
  } catch {
    // Ignore when executed outside active Next.js request context
  }

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: { department: true },
    });
    if (user) return user;
  }

  // Fallback to headers or explicit parameter (e.g. during testing/impersonation)
  const headerUserId =
    request.headers.get("x-user-id") ||
    bodyUserId ||
    new URL(request.url).searchParams.get("userId");

  if (headerUserId) {
    const user = await prisma.user.findUnique({
      where: { id: headerUserId },
      include: { department: true },
    });
    if (user) return user;
  }

  const headerEmail =
    request.headers.get("x-user-email") ||
    new URL(request.url).searchParams.get("userEmail");

  if (headerEmail) {
    const user = await prisma.user.findUnique({
      where: { email: headerEmail.toLowerCase().trim() },
      include: { department: true },
    });
    if (user) return user;
  }

  return null;
}

/**
 * 2. GET /api/removal-requests:
 *    - UPAZILA_ADMIN sees all requests across all departments (filterable by PENDING, APPROVED, REJECTED).
 *    - DEPT_OFFICER sees only requests submitted by their department.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status")?.trim().toUpperCase();
    const deptParam = searchParams.get("departmentId")?.trim();
    const upazilaParam = searchParams.get("upazila")?.trim();

    const currentUser = await resolveUser(request);

    // Build where clause based on role scoping
    const where: any = {};

    if (currentUser) {
      if (currentUser.role === "DEPT_OFFICER" || currentUser.role === "DEPARTMENT_OFFICER") {
        // Scoped strictly to officer's own department
        if (currentUser.departmentId) {
          where.departmentId = currentUser.departmentId;
        } else {
          return NextResponse.json({ success: true, requests: [] });
        }
        // Scoped to officer's upazila if assigned
        if (currentUser.upazilaName) {
          where.OR = [
            { upazilaName: currentUser.upazilaName },
            { beneficiary: { upazilaName: currentUser.upazilaName } },
          ];
        }
      } else if (currentUser.role === "UPAZILA_ADMIN") {
        // UNO is strictly scoped to their own Upazila
        if (currentUser.upazilaName) {
          where.OR = [
            { upazilaName: currentUser.upazilaName },
            { beneficiary: { upazilaName: currentUser.upazilaName } },
          ];
        }
        if (deptParam) {
          where.departmentId = deptParam;
        }
      } else if (currentUser.role === "SUPER_ADMIN") {
        // DC can view all upazilas or filter by a specific upazila
        if (upazilaParam && upazilaParam !== "all" && upazilaParam !== "সমগ্র জেলা") {
          where.OR = [
            { upazilaName: upazilaParam },
            { beneficiary: { upazilaName: upazilaParam } },
          ];
        }
        if (deptParam) {
          where.departmentId = deptParam;
        }
      } else if (currentUser.role === "UNION_VIEWER") {
        // Union viewer is restricted to their union's beneficiaries
        if (currentUser.unionName) {
          where.beneficiary = { unionName: currentUser.unionName };
        } else {
          return NextResponse.json({ success: true, requests: [] });
        }
      }
    } else {
      if (deptParam) {
        where.departmentId = deptParam;
      }
      if (upazilaParam && upazilaParam !== "all") {
        where.OR = [
          { upazilaName: upazilaParam },
          { beneficiary: { upazilaName: upazilaParam } },
        ];
      }
    }

    // Status filter (PENDING, APPROVED, REJECTED)
    if (statusParam && ["PENDING", "APPROVED", "REJECTED"].includes(statusParam)) {
      where.status = statusParam;
    }

    const requests = await prisma.removalRequest.findMany({
      where,
      include: {
        enrollment: {
          include: {
            scheme: {
              include: { department: true },
            },
            beneficiary: true,
          },
        },
        beneficiary: {
          include: {
            enrollments: {
              include: {
                scheme: {
                  include: { department: true },
                },
              },
              orderBy: { startDate: "desc" },
            },
          },
        },
        department: true,
        requestedByUser: {
          select: {
            id: true,
            name: true,
            designation: true,
            email: true,
            role: true,
            departmentId: true,
          },
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            designation: true,
            email: true,
            role: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    // Provide friendly alias compatibility for existing components
    const mapped = requests.map((r) => ({
      ...r,
      reason: r.requestReason,
      requestedBy: r.requestedByUser,
      reviewedBy: r.reviewedByUser?.name || null,
    }));

    return NextResponse.json({ success: true, requests: mapped });
  } catch (error: unknown) {
    console.error("Failed to fetch removal requests:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * 1. POST /api/removal-requests (Create Request):
 *    - Strictly allow ONLY DEPT_OFFICER. Reject SUPER_ADMIN and UPAZILA_ADMIN with 403 Forbidden.
 *    - Verify that the target enrollmentId belongs to the logged-in officer's own departmentId and is currently Active.
 *    - Create a RemovalRequest with status "PENDING" and log "REMOVAL_REQUESTED" in AuditLog.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const { enrollmentId, requestedByUserId } = body;
    const requestReason = (body.requestReason || body.reason || "").trim();

    // 1. Resolve logged-in officer
    const officer = await resolveUser(request, requestedByUserId);

    if (!officer) {
      return NextResponse.json(
        {
          success: false,
          error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন (Unauthorized. Please log in).",
        },
        { status: 401 }
      );
    }

    // 2. Strict Role Enforcement: Allow ONLY DEPT_OFFICER. Reject SUPER_ADMIN and UPAZILA_ADMIN with 403.
    const isDeptOfficer =
      officer.role === "DEPT_OFFICER" || officer.role === "DEPARTMENT_OFFICER";

    if (!isDeptOfficer) {
      return NextResponse.json(
        {
          success: false,
          error:
            "অননুমোদিত: শুধুমাত্র সংশ্লিষ্ট দপ্তর কর্মকর্তা ভাতা বাদ দেওয়ার জন্য আবেদন করতে পারবেন। সুপার এডমিন বা উপজেলা এডমিনের আবেদন করার এখতিয়ার নেই (Forbidden: Only Department Officers can create removal requests).",
        },
        { status: 403 }
      );
    }

    // Validate inputs
    if (!enrollmentId) {
      return NextResponse.json(
        { success: false, error: "ভাতা আইডি (enrollmentId) আবশ্যক।" },
        { status: 400 }
      );
    }

    if (!requestReason) {
      return NextResponse.json(
        { success: false, error: "আবেদনের কারণ (requestReason) উল্লেখ করা আবশ্যক।" },
        { status: 400 }
      );
    }

    // 3. Verify that the target enrollmentId exists, is currently "Active", and belongs to officer's own departmentId
    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        scheme: {
          include: { department: true },
        },
        beneficiary: true,
      },
    });

    if (!enrollment) {
      return NextResponse.json(
        { success: false, error: "ভাতা/এনরোলমেন্ট রেকর্ড পাওয়া যায়নি (Enrollment not found)." },
        { status: 404 }
      );
    }

    // Check if status is currently Active or Flagged
    const isEligibleForRemoval =
      ["active", "flagged"].includes(enrollment.status.toLowerCase());

    if (!isEligibleForRemoval) {
      return NextResponse.json(
        {
          success: false,
          error: `আবেদন ব্যর্থ: শুধুমাত্র 'Active' বা 'Flagged' ভাতার ক্ষেত্রে বাতিলের আবেদন করা যাবে (বর্তমান স্ট্যাটাস: ${enrollment.status})।`,
        },
        { status: 400 }
      );
    }

    // Verify department ownership
    if (!officer.departmentId || enrollment.scheme.departmentId !== officer.departmentId) {
      return NextResponse.json(
        {
          success: false,
          error:
            "অননুমোদিত দপ্তর: আপনি শুধুমাত্র আপনার নিজস্ব দপ্তরের আওতাধীন অতিরিক্ত ভাতার জন্য বাতিলের আবেদন করতে পারবেন (Forbidden: Target enrollment does not belong to your department).",
        },
        { status: 403 }
      );
    }

    // Verify that the target enrollment is NOT the citizen's primary approved allowance (মূল অনুমোদিত ভাতা)
    // Rule: The primary approved allowance cannot be cancelled by a department officer.
    // Only the department officer who owns the excess/secondary allowance can submit a removal request.
    const citizenEnrollments = await prisma.enrollment.findMany({
      where: {
        OR: [
          { beneficiaryId: enrollment.beneficiaryId },
          ...(enrollment.beneficiary.nid ? [{ beneficiary: { nid: enrollment.beneficiary.nid } }] : []),
          ...(enrollment.beneficiary.brn ? [{ beneficiary: { brn: enrollment.beneficiary.brn } }] : []),
        ],
        status: { in: ["Active", "Flagged", "ACTIVE", "FLAGGED"] },
        isArchived: false,
      },
      include: {
        scheme: {
          include: { department: true },
        },
      },
    });

    // Chronological Seniority / Primary Scheme Determination:
    // Earliest startDate takes precedence; tie-breaker: higher monthly financial value
    const sortedEnrollments = [...citizenEnrollments].sort((a, b) => {
      const timeA = new Date(a.startDate).getTime();
      const timeB = new Date(b.startDate).getTime();
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
        return timeA - timeB; // Earliest enrolled scheme is primary
      }
      return b.scheme.monthlyAmount - a.scheme.monthlyAmount;
    });

    if (sortedEnrollments.length > 1 && sortedEnrollments[0].id === enrollmentId) {
      const primarySchemeName =
        enrollment.scheme.nameBn || enrollment.scheme.name;
      return NextResponse.json(
        {
          success: false,
          error: `আবেদন ব্যর্থ: '${primarySchemeName}' এই সুবিধাভোগীর 'মূল অনুমোদিত ভাতা'। সরকারি বিধিমালা অনুযায়ী মূল অনুমোদিত ভাতা প্রদানকারী দপ্তর ভাতা বাতিলের আবেদন করতে পারবে না। শুধুমাত্র অতিরিক্ত ভাতার ক্ষেত্রে সংশ্লিষ্ট দপ্তর ব্যবহারকারী বাতিলের আবেদন করতে পারবেন।`,
        },
        { status: 400 }
      );
    }

    // Prevent duplicate pending requests for the same enrollment
    const existing = await prisma.removalRequest.findUnique({
      where: { enrollmentId },
    });

    if (existing && existing.status === "PENDING") {
      return NextResponse.json(
        {
          success: false,
          error: "এই ভাতার জন্য ইতোমধ্যে একটি আবেদন প্রক্রিয়াধীন (PENDING) রয়েছে।",
        },
        { status: 400 }
      );
    }

    // 4. Create RemovalRequest inside transaction with AuditLog entry
    const result = await prisma.$transaction(async (tx) => {
      const created = await tx.removalRequest.upsert({
        where: { enrollmentId },
        create: {
          enrollmentId,
          beneficiaryId: enrollment.beneficiaryId,
          departmentId: enrollment.scheme.departmentId,
          requestedByUserId: officer.id,
          requestReason,
          status: "PENDING",
          district: enrollment.beneficiary.district || officer.district || "নেত্রকোণা",
          upazilaName: enrollment.beneficiary.upazilaName || officer.upazilaName || "নেত্রকোণা সদর",
        },
        update: {
          beneficiaryId: enrollment.beneficiaryId,
          departmentId: enrollment.scheme.departmentId,
          requestedByUserId: officer.id,
          requestReason,
          status: "PENDING",
          district: enrollment.beneficiary.district || officer.district || "নেত্রকোণা",
          upazilaName: enrollment.beneficiary.upazilaName || officer.upazilaName || "নেত্রকোণা সদর",
          adminComment: null,
          reviewedByUserId: null,
          reviewedAt: null,
        },
        include: {
          enrollment: {
            include: {
              scheme: { include: { department: true } },
              beneficiary: true,
            },
          },
          requestedByUser: true,
        },
      });

      // Log "REMOVAL_REQUESTED" in AuditLog
      await tx.auditLog.create({
        data: {
          userId: officer.id,
          actionType: "REMOVAL_REQUESTED",
          entityId: created.id,
          details: `দপ্তর কর্মকর্তা (${officer.name}, ${officer.department?.nameBn || officer.department?.name || "দপ্তর"}) কর্তৃক সুবিধাভোগী '${enrollment.beneficiary.fullName}' (এনআইডি: ${enrollment.beneficiary.nid || "N/A"}) এর '${enrollment.scheme.name}' ভাতা বাতিলের জন্য ইউএনও মহোদয়ের নিকট আবেদন প্রেরণ করা হয়েছে। কারণ: "${requestReason}"`,
        },
      });

      return created;
    });

    return NextResponse.json({
      success: true,
      request: {
        ...result,
        reason: result.requestReason,
        requestedBy: result.requestedByUser,
      },
      message: "ভাতা বাতিলের আবেদন সফলভাবে প্রেরণ করা হয়েছে এবং ইউএনও মহোদয়ের সিদ্ধান্তের অপেক্ষায় রয়েছে।",
    });
  } catch (error: unknown) {
    console.error("Failed to create removal request:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
