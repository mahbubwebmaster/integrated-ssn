import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন (Unauthorized)" },
        { status: 401 }
      );
    }

    const requesterRole = session.user.role;
    if (requesterRole === "UNION_VIEWER") {
      return NextResponse.json(
        { success: false, error: "অ্যাক্সেস ডিনাইড: ইউনিয়ন পর্যবেক্ষক অ্যাকাউন্টে আর্কাইভ করার অনুমতি নেই (Forbidden)" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      beneficiaryId,
      enrollmentId,
      reason,
      note,
    } = body;

    if (!beneficiaryId || !reason || !note?.trim()) {
      return NextResponse.json(
        {
          success: false,
          error: "সুবিধাভোগীর আইডি, আর্কাইভের কারণ এবং নোট আবশ্যক।",
        },
        { status: 400 }
      );
    }

    const beneficiary = await prisma.beneficiary.findUnique({
      where: { id: beneficiaryId },
      include: {
        enrollments: {
          include: { scheme: { include: { department: true } } },
        },
      },
    });

    if (!beneficiary) {
      return NextResponse.json(
        { success: false, error: "সুবিধাভোগী খুঁজে পাওয়া যায়নি।" },
        { status: 404 }
      );
    }

    // Role check: If DEPT_OFFICER, ensure they only archive enrollments within their assigned department
    if (requesterRole === "DEPT_OFFICER" || requesterRole === "DEPARTMENT_OFFICER") {
      const userDeptId = session.user.departmentId;
      if (enrollmentId) {
        const targetEnrollment = beneficiary.enrollments.find((e) => e.id === enrollmentId);
        if (targetEnrollment && userDeptId && targetEnrollment.scheme.departmentId !== userDeptId) {
          return NextResponse.json(
            { success: false, error: "অননুমোদিত দপ্তর: আপনি শুধুমাত্র নিজ দপ্তরের ভাতা আর্কাইভ করতে পারবেন।" },
            { status: 403 }
          );
        }
      }
    }

    const archiverLabel = session.user.name || session.user.email || "দপ্তর কর্মকর্তা";
    const now = new Date();

    // 1. If an enrollmentId is targeted (e.g. Dept Officer archiving their specific scheme)
    if (enrollmentId) {
      await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: {
          isArchived: true,
          status: "Archived",
          archiveReason: reason,
          archiveNote: note.trim(),
          archivedAt: now,
          archivedBy: archiverLabel,
        },
      });

      // Check if all enrollments are now archived or if reason is DECEASED (মৃত্যু)
      const activeRemaining = await prisma.enrollment.count({
        where: {
          beneficiaryId,
          isArchived: false,
          status: { notIn: ["Archived", "Suspended", "SUSPENDED"] },
        },
      });

      if (activeRemaining === 0 || reason === "DECEASED") {
        await prisma.beneficiary.update({
          where: { id: beneficiaryId },
          data: {
            isArchived: true,
            archiveReason: reason,
            archiveNote: note.trim(),
            archivedAt: now,
            archivedBy: archiverLabel,
          },
        });
      }
    } else {
      // 2. Archive the whole beneficiary and all their enrollments
      await prisma.enrollment.updateMany({
        where: { beneficiaryId },
        data: {
          isArchived: true,
          status: "Archived",
          archiveReason: reason,
          archiveNote: note.trim(),
          archivedAt: now,
          archivedBy: archiverLabel,
        },
      });

      await prisma.beneficiary.update({
        where: { id: beneficiaryId },
        data: {
          isArchived: true,
          archiveReason: reason,
          archiveNote: note.trim(),
          archivedAt: now,
          archivedBy: archiverLabel,
        },
      });
    }

    // Record in audit log
    try {
      if (session?.user?.id) {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id,
            actionType: "BENEFICIARY_ARCHIVED",
            entityId: beneficiaryId,
            details: `সুবিধাভোগী "${beneficiary.fullName}" (${reason}) আর্কাইভ করা হয়েছে। নোট: ${note.trim()}`,
          },
        });
      }
    } catch (auditErr) {
      console.warn("Audit log creation warning:", auditErr);
    }

    return NextResponse.json({
      success: true,
      message: "সুবিধাভোগীর তথ্য সফলভাবে আর্কাইভ করা হয়েছে।",
    });
  } catch (error: any) {
    console.error("Archive beneficiary error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "আর্কাইভ করার সময় ত্রুটি হয়েছে।",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const beneficiaryId = searchParams.get("beneficiaryId");
    const enrollmentId = searchParams.get("enrollmentId");

    if (!beneficiaryId && !enrollmentId) {
      return NextResponse.json(
        { success: false, error: "আইডি আবশ্যক।" },
        { status: 400 }
      );
    }

    if (enrollmentId) {
      await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: {
          isArchived: false,
          status: "Active",
          archiveReason: null,
          archiveNote: null,
          archivedAt: null,
          archivedBy: null,
        },
      });
    }

    if (beneficiaryId) {
      await prisma.beneficiary.update({
        where: { id: beneficiaryId },
        data: {
          isArchived: false,
          archiveReason: null,
          archiveNote: null,
          archivedAt: null,
          archivedBy: null,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "সুবিধাভোগীকে আর্কাইভ থেকে সফলভাবে পুনরুদ্ধার করা হয়েছে।",
    });
  } catch (error: any) {
    console.error("Unarchive beneficiary error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "পুনরুদ্ধার করার সময় ত্রুটি হয়েছে।",
      },
      { status: 500 }
    );
  }
}
