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

    const { role, departmentId: userDeptId } = session.user as any;

    // Only DEPT_OFFICER, UPAZILA_ADMIN, or SUPER_ADMIN can review applications
    if (role === "UNION_VIEWER") {
      return NextResponse.json(
        { success: false, error: "অ্যাক্সেস ডিনাইড: ইউনিয়ন পর্যবেক্ষক আইডিতে আবেদন অনুমোদন বা বাতিলের অনুমতি নেই (Forbidden)" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { enrollmentId, action, officerNote } = body;

    if (!enrollmentId || !action) {
      return NextResponse.json(
        { success: false, error: "এনরোলমেন্ট আইডি এবং অ্যাকশন (approve / reject) আবশ্যক।" },
        { status: 400 }
      );
    }

    if (action !== "approve" && action !== "reject") {
      return NextResponse.json(
        { success: false, error: "অবৈধ অ্যাকশন (Invalid action)" },
        { status: 400 }
      );
    }

    // Find the enrollment
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
        { success: false, error: "আবেদন বা এনরোলমেন্ট রেকর্ড পাওয়া যায়নি।" },
        { status: 404 }
      );
    }

    // If DEPT_OFFICER, verify they belong to this scheme's department
    if (
      (role === "DEPT_OFFICER" || role === "DEPARTMENT_OFFICER") &&
      userDeptId &&
      enrollment.scheme.departmentId !== userDeptId
    ) {
      return NextResponse.json(
        { success: false, error: "আপনি শুধুমাত্র আপনার নিজ দপ্তরের স্কিমের আবেদন পর্যালোচনা করতে পারেন।" },
        { status: 403 }
      );
    }

    const reviewerName = session.user.name || session.user.email || "দপ্তর কর্মকর্তা";
    const noteText = officerNote ? String(officerNote).trim() : "";

    if (action === "approve") {
      // Approve the pending enrollment -> becomes ACTIVE
      const updated = await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: {
          status: "Active",
          isArchived: false,
          archiveNote: noteText ? `[অনুমোদন নোট] ${noteText}` : "দপ্তর কর্মকর্তা কর্তৃক অনুমোদিত।",
          archivedBy: reviewerName,
          archivedAt: new Date(),
        },
      });

      // Audit Log
      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id || "system",
            actionType: "BENEFICIARY_ENROLLMENT_APPROVED",
            details: `সুবিধাভোগী (${enrollment.beneficiary.fullName}, NID: ${enrollment.beneficiary.nid || "N/A"}) এর স্কিম (${enrollment.scheme.name}) আবেদন অনুমোদন করা হয়েছে। নোট: ${noteText || "N/A"}`,
          },
        });
      } catch (logErr) {
        console.warn("Audit log creation error:", logErr);
      }

      return NextResponse.json({
        success: true,
        message: `সুবিধাভোগী "${enrollment.beneficiary.fullName}" এর আবেদন সফলভাবে অনুমোদন করা হয়েছে।`,
        enrollment: updated,
      });
    }

    if (action === "reject") {
      // Reject the pending enrollment -> becomes REJECTED
      const updated = await prisma.enrollment.update({
        where: { id: enrollmentId },
        data: {
          status: "REJECTED",
          isArchived: false,
          archiveReason: "DEPT_REMOVAL",
          archiveNote: noteText ? `[বাতিলের কারণ] ${noteText}` : "দপ্তর কর্মকর্তা কর্তৃক আবেদন বাতিল করা হয়েছে।",
          archivedBy: reviewerName,
          archivedAt: new Date(),
        },
      });

      // Audit Log
      try {
        await prisma.auditLog.create({
          data: {
            userId: session.user.id || "system",
            actionType: "BENEFICIARY_ENROLLMENT_REJECTED",
            details: `সুবিধাভোগী (${enrollment.beneficiary.fullName}, NID: ${enrollment.beneficiary.nid || "N/A"}) এর স্কিম (${enrollment.scheme.name}) আবেদন বাতিল করা হয়েছে। কারণ: ${noteText || "N/A"}`,
          },
        });
      } catch (logErr) {
        console.warn("Audit log creation error:", logErr);
      }

      return NextResponse.json({
        success: true,
        message: `আবেদনটি সফলভাবে বাতিল করা হয়েছে।`,
        enrollment: updated,
      });
    }
  } catch (error: any) {
    console.error("Application review error:", error);
    return NextResponse.json(
      { success: false, error: error?.message || "আবেদন পর্যালোচনার সময় ত্রুটি হয়েছে।" },
      { status: 500 }
    );
  }
}
