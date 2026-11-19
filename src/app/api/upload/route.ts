import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { processBatchUpload, CleanedRecord } from "@/lib/dedup";

export async function POST(request: Request) {
  try {
    const session = await auth();
    const body = await request.json();
    const { departmentId, schemeId, records, fileName } = body;

    // Role-based authorization
    if (session?.user) {
      const role = session.user.role;
      // 1. UNION_VIEWER is strictly blocked from uploading
      if (role === "UNION_VIEWER") {
        return NextResponse.json(
          {
            success: false,
            error: "অ্যাক্সেস ডিনাইড: ইউনিয়ন পর্যবেক্ষক অ্যাকাউন্টে ডাটা আপলোড করার অনুমতি নেই (Access Denied: UNION_VIEWER cannot upload data).",
          },
          { status: 403 }
        );
      }

      // 2. DEPT_OFFICER can ONLY upload data for their assigned department
      if (role === "DEPT_OFFICER" || role === "DEPARTMENT_OFFICER") {
        const userDeptId = session.user.departmentId;
        if (userDeptId && departmentId !== userDeptId) {
          return NextResponse.json(
            {
              success: false,
              error: "অননুমোদিত দপ্তর! দপ্তর কর্মকর্তা শুধুমাত্র তার নির্ধারিত দপ্তরের ডাটা আপলোড করতে পারবেন (Access Denied: You can only upload data for your assigned department).",
            },
            { status: 403 }
          );
        }
      }
    }

    if (!departmentId || !schemeId) {
      return NextResponse.json(
        { success: false, error: "Please select both Department and Scheme." },
        { status: 400 }
      );
    }

    if (!records || !Array.isArray(records) || records.length === 0) {
      return NextResponse.json(
        { success: false, error: "No beneficiary records provided in upload." },
        { status: 400 }
      );
    }

    // Verify scheme exists
    const targetScheme = await prisma.scheme.findUnique({
      where: { id: schemeId },
      include: { department: true },
    });

    if (!targetScheme) {
      return NextResponse.json(
        { success: false, error: "Selected Scheme not found." },
        { status: 404 }
      );
    }

    // Determine uploadedByUserId (fallback to first super admin if unauthenticated)
    let validUserId = session?.user?.id || body.uploadedByUserId || null;
    if (!validUserId) {
      const fallbackUser = await prisma.user.findFirst({
        where: { role: "SUPER_ADMIN" },
        select: { id: true },
      });
      validUserId = fallbackUser?.id || (await prisma.user.findFirst({ select: { id: true } }))?.id || null;
    }

    if (!validUserId) {
      return NextResponse.json(
        { success: false, error: "No valid user account found for upload attribution." },
        { status: 400 }
      );
    }

    // Generate unique batch code: BATCH-YYYYMMDD-HEX
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const batchCode = `BATCH-${timestamp}-${randomSuffix}`;
    const finalFileName = (fileName && String(fileName).trim()) || "uploaded_data.xlsx";

    // Extract client IP address for audit trail
    const ipAddress =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      null;

    const uploadDistrict = body.district || (session?.user as any)?.district || "নেত্রকোণা";
    const uploadUpazila = body.upazilaName || (session?.user as any)?.upazilaName || "নেত্রকোণা সদর";

    // Wrap the entire bulk import inside prisma.$transaction
    const { uploadBatch, processResult } = await prisma.$transaction(
      async (tx) => {
        // 1. Create an UploadBatch record first
        const batch = await tx.uploadBatch.create({
          data: {
            batchCode,
            fileName: finalFileName,
            departmentId,
            schemeId,
            totalRecords: records.length,
            uploadedByUserId: validUserId,
            district: uploadDistrict,
            upazilaName: uploadUpazila,
            status: "ACTIVE",
          },
        });

        // 2. Attach its ID to all created Enrollment records
        const result = await processBatchUpload(
          departmentId,
          schemeId,
          records as CleanedRecord[],
          batch.id,
          validUserId,
          tx,
          uploadDistrict,
          uploadUpazila
        );

        // 3. Log a BATCH_UPLOAD entry in AuditLog
        const uploaderName = session?.user?.name || "Official User";
        await tx.auditLog.create({
          data: {
            userId: validUserId,
            actionType: "BATCH_UPLOAD",
            entityId: batch.id,
            details: `${uploaderName} uploaded ${records.length} records from ${finalFileName} into "${targetScheme.name}" (${result.activeCount} active, ${result.flaggedCount} flagged).`,
            ipAddress,
          },
        });

        return { uploadBatch: batch, processResult: result };
      },
      {
        timeout: 60000, // 60-second timeout for large batches
      }
    );

    const { batchId: _processedBatchId, ...restResult } = processResult;

    return NextResponse.json({
      success: true,
      batchId: uploadBatch.id,
      batchCode: uploadBatch.batchCode,
      fileName: finalFileName,
      ...restResult,
    });
  } catch (error: unknown) {
    console.error("Batch upload failed:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
