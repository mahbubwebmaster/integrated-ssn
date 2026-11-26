import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন (Unauthorized)." },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId") || "";
    const status = searchParams.get("status") || "";

    const whereClause: any = {};
    const userRole = session.user.role;
    if (userRole === "DEPT_OFFICER" || userRole === "DEPARTMENT_OFFICER") {
      if (session.user.departmentId) {
        whereClause.departmentId = session.user.departmentId;
      } else {
        return NextResponse.json({ success: true, requests: [] });
      }
    } else if (departmentId) {
      whereClause.departmentId = departmentId;
    }
    if (status) {
      whereClause.status = status;
    }

    const requests = await prisma.removalRequest.findMany({
      where: whereClause,
      include: {
        enrollment: {
          include: {
            scheme: {
              include: { department: true },
            },
            beneficiary: true,
          },
        },
        beneficiary: true,
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

    // Provide compat mapping for components expecting `reason` or `requestedBy`
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

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user && process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন (Unauthorized)" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const enrollmentId = body.enrollmentId;
    // In production, strictly enforce session user to prevent identity spoofing
    const requestedByUserId = session?.user?.id || (body.requestedByUserId || body.requestedById);
    const requestReason = body.requestReason || body.reason;

    if (!enrollmentId || !requestedByUserId || !requestReason?.trim()) {
      return NextResponse.json(
        { success: false, error: "ভাতা আইডি (enrollmentId), ব্যবহারকারী আইডি এবং কারণ আবশ্যক।" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: requestedByUserId },
      include: { department: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "ব্যবহারকারী পাওয়া যায়নি।" }, { status: 404 });
    }

    if (user.role !== "DEPT_OFFICER" && user.role !== "DEPARTMENT_OFFICER") {
      return NextResponse.json(
        { success: false, error: "শুধুমাত্র সংশ্লিষ্ট দপ্তর কর্মকর্তা ভাতা বাদ দেওয়ার জন্য আবেদন করতে পারবেন।" },
        { status: 403 }
      );
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        scheme: { include: { department: true } },
        beneficiary: true,
      },
    });

    if (!enrollment) {
      return NextResponse.json({ success: false, error: "ভাতা/এনরোলমেন্ট পাওয়া যায়নি।" }, { status: 404 });
    }

    if (user.departmentId && enrollment.scheme.departmentId !== user.departmentId) {
      return NextResponse.json(
        { success: false, error: "আপনি শুধুমাত্র আপনার নিজ দপ্তরের আওতাধীন ভাতা বাতিলের আবেদন করতে পারবেন।" },
        { status: 403 }
      );
    }

    const existing = await prisma.removalRequest.findUnique({
      where: { enrollmentId },
    });

    if (existing) {
      if (existing.status === "PENDING") {
        return NextResponse.json(
          { success: false, error: "এই ভাতার জন্য ইতোমধ্যে একটি আবেদন প্রক্রিয়াধীন রয়েছে।" },
          { status: 400 }
        );
      }
    }

    const created = await prisma.removalRequest.upsert({
      where: { enrollmentId },
      create: {
        enrollmentId,
        beneficiaryId: enrollment.beneficiaryId,
        departmentId: enrollment.scheme.departmentId,
        requestedByUserId: user.id,
        requestReason: requestReason.trim(),
        status: "PENDING",
      },
      update: {
        requestedByUserId: user.id,
        requestReason: requestReason.trim(),
        status: "PENDING",
        adminComment: null,
        reviewedByUserId: null,
        reviewedAt: null,
      },
      include: {
        enrollment: {
          include: { scheme: true, beneficiary: true },
        },
        requestedByUser: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: user.id,
        actionType: "SCHEME_SUSPENDED",
        entityId: created.id,
        details: `দপ্তর কর্মকর্তা (${user.name}, ${user.department?.nameBn || user.department?.name || "দপ্তর"}) কর্তৃক সুবিধাভোগী '${enrollment.beneficiary.fullName}' এর '${enrollment.scheme.name}' ভাতা বাতিলের জন্য ইউএনও মহোদয়ের নিকট আবেদন প্রেরণ করা হয়েছে। কারণ: ${requestReason.trim()}`,
      },
    });

    return NextResponse.json({
      success: true,
      request: {
        ...created,
        reason: created.requestReason,
        requestedBy: created.requestedByUser,
      },
    });
  } catch (error: unknown) {
    console.error("Failed to create removal request:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    const body = await request.json();
    const requestId = body.requestId;
    const status = body.status;
    const adminComment = body.adminComment || body.reviewComment;
    const reviewerUserId = body.reviewerUserId || session?.user?.id;

    if (!requestId || !status) {
      return NextResponse.json(
        { success: false, error: "requestId এবং status (APPROVED / REJECTED) আবশ্যক।" },
        { status: 400 }
      );
    }

    if (!["APPROVED", "REJECTED"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "স্ট্যাটাস শুধুমাত্র APPROVED অথবা REJECTED হতে পারে।" },
        { status: 400 }
      );
    }

    if (!adminComment || !adminComment.trim()) {
      return NextResponse.json(
        { success: false, error: "অনুরোধ পর্যালোচনা ও চূড়ান্ত সিদ্ধান্তের জন্য মন্তব্য (Comment) লেখা বাধ্যতামূলক।" },
        { status: 400 }
      );
    }

    // STRICT CHECK: Reviewer must be UPAZILA_ADMIN
    let reviewer = null;
    if (reviewerUserId) {
      reviewer = await prisma.user.findUnique({ where: { id: reviewerUserId } });
    } else if (session?.user?.id) {
      reviewer = await prisma.user.findUnique({ where: { id: session.user.id } });
    }

    if (!reviewer || reviewer.role !== "UPAZILA_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "শুধুমাত্র উপজেলা এডমিন (উপজেলা নির্বাহী অফিসার) ভাতা বাতিলের অনুরোধ অনুমোদন বা প্রত্যাখ্যান করতে পারেন। সুপার এডমিন বা অন্য কারো এই অনুমতি নেই।",
        },
        { status: 403 }
      );
    }

    const req = await prisma.removalRequest.findUnique({
      where: { id: requestId },
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

    if (!req) {
      return NextResponse.json({ success: false, error: "আবেদনটি পাওয়া যায়নি।" }, { status: 404 });
    }

    const result = await prisma.$transaction(async (tx) => {
      if (status === "APPROVED") {
        await tx.enrollment.update({
          where: { id: req.enrollmentId },
          data: { status: "Suspended" },
        });
      }

      const updated = await tx.removalRequest.update({
        where: { id: requestId },
        data: {
          status,
          adminComment: adminComment.trim(),
          reviewedByUserId: reviewer.id,
          reviewedAt: new Date(),
        },
        include: {
          enrollment: {
            include: { scheme: true, beneficiary: true },
          },
          requestedByUser: true,
          reviewedByUser: true,
        },
      });

      const actionBn = status === "APPROVED" ? "অনুমোদন" : "প্রত্যাখ্যান";
      await tx.auditLog.create({
        data: {
          userId: reviewer.id,
          actionType: "SCHEME_SUSPENDED",
          entityId: req.enrollmentId,
          details: `উপজেলা নির্বাহী অফিসার (${reviewer.name}) কর্তৃক সুবিধাভোগী '${req.enrollment.beneficiary.fullName}' এর '${req.enrollment.scheme.name}' ভাতা বাতিল ${actionBn} করা হয়েছে। মন্তব্য: "${adminComment.trim()}"`,
        },
      });

      return updated;
    });

    return NextResponse.json({
      success: true,
      request: {
        ...result,
        reason: result.requestReason,
        requestedBy: result.requestedByUser,
        reviewedBy: reviewer.name,
      },
      message:
        status === "APPROVED"
          ? "ভাতা বাতিলের আবেদন সফলভাবে অনুমোদিত হয়েছে।"
          : "ভাতা বাতিলের আবেদনটি সফলভাবে প্রত্যাখ্যান করা হয়েছে।",
    });
  } catch (error: unknown) {
    console.error("Failed to review removal request:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
