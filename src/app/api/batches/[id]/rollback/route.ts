import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        {
          success: false,
          error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন (Unauthorized. Please log in).",
        },
        { status: 401 }
      );
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "ব্যাচ আইডি প্রয়োজন (Batch ID is required)." },
        { status: 400 }
      );
    }

    // 1. Find the UploadBatch
    const batch = await prisma.uploadBatch.findFirst({
      where: {
        OR: [{ id: id }, { batchCode: id }],
      },
      include: {
        department: true,
        scheme: true,
        uploadedByUser: true,
      },
    });

    if (!batch) {
      return NextResponse.json(
        { success: false, error: "ব্যাচ পাওয়া যায়নি (Upload batch not found)." },
        { status: 404 }
      );
    }

    if (batch.status === "ROLLED_BACK") {
      return NextResponse.json(
        {
          success: false,
          error: `ব্যাচ ${batch.batchCode} ইতিমধ্যে রোলব্যাক করা হয়েছে (This batch has already been rolled back).`,
        },
        { status: 400 }
      );
    }

    // 2. Permission Check:
    // Only SUPER_ADMIN or the DEPT_OFFICER who originally uploaded the batch (within 24 hours) can rollback.
    const userRole = session.user.role;
    const currentUserId = session.user.id;
    const isSuperAdmin = userRole === "SUPER_ADMIN";
    const isDeptOfficer =
      userRole === "DEPT_OFFICER" || userRole === "DEPARTMENT_OFFICER";

    if (!isSuperAdmin && !isDeptOfficer) {
      return NextResponse.json(
        {
          success: false,
          error: "অননুমোদিত: শুধুমাত্র সুপার অ্যাডমিন বা সংশ্লিষ্ট দপ্তর কর্মকর্তা ব্যাচ রোলব্যাক করতে পারেন।",
        },
        { status: 403 }
      );
    }

    if (isDeptOfficer) {
      const isOriginalUploader =
        (currentUserId && batch.uploadedByUserId === currentUserId) ||
        (session.user.email && batch.uploadedByUser?.email === session.user.email);

      if (!isOriginalUploader) {
        return NextResponse.json(
          {
            success: false,
            error: "অননুমোদিত: আপনি শুধুমাত্র নিজের আপলোডকৃত ব্যাচ রোলব্যাক করতে পারবেন (You can only rollback batches you uploaded yourself).",
          },
          { status: 403 }
        );
      }

      // Check 24-hour window for Department Officers
      const createdAtMs = new Date(batch.createdAt).getTime();
      const elapsedHours = (Date.now() - createdAtMs) / (1000 * 60 * 60);

      if (elapsedHours > 24) {
        return NextResponse.json(
          {
            success: false,
            error: "সময় উত্তীর্ণ: দপ্তর কর্মকর্তা আপলোডের সর্বোচ্চ ২৪ ঘণ্টার মধ্যে রোলব্যাক করতে পারেন। ২৪ ঘণ্টা অতিক্রান্ত হওয়ার পর শুধুমাত্র সুপার অ্যাডমিন রোলব্যাক করতে পারেন।",
          },
          { status: 403 }
        );
      }
    }

    // Client IP for audit logging
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    // 3. Perform atomic rollback inside prisma.$transaction
    const rollbackResult = await prisma.$transaction(
      async (tx) => {
        // a) Find all Enrollment records belonging to this batchId and collect their beneficiaryIds
        const enrollments = await tx.enrollment.findMany({
          where: {
            OR: [
              { uploadedBatchId: batch.id },
              { uploadedBatchId: batch.batchCode },
            ],
          },
          select: {
            id: true,
            beneficiaryId: true,
          },
        });

        const beneficiaryIds = Array.from(
          new Set(enrollments.map((e) => e.beneficiaryId))
        );
        const deletedEnrollmentsCount = enrollments.length;

        // b) Delete all Enrollment records for this batchId
        if (enrollments.length > 0) {
          const enrollmentIds = enrollments.map((e) => e.id);
          // Delete any pending suspension requests for these enrollments
          await tx.suspensionRequest.deleteMany({
            where: { enrollmentId: { in: enrollmentIds } },
          });

          await tx.enrollment.deleteMany({
            where: { id: { in: enrollmentIds } },
          });
        }

        // c) Check those collected beneficiaryIds: if a beneficiary now has ZERO remaining enrollments, delete that orphaned Beneficiary
        let deletedBeneficiariesCount = 0;
        for (const benId of beneficiaryIds) {
          const remainingCount = await tx.enrollment.count({
            where: { beneficiaryId: benId },
          });

          if (remainingCount === 0) {
            await tx.beneficiary.delete({
              where: { id: benId },
            });
            deletedBeneficiariesCount++;
          }
        }

        // d) Update UploadBatch status to "ROLLED_BACK" (keep metadata for audit history)
        const updatedBatch = await tx.uploadBatch.update({
          where: { id: batch.id },
          data: {
            status: "ROLLED_BACK",
          },
        });

        // e) Create an AuditLog entry with actionType: "BATCH_ROLLBACK"
        const actorName = session.user.name || "User";
        const details = `${actorName} (${userRole}) rolled back batch ${batch.batchCode} (${batch.fileName}). Removed ${deletedEnrollmentsCount} enrollment(s) and purged ${deletedBeneficiariesCount} orphaned beneficiary record(s).`;

        const auditLog = await tx.auditLog.create({
          data: {
            userId: currentUserId || batch.uploadedByUserId,
            actionType: "BATCH_ROLLBACK",
            entityId: batch.id,
            details,
            ipAddress,
          },
        });

        return {
          batch: updatedBatch,
          deletedEnrollmentsCount,
          deletedBeneficiariesCount,
          auditLog,
        };
      },
      {
        timeout: 60000,
      }
    );

    return NextResponse.json({
      success: true,
      message: `ব্যাচ ${batch.batchCode} সফলভাবে রোলব্যাক করা হয়েছে। ${rollbackResult.deletedEnrollmentsCount}টি এনরোলমেন্ট এবং ${rollbackResult.deletedBeneficiariesCount}টি এতিম বেনিফিশিয়ারি রেকর্ড মুছে ফেলা হয়েছে।`,
      batchId: batch.id,
      batchCode: batch.batchCode,
      deletedEnrollmentsCount: rollbackResult.deletedEnrollmentsCount,
      deletedBeneficiariesCount: rollbackResult.deletedBeneficiariesCount,
      status: "ROLLED_BACK",
    });
  } catch (error: unknown) {
    console.error("Rollback failed:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
