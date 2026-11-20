import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

/**
 * Helper to resolve the authenticated reviewer from NextAuth session,
 * custom auth headers, or body parameter.
 */
async function resolveReviewer(request: Request, bodyUserId?: string) {
  let session = null;
  try {
    session = await auth();
  } catch {
    // Ignore when executed outside active Next.js request context
  }

  if (session?.user?.id) {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (user) return user;
  }

  // Fallback to headers or explicit parameter strictly in development/test mode
  if (process.env.NODE_ENV !== "production") {
    const headerUserId =
      request.headers.get("x-user-id") ||
      bodyUserId ||
      new URL(request.url).searchParams.get("userId");

    if (headerUserId) {
      const user = await prisma.user.findUnique({
        where: { id: headerUserId },
      });
      if (user) return user;
    }

    const headerEmail =
      request.headers.get("x-user-email") ||
      new URL(request.url).searchParams.get("userEmail");

    if (headerEmail) {
      const user = await prisma.user.findUnique({
        where: { email: headerEmail.toLowerCase().trim() },
      });
      if (user) return user;
    }
  }

  return null;
}

/**
 * 3. PATCH /api/removal-requests/[id]/review (Approve or Reject):
 *    - Strictly allow ONLY UPAZILA_ADMIN. Explicitly block SUPER_ADMIN and all other roles with 403 Forbidden.
 *    - Require a non-empty adminComment in the request body (return 400 Bad Request if comment is blank).
 *    - Inside prisma.$transaction:
 *      - Update RemovalRequest status to "APPROVED" (or "REJECTED"), save adminComment, reviewedByUserId, and reviewedAt.
 *      - ONLY IF "APPROVED", update the linked Enrollment status from "Active" to "SUSPENDED".
 *      - Create an AuditLog entry recording the UNO's decision and comment.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { success: false, error: "অনুরোধ আইডি (Request ID) প্রদান আবশ্যক।" },
        { status: 400 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { status, reviewerUserId } = body;
    const adminComment = (body.adminComment || body.reviewComment || "").trim();

    // 1. Resolve reviewer
    const reviewer = await resolveReviewer(request, reviewerUserId);
    if (!reviewer) {
      return NextResponse.json(
        {
          success: false,
          error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন (Unauthorized. Please log in).",
        },
        { status: 401 }
      );
    }

    // 2. Strict Role Enforcement: ONLY UPAZILA_ADMIN. Explicitly block SUPER_ADMIN and others with 403 Forbidden.
    if (reviewer.role !== "UPAZILA_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error:
            "অননুমোদিত: শুধুমাত্র উপজেলা এডমিন (ইউএনও) ভাতা বাতিলের অনুরোধ পর্যালোচনা ও অনুমোদন/প্রত্যাখ্যান করতে পারেন। সুপার এডমিন বা অন্য কোনো রোলের এই এখতিয়ার নেই (Forbidden: Strictly restricted to Upazila Admin).",
        },
        { status: 403 }
      );
    }

    // 3. Status validation
    if (!status || !["APPROVED", "REJECTED"].includes(status.toUpperCase())) {
      return NextResponse.json(
        {
          success: false,
          error: "স্ট্যাটাস শুধুমাত্র 'APPROVED' অথবা 'REJECTED' হতে হবে (Status must be APPROVED or REJECTED).",
        },
        { status: 400 }
      );
    }
    const finalStatus = status.toUpperCase() as "APPROVED" | "REJECTED";

    // 4. Require non-empty adminComment (return 400 Bad Request if blank)
    if (!adminComment) {
      return NextResponse.json(
        {
          success: false,
          error:
            "অনুরোধ অনুমোদন বা প্রত্যাখ্যানের জন্য প্রশাসনিক মন্তব্য (adminComment) প্রদান বাধ্যতামূলক (Bad Request: adminComment cannot be blank).",
        },
        { status: 400 }
      );
    }

    // 5. Execute atomic database updates inside prisma.$transaction
    const result = await prisma.$transaction(async (tx) => {
      // Find the RemovalRequest
      const req = await tx.removalRequest.findUnique({
        where: { id },
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
        throw new Error("NOT_FOUND: ভাতা বাতিলের আবেদনটি খুঁজে পাওয়া যায়নি (RemovalRequest not found).");
      }

      if (req.status !== "PENDING") {
        throw new Error(`ALREADY_REVIEWED: এই আবেদনটি ইতোমধ্যে পর্যালোচনা করা হয়েছে (বর্তমান অবস্থা: ${req.status})।`);
      }

      // Strict Upazila Jurisdiction check: UNO can only review requests within their own Upazila
      const reqUpazila = req.upazilaName || req.enrollment.beneficiary.upazilaName;
      if (reviewer.upazilaName && reqUpazila && reviewer.upazilaName !== reqUpazila) {
        throw new Error(`JURISDICTION_ERROR: আপনি শুধুমাত্র আপনার উপজেলা (${reviewer.upazilaName})-এর ভাতা বাতিলের আবেদন পর্যালোচনা করতে পারেন। এই আবেদনটি '${reqUpazila}' উপজেলার অধিক্ষেত্রভুক্ত।`);
      }

      // ONLY IF "APPROVED", update the linked Enrollment status from "Active" to "SUSPENDED"
      if (finalStatus === "APPROVED") {
        await tx.enrollment.update({
          where: { id: req.enrollmentId },
          data: { status: "SUSPENDED" },
        });
      }

      // Update RemovalRequest
      const updatedRequest = await tx.removalRequest.update({
        where: { id },
        data: {
          status: finalStatus,
          adminComment,
          reviewedByUserId: reviewer.id,
          reviewedAt: new Date(),
        },
        include: {
          enrollment: {
            include: {
              scheme: { include: { department: true } },
              beneficiary: true,
            },
          },
          requestedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              designation: true,
            },
          },
          reviewedByUser: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
              designation: true,
            },
          },
        },
      });

      // Create an AuditLog entry recording the UNO's decision and comment
      const actionBn = finalStatus === "APPROVED" ? "অনুমোদন ও ভাতা স্থগিত" : "প্রত্যাখ্যান";
      await tx.auditLog.create({
        data: {
          userId: reviewer.id,
          actionType: finalStatus === "APPROVED" ? "SCHEME_SUSPENDED" : "REMOVAL_REJECTED",
          entityId: req.enrollmentId,
          details: `উপজেলা নির্বাহী কর্মকর্তা (${reviewer.name}, ইউএনও) কর্তৃক সুবিধাভোগী '${req.enrollment.beneficiary.fullName}' (এনআইডি: ${req.enrollment.beneficiary.nid || "N/A"}) এর '${req.enrollment.scheme.name}' ভাতা বাতিলের আবেদন ${actionBn} করা হয়েছে। মন্তব্য: "${adminComment}"`,
        },
      });

      return updatedRequest;
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
        finalStatus === "APPROVED"
          ? "ভাতা বাতিলের আবেদন সফলভাবে অনুমোদিত হয়েছে এবং সুবিধাভোগী উক্ত কর্মসূচি থেকে বাদ পড়েছেন।"
          : "ভাতা বাতিলের আবেদনটি সফলভাবে প্রত্যাখ্যান করা হয়েছে।",
    });
  } catch (error: unknown) {
    console.error("Failed to review removal request:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";

    if (message.startsWith("NOT_FOUND:")) {
      return NextResponse.json({ success: false, error: message.replace("NOT_FOUND:", "").trim() }, { status: 404 });
    }
    if (message.startsWith("JURISDICTION_ERROR:")) {
      return NextResponse.json({ success: false, error: message.replace("JURISDICTION_ERROR:", "").trim() }, { status: 403 });
    }
    if (message.startsWith("ALREADY_REVIEWED:")) {
      return NextResponse.json({ success: false, error: message.replace("ALREADY_REVIEWED:", "").trim() }, { status: 400 });
    }

    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
