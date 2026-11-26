import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultMasterData } from "@/lib/seed";
import { NETROKONA_UPAZILAS, NETROKONA_DISTRICT } from "@/lib/netrokona";
import { getSessionUser, getEnrollmentScope, getBeneficiaryScope } from "@/lib/data-scope";

// In-memory cache with 30s TTL to prevent expensive duplicate cross-continental queries
const statsCache = new Map<string, { timestamp: number; payload: any }>();
const STATS_CACHE_TTL_MS = 30 * 1000;

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
    const departmentIdParam = searchParams.get("departmentId")?.trim() || "";

    // Resolve user session and administrative scope
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন (Unauthorized)." },
        { status: 401 }
      );
    }

    // Check fast cache
    const cacheKey = `${user?.id || "anon"}_${user?.role || "GUEST"}_${upazilaParam}_${departmentIdParam}`;
    const cached = statsCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < STATS_CACHE_TTL_MS) {
      return NextResponse.json(cached.payload);
    }

    const enrollmentScope = getEnrollmentScope(user, {
      upazila: upazilaParam,
      departmentId: departmentIdParam,
    });
    const beneficiaryScope = getBeneficiaryScope(user, {
      upazila: upazilaParam,
      departmentId: departmentIdParam,
    });

    // 1. Total counts (strictly filtered by administrative scope)
    const totalBeneficiaries = await prisma.beneficiary.count({ where: beneficiaryScope });
    const totalEnrollments = await prisma.enrollment.count({ where: enrollmentScope });
    const activeEnrollments = await prisma.enrollment.count({
      where: {
        ...enrollmentScope,
        status: { in: ["ACTIVE", "Active"] },
      },
    });
    const flaggedEnrollments = await prisma.enrollment.count({
      where: {
        ...enrollmentScope,
        status: { in: ["FLAGGED", "Flagged"] },
      },
    });
    const suspendedEnrollments = await prisma.enrollment.count({
      where: {
        ...enrollmentScope,
        status: { in: ["SUSPENDED", "Suspended"] },
      },
    });
    const archivedEnrollments = await prisma.enrollment.count({
      where: {
        ...enrollmentScope,
        OR: [{ isArchived: true }, { status: { in: ["ARCHIVED", "Archived"] } }],
      },
    });

    const isDeptOfficer = user?.role === "DEPT_OFFICER" || user?.role === "DEPARTMENT_OFFICER";
    const deptWhere = isDeptOfficer && user?.departmentId ? { id: user.departmentId } : {};

    const totalDepartments = await prisma.department.count({ where: deptWhere });
    const totalSchemes = await prisma.scheme.count({
      where: isDeptOfficer && user?.departmentId ? { departmentId: user.departmentId } : {},
    });

    // 2. Department-wise breakdown within user's geographic & department scope
    const departments = await prisma.department.findMany({
      where: deptWhere,
      include: {
        schemes: {
          include: {
            enrollments: {
              where: enrollmentScope.beneficiary ? { beneficiary: enrollmentScope.beneficiary } : {},
            },
          },
        },
      },
    });

    const departmentStats = departments.map((dept) => {
      let deptEnrollments = 0;
      let deptBudgetMonthly = 0;
      for (const scheme of dept.schemes) {
        const activeCount = scheme.enrollments.filter(
          (e) => e.status === "ACTIVE" || e.status === "Active" || e.status === "FLAGGED" || e.status === "Flagged"
        ).length;
        deptEnrollments += activeCount;
        deptBudgetMonthly += activeCount * scheme.monthlyAmount;
      }
      return {
        id: dept.id,
        name: dept.name,
        nameBn: dept.nameBn,
        nameEn: dept.nameEn,
        schemeCount: dept.schemes.length,
        enrollmentCount: deptEnrollments,
        monthlyBudget: deptBudgetMonthly,
      };
    });

    // 3. Upazila & Union breakdown within administrative scope
    const scopedBeneficiaries = await prisma.beneficiary.findMany({
      where: beneficiaryScope,
      select: {
        district: true,
        districtName: true,
        upazilaName: true,
        unionName: true,
        enrollments: {
          where: enrollmentScope.scheme ? { scheme: enrollmentScope.scheme } : {},
          select: {
            status: true,
            isArchived: true,
          },
        },
      },
    });

    const upazilaMap = new Map<string, { upazilaName: string; total: number; active: number; flagged: number; suspended: number; archived: number }>();
    for (const u of NETROKONA_UPAZILAS) {
      // If user is locked to an upazila, only show their upazila in the map
      if (user?.role === "UPAZILA_ADMIN" && user.upazilaName && user.upazilaName !== u.nameBn) {
        continue;
      }
      if (isDeptOfficer && user?.upazilaName && user.upazilaName !== u.nameBn) {
        continue;
      }
      upazilaMap.set(u.nameBn, { upazilaName: u.nameBn, total: 0, active: 0, flagged: 0, suspended: 0, archived: 0 });
    }

    const unionMap = new Map<string, { unionName: string; upazilaName: string; total: number; active: number; flagged: number }>();

    for (const b of scopedBeneficiaries) {
      const upz = b.upazilaName || "অন্যান্য";
      if (!upazilaMap.has(upz)) {
        upazilaMap.set(upz, { upazilaName: upz, total: 0, active: 0, flagged: 0, suspended: 0, archived: 0 });
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
        if (e.status === "ACTIVE" || e.status === "Active") {
          upzData.active += 1;
          uData.active += 1;
        } else if (e.status === "FLAGGED" || e.status === "Flagged") {
          upzData.flagged += 1;
          uData.flagged += 1;
        } else if (e.status === "SUSPENDED" || e.status === "Suspended") {
          upzData.suspended += 1;
        } else if (e.status === "ARCHIVED" || e.status === "Archived" || e.isArchived) {
          upzData.archived += 1;
        }
      }
    }

    const upazilaStats = Array.from(upazilaMap.values());
    const unionStats = Array.from(unionMap.values());

    // 4. Recent Upload Batches within scope
    const recentEnrollments = await prisma.enrollment.findMany({
      where: enrollmentScope,
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
      if (e.status === "ACTIVE" || e.status === "Active") bData.active += 1;
      if (e.status === "FLAGGED" || e.status === "Flagged") bData.flagged += 1;
    }

    const recentBatches = Array.from(batchMap.values()).slice(0, 5);

    const payload = {
      success: true,
      district: NETROKONA_DISTRICT,
      selectedUpazila: (enrollmentScope.beneficiary as any)?.upazilaName || upazilaParam || null,
      summary: {
        totalBeneficiaries,
        totalEnrollments,
        activeEnrollments,
        flaggedEnrollments,
        suspendedEnrollments,
        archivedEnrollments,
        totalDepartments,
        totalSchemes,
      },
      departmentStats,
      upazilaStats,
      unionStats,
      recentBatches,
    };

    statsCache.set(cacheKey, { timestamp: Date.now(), payload });
    return NextResponse.json(payload);
  } catch (error: unknown) {
    console.error("Dashboard stats failed:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
