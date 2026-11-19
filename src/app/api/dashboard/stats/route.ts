import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultMasterData } from "@/lib/seed";
import { NETROKONA_UPAZILAS, NETROKONA_DISTRICT } from "@/lib/netrokona";

export async function GET(request: Request) {
  try {
    try {
      await ensureDefaultMasterData();
    } catch (e) {
      // Graceful fallback if database connection is pending initialization
      console.warn("ensureDefaultMasterData skipped or pending DB initialization:", e);
    }

    const { searchParams } = new URL(request.url);
    const upazilaParam = searchParams.get("upazila")?.trim() || "";

    const userRole = request.headers.get("x-user-role");
    const userUpazila = request.headers.get("x-user-upazila");

    let effectiveUpazila = upazilaParam;
    if (userRole === "UPAZILA_ADMIN" && userUpazila) {
      effectiveUpazila = userUpazila;
    }

    const whereBeneficiary: any = {};
    if (effectiveUpazila && effectiveUpazila !== "all" && effectiveUpazila !== "সমগ্র জেলা" && effectiveUpazila !== "সমগ্র নেত্রকোণা জেলা") {
      whereBeneficiary.upazilaName = effectiveUpazila;
    }

    // 1. Total counts
    const totalBeneficiaries = await prisma.beneficiary.count({ where: whereBeneficiary });
    const totalEnrollments = await prisma.enrollment.count({
      where: effectiveUpazila ? { beneficiary: whereBeneficiary } : {},
    });
    const activeEnrollments = await prisma.enrollment.count({
      where: { status: "Active", ...(effectiveUpazila ? { beneficiary: whereBeneficiary } : {}) },
    });
    const flaggedEnrollments = await prisma.enrollment.count({
      where: { status: "Flagged", ...(effectiveUpazila ? { beneficiary: whereBeneficiary } : {}) },
    });
    const suspendedEnrollments = await prisma.enrollment.count({
      where: {
        OR: [{ status: "Suspended" }, { status: "SUSPENDED" }],
        ...(effectiveUpazila ? { beneficiary: whereBeneficiary } : {}),
      },
    });
    const totalDepartments = await prisma.department.count();
    const totalSchemes = await prisma.scheme.count();

    // 2. Department-wise breakdown
    const departments = await prisma.department.findMany({
      include: {
        schemes: {
          include: {
            enrollments: true,
          },
        },
      },
    });

    const departmentStats = departments.map((dept) => {
      let deptEnrollments = 0;
      let deptBudgetMonthly = 0;
      for (const scheme of dept.schemes) {
        const activeCount = scheme.enrollments.filter((e) => e.status === "Active" || e.status === "Flagged").length;
        deptEnrollments += activeCount;
        deptBudgetMonthly += activeCount * scheme.monthlyAmount;
      }
      return {
        id: dept.id,
        name: dept.name,
        schemeCount: dept.schemes.length,
        enrollmentCount: deptEnrollments,
        monthlyBudget: deptBudgetMonthly,
      };
    });

    // 3. Upazila & Union breakdown
    const allBeneficiaries = await prisma.beneficiary.findMany({
      select: {
        district: true,
        upazilaName: true,
        unionName: true,
        enrollments: {
          select: {
            status: true,
          },
        },
      },
    });

    const upazilaMap = new Map<string, { upazilaName: string; total: number; active: number; flagged: number; suspended: number }>();
    for (const u of NETROKONA_UPAZILAS) {
      upazilaMap.set(u.nameBn, { upazilaName: u.nameBn, total: 0, active: 0, flagged: 0, suspended: 0 });
    }

    const unionMap = new Map<string, { unionName: string; upazilaName: string; total: number; active: number; flagged: number }>();

    for (const b of allBeneficiaries) {
      const upz = b.upazilaName || "অন্যান্য";
      if (!upazilaMap.has(upz)) {
        upazilaMap.set(upz, { upazilaName: upz, total: 0, active: 0, flagged: 0, suspended: 0 });
      }
      const upzData = upazilaMap.get(upz)!;
      upzData.total += 1;

      const u = b.unionName || "Unknown";
      if (!unionMap.has(u)) {
        unionMap.set(u, { unionName: u, upazilaName: upz, total: 0, active: 0, flagged: 0 });
      }
      const uData = unionMap.get(u)!;
      uData.total += 1;

      for (const e of b.enrollments) {
        if (e.status === "Active") {
          upzData.active += 1;
          uData.active += 1;
        } else if (e.status === "Flagged") {
          upzData.flagged += 1;
          uData.flagged += 1;
        } else if (e.status === "Suspended" || e.status === "SUSPENDED") {
          upzData.suspended += 1;
        }
      }
    }

    const upazilaStats = Array.from(upazilaMap.values());
    const unionStats = Array.from(unionMap.values());

    // 4. Recent Upload Batches
    const recentEnrollments = await prisma.enrollment.findMany({
      take: 100,
      orderBy: { createdAt: "desc" },
      select: {
        uploadedBatchId: true,
        status: true,
        createdAt: true,
      },
    });

    const batchMap = new Map<string, { batchId: string; total: number; active: number; flagged: number; date: Date }>();
    for (const e of recentEnrollments) {
      if (!e.uploadedBatchId) continue;
      if (!batchMap.has(e.uploadedBatchId)) {
        batchMap.set(e.uploadedBatchId, {
          batchId: e.uploadedBatchId,
          total: 0,
          active: 0,
          flagged: 0,
          date: e.createdAt,
        });
      }
      const bData = batchMap.get(e.uploadedBatchId)!;
      bData.total += 1;
      if (e.status === "Active") bData.active += 1;
      if (e.status === "Flagged") bData.flagged += 1;
    }

    const recentBatches = Array.from(batchMap.values()).slice(0, 5);

    return NextResponse.json({
      success: true,
      district: NETROKONA_DISTRICT,
      selectedUpazila: effectiveUpazila || null,
      summary: {
        totalBeneficiaries,
        totalEnrollments,
        activeEnrollments,
        flaggedEnrollments,
        suspendedEnrollments,
        totalDepartments,
        totalSchemes,
      },
      departmentStats,
      upazilaStats,
      unionStats,
      recentBatches,
    });
  } catch (error: unknown) {
    console.error("Dashboard stats failed:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
