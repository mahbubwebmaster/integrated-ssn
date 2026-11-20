import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizeNid, normalizeBrn } from "@/lib/dedup";
import { getSessionUser, getBeneficiaryScope } from "@/lib/data-scope";

export interface RedundantEnrollmentItem {
  enrollmentId: string;
  schemeId: string;
  schemeName: string;
  schemeNameBn?: string | null;
  schemeNameEn?: string | null;
  departmentId: string;
  departmentName: string;
  departmentNameBn?: string | null;
  departmentNameEn?: string | null;
  monthlyAmount: number;
  frequency: string;
  benefitType?: string;
  commodityName?: string | null;
  commodityNameBn?: string | null;
  commodityNameEn?: string | null;
  commodityQuantity?: number | null;
  commodityUnit?: string | null;
  commodityUnitBn?: string | null;
  commodityUnitEn?: string | null;
  commodityMarketValue?: number | null;
  cashAmount?: number | null;
  cardNumber?: string | null;
  startDate: string;
  status: string;
  removalRequestStatus?: string | null;
  removalRequestId?: string | null;
}

export interface DuplicateBeneficiaryResult {
  identityKey: string;
  beneficiaryId: string;
  fullName: string;
  guardianName: string;
  fatherName?: string | null;
  gender: string;
  nid?: string | null;
  brn?: string | null;
  mobile?: string | null;
  district: string;
  upazilaName: string;
  unionName: string;
  wardNo: string;
  activeEnrollmentCount: number;
  primaryScheme: RedundantEnrollmentItem;
  excessSchemes: RedundantEnrollmentItem[];
  excessMonthlyAmount: number;
  excessYearlyAmount: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  isCrossDepartment: boolean;
  overlappingDepartments?: string[];
  conflictingDepartmentNames?: string;
}

export async function GET(request: Request) {
  try {
    const session = await auth();
    const { searchParams } = new URL(request.url);
    let district = searchParams.get("district")?.trim() || "";
    let upazila = searchParams.get("upazila")?.trim() || "";
    let union = searchParams.get("union")?.trim() || "";
    const ward = searchParams.get("ward")?.trim() || "";
    let departmentId = searchParams.get("departmentId")?.trim() || "";
    const gender = searchParams.get("gender")?.trim() || "";
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    // Resolve user jurisdiction scoping via reusable data scope helper
    const user = await getSessionUser(request);
    const scopeFilter = getBeneficiaryScope(user, {
      upazila,
      departmentId,
      union,
      district,
    });

    // Build Prisma query condition
    const whereBeneficiary: any = {
      ...scopeFilter,
    };

    if (ward) {
      whereBeneficiary.wardNo = ward;
    }
    if (gender) {
      whereBeneficiary.gender = gender;
    }

    // 1. Fetch all beneficiaries and their enrollments
    const beneficiaries = await prisma.beneficiary.findMany({
      where: whereBeneficiary,
      include: {
        enrollments: {
          include: {
            scheme: {
              include: {
                department: true,
              },
            },
            removalRequest: true,
          },
          orderBy: {
            startDate: "desc",
          },
        },
      },
    });

    // 2. Identity clustering by NID (handling 13 vs 17 digits) or BRN or Beneficiary ID
    // Map of canonicalKey -> Array of active enrollments along with beneficiary info
    interface ClusteredIdentity {
      beneficiaryId: string;
      fullName: string;
      guardianName: string;
      fatherName?: string | null;
      gender: string;
      nid?: string | null;
      brn?: string | null;
      mobile?: string | null;
      district: string;
      upazilaName: string;
      unionName: string;
      wardNo: string;
      activeEnrollments: RedundantEnrollmentItem[];
    }

    const identityMap = new Map<string, ClusteredIdentity>();

    for (const b of beneficiaries) {
      // Determine canonical key
      const cleanNid = normalizeNid(b.nid);
      const cleanBrn = normalizeBrn(b.brn);

      let canonicalKey = "";
      if (cleanNid) {
        // If 17 digits starting with year, canonicalize to last 13 digits for old/new compatibility
        const baseNid = cleanNid.length === 17 ? cleanNid.substring(4) : cleanNid;
        canonicalKey = `NID:${baseNid}`;
      } else if (cleanBrn) {
        canonicalKey = `BRN:${cleanBrn}`;
      } else {
        // Fallback: Name + Guardian + Union + Ward
        canonicalKey = `NAME:${b.fullName.toLowerCase()}_${b.guardianName.toLowerCase()}_${b.unionName.toLowerCase()}_${b.wardNo}`;
      }

      if (!identityMap.has(canonicalKey)) {
        identityMap.set(canonicalKey, {
          beneficiaryId: b.id,
          fullName: b.fullName,
          guardianName: b.guardianName,
          fatherName: b.fatherName,
          gender: b.gender,
          nid: b.nid,
          brn: b.brn,
          mobile: b.mobile,
          district: b.district || "নেত্রকোণা",
          upazilaName: b.upazilaName || "নেত্রকোণা সদর",
          unionName: b.unionName,
          wardNo: b.wardNo,
          activeEnrollments: [],
        });
      }

      const cluster = identityMap.get(canonicalKey)!;
      // Filter for active or flagged enrollments representing live disbursements
      const eligibleEnrollments = b.enrollments.filter(
        (e) => e.status === "Active" || e.status === "Flagged"
      );

      for (const e of eligibleEnrollments) {
        // Avoid duplicate enrollment IDs if multiple queries overlap
        if (!cluster.activeEnrollments.some((x) => x.enrollmentId === e.id)) {
          cluster.activeEnrollments.push({
            enrollmentId: e.id,
            schemeId: e.scheme.id,
            schemeName: e.scheme.name,
            schemeNameBn: e.scheme.nameBn,
            schemeNameEn: e.scheme.nameEn,
            departmentId: e.scheme.department.id,
            departmentName: e.scheme.department.name,
            departmentNameBn: e.scheme.department.nameBn,
            departmentNameEn: e.scheme.department.nameEn,
            monthlyAmount: e.scheme.monthlyAmount,
            frequency: e.scheme.frequency,
            benefitType: e.scheme.benefitType,
            commodityName: e.scheme.commodityName,
            commodityNameBn: e.scheme.commodityNameBn,
            commodityNameEn: e.scheme.commodityNameEn,
            commodityQuantity: e.scheme.commodityQuantity,
            commodityUnit: e.scheme.commodityUnit,
            commodityUnitBn: e.scheme.commodityUnitBn,
            commodityUnitEn: e.scheme.commodityUnitEn,
            commodityMarketValue: e.scheme.commodityMarketValue,
            cashAmount: e.scheme.cashAmount,
            cardNumber: e.cardNumber,
            startDate: e.startDate.toISOString().split("T")[0],
            status: e.status,
            removalRequestStatus: e.removalRequest?.status || null,
            removalRequestId: e.removalRequest?.id || null,
          });
        }
      }
    }

    // 3. Filter for beneficiaries who have MORE THAN 1 active enrollment
    const duplicateList: DuplicateBeneficiaryResult[] = [];

    for (const [key, cluster] of identityMap.entries()) {
      if (cluster.activeEnrollments.length <= 1) {
        continue;
      }

      // Check filters
      if (union && !cluster.unionName.toLowerCase().includes(union.toLowerCase())) {
        continue;
      }
      if (ward && cluster.wardNo !== ward) {
        continue;
      }
      if (gender && cluster.gender.toLowerCase() !== gender.toLowerCase()) {
        continue;
      }
      if (departmentId) {
        const hasDept = cluster.activeEnrollments.some((e) => e.departmentId === departmentId);
        if (!hasDept) continue;
      }
      if (search) {
        const matched =
          cluster.fullName.toLowerCase().includes(search) ||
          cluster.guardianName.toLowerCase().includes(search) ||
          (cluster.nid && cluster.nid.includes(search)) ||
          (cluster.brn && cluster.brn.includes(search)) ||
          (cluster.mobile && cluster.mobile.includes(search)) ||
          cluster.unionName.toLowerCase().includes(search);
        if (!matched) continue;
      }

      // 4. Calculate Financial Leak & Primary vs Excess Allowance
      // First-Enrolled / Chronological Seniority Rule:
      // The allowance that started earliest (ascending startDate) is considered the legitimate primary allowance.
      // Subsequently enrolled allowances are deemed redundant/excess.
      // Secondary tie-breaker: If start dates are identical, higher monthly financial amount takes precedence.
      const sortedEnrollments = [...cluster.activeEnrollments].sort((a, b) => {
        const timeA = new Date(a.startDate).getTime();
        const timeB = new Date(b.startDate).getTime();
        if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) {
          return timeA - timeB; // Earliest enrolled scheme is primary
        }
        return b.monthlyAmount - a.monthlyAmount; // Secondary tie-break: higher monthly value
      });

      const primary = sortedEnrollments[0];
      const excess = sortedEnrollments.slice(1);

      const excessMonthlyAmount = excess.reduce((acc, curr) => acc + curr.monthlyAmount, 0);
      const excessYearlyAmount = excessMonthlyAmount * 12;

      // Check if cross-departmental multi-dipping
      const distinctDepts = new Set(sortedEnrollments.map((e) => e.departmentId));
      const distinctDeptNames = Array.from(new Set(sortedEnrollments.map((e) => e.departmentName)));
      const isCrossDepartment = distinctDepts.size > 1;
      const overlappingDepartments = isCrossDepartment ? distinctDeptNames : [];
      const conflictingDepartmentNames = overlappingDepartments.join(", ");

      const riskLevel: DuplicateBeneficiaryResult["riskLevel"] =
        excessMonthlyAmount >= 1500 ? "HIGH" : excessMonthlyAmount >= 800 ? "MEDIUM" : "LOW";

      duplicateList.push({
        identityKey: key,
        beneficiaryId: cluster.beneficiaryId,
        fullName: cluster.fullName,
        guardianName: cluster.guardianName,
        fatherName: cluster.fatherName,
        gender: cluster.gender,
        nid: cluster.nid,
        brn: cluster.brn,
        mobile: cluster.mobile,
        district: cluster.district,
        upazilaName: cluster.upazilaName,
        unionName: cluster.unionName,
        wardNo: cluster.wardNo,
        activeEnrollmentCount: sortedEnrollments.length,
        primaryScheme: primary,
        excessSchemes: excess,
        excessMonthlyAmount,
        excessYearlyAmount,
        riskLevel,
        isCrossDepartment,
        overlappingDepartments,
        conflictingDepartmentNames,
      });
    }

    // Sort by excess amount descending (highest leak first)
    duplicateList.sort((a, b) => b.excessMonthlyAmount - a.excessMonthlyAmount);

    // 5. Aggregate Summaries & Department/Union breakdowns
    let totalMonthlyLeak = 0;
    let totalYearlyLeak = 0;
    let totalRedundantEnrollments = 0;

    const deptLeakMap = new Map<string, { departmentId: string; departmentName: string; departmentNameBn?: string | null; departmentNameEn?: string | null; excessAmount: number; duplicateCount: number }>();
    const upazilaLeakMap = new Map<string, { upazilaName: string; duplicateCount: number; excessMonthlyAmount: number }>();
    const unionLeakMap = new Map<string, { unionName: string; duplicateCount: number; excessMonthlyAmount: number }>();
    const unionWardLeakMap = new Map<string, { unionName: string; wardNo: string; label: string; duplicateCount: number; excessMonthlyAmount: number }>();
    const schemeLeakMap = new Map<string, { schemeId: string; schemeName: string; schemeNameBn?: string | null; schemeNameEn?: string | null; departmentName: string; departmentNameBn?: string | null; departmentNameEn?: string | null; redundantCount: number; excessAmount: number }>();

    for (const item of duplicateList) {
      totalMonthlyLeak += item.excessMonthlyAmount;
      totalYearlyLeak += item.excessYearlyAmount;
      totalRedundantEnrollments += item.excessSchemes.length;

      // Upazila breakdown
      const upz = item.upazilaName || "অন্যান্য";
      if (!upazilaLeakMap.has(upz)) {
        upazilaLeakMap.set(upz, { upazilaName: upz, duplicateCount: 0, excessMonthlyAmount: 0 });
      }
      const upzData = upazilaLeakMap.get(upz)!;
      upzData.duplicateCount += 1;
      upzData.excessMonthlyAmount += item.excessMonthlyAmount;

      // Union breakdown
      const u = item.unionName;
      if (!unionLeakMap.has(u)) {
        unionLeakMap.set(u, { unionName: u, duplicateCount: 0, excessMonthlyAmount: 0 });
      }
      const uData = unionLeakMap.get(u)!;
      uData.duplicateCount += 1;
      uData.excessMonthlyAmount += item.excessMonthlyAmount;

      // Union & Ward breakdown
      const uwKey = `${item.unionName} - W${item.wardNo}`;
      if (!unionWardLeakMap.has(uwKey)) {
        unionWardLeakMap.set(uwKey, {
          unionName: item.unionName,
          wardNo: item.wardNo,
          label: `${item.unionName} W-${item.wardNo}`,
          duplicateCount: 0,
          excessMonthlyAmount: 0,
        });
      }
      const uwData = unionWardLeakMap.get(uwKey)!;
      uwData.duplicateCount += 1;
      uwData.excessMonthlyAmount += item.excessMonthlyAmount;

      // Scheme & Department breakdown of the redundant portion
      for (const exc of item.excessSchemes) {
        // Dept
        if (!deptLeakMap.has(exc.departmentId)) {
          deptLeakMap.set(exc.departmentId, {
            departmentId: exc.departmentId,
            departmentName: exc.departmentName,
            departmentNameBn: exc.departmentNameBn,
            departmentNameEn: exc.departmentNameEn,
            excessAmount: 0,
            duplicateCount: 0,
          });
        }
        const dData = deptLeakMap.get(exc.departmentId)!;
        dData.excessAmount += exc.monthlyAmount;
        dData.duplicateCount += 1;

        // Scheme
        if (!schemeLeakMap.has(exc.schemeId)) {
          schemeLeakMap.set(exc.schemeId, {
            schemeId: exc.schemeId,
            schemeName: exc.schemeName,
            schemeNameBn: exc.schemeNameBn,
            schemeNameEn: exc.schemeNameEn,
            departmentName: exc.departmentName,
            departmentNameBn: exc.departmentNameBn,
            departmentNameEn: exc.departmentNameEn,
            redundantCount: 0,
            excessAmount: 0,
          });
        }
        const sData = schemeLeakMap.get(exc.schemeId)!;
        sData.redundantCount += 1;
        sData.excessAmount += exc.monthlyAmount;
      }
    }

    // Available distinct filter options from database
    const availableUpazilas = Array.from(new Set(beneficiaries.map((b) => b.upazilaName))).filter(Boolean).sort();
    const availableUnions = Array.from(new Set(beneficiaries.map((b) => b.unionName))).filter(Boolean).sort();
    const availableWards = Array.from(new Set(beneficiaries.map((b) => b.wardNo))).filter(Boolean).sort();

    return NextResponse.json({
      success: true,
      summary: {
        totalDuplicateBeneficiaries: duplicateList.length,
        totalRedundantEnrollments,
        totalMonthlyLeakAmount: totalMonthlyLeak,
        totalYearlyLeakAmount: totalYearlyLeak,
      },
      filters: {
        upazilas: availableUpazilas,
        unions: availableUnions,
        wards: availableWards,
      },
      duplicates: duplicateList,
      breakdownByDepartment: Array.from(deptLeakMap.values()).sort((a, b) => b.excessAmount - a.excessAmount),
      breakdownByUpazila: Array.from(upazilaLeakMap.values()).sort((a, b) => b.excessMonthlyAmount - a.excessMonthlyAmount),
      breakdownByUnion: Array.from(unionLeakMap.values()).sort((a, b) => b.excessMonthlyAmount - a.excessMonthlyAmount),
      breakdownByUnionWard: Array.from(unionWardLeakMap.values()).sort((a, b) => b.excessMonthlyAmount - a.excessMonthlyAmount),
      breakdownByScheme: Array.from(schemeLeakMap.values()).sort((a, b) => b.excessAmount - a.excessAmount),
    });
  } catch (error: unknown) {
    console.error("Redundancy detection failed:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

/**
 * PATCH: Action endpoint to Suspend, Flag, or Approve enrollments
 */
export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (session?.user && session.user.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        {
          success: false,
          error: "অননুমোদিত অ্যাকশন! শুধুমাত্র উপজেলা অ্যাডমিন (SUPER_ADMIN) সরাসরি ভাতা স্থগিত বা যাচাই করতে পারেন।",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { enrollmentId, enrollmentIds, status, beneficiaryId, action } = body;

    // Handle beneficiary batch action: "suspend_extra" or "verify_duplicate"
    if (beneficiaryId && action) {
      const ben = await prisma.beneficiary.findUnique({
        where: { id: beneficiaryId },
        include: {
          enrollments: {
            include: { scheme: true },
            orderBy: { scheme: { monthlyAmount: "desc" } },
          },
        },
      });

      if (!ben) {
        return NextResponse.json({ success: false, error: "Beneficiary not found" }, { status: 404 });
      }

      const activeEnrollments = ben.enrollments.filter(
        (e) => e.status === "Active" || e.status === "Flagged"
      );

      if (action === "suspend_extra") {
        return NextResponse.json(
          {
            success: false,
            error:
              "সরাসরি ভাতা বাতিল অনুমোদিত নয়। সংশ্লিষ্ট দপ্তর কর্মকর্তা কর্তৃক উপজেলা নির্বাহী কর্মকর্তার নিকট আবেদন পাঠাতে হবে এবং শুধুমাত্র উপজেলা নির্বাহী কর্মকর্তা (ইউএনও) প্রশাসনিক মন্তব্য সহ অনুমোদন করতে পারবেন।",
          },
          { status: 403 }
        );
      } else if (action === "verify_duplicate") {
        // Mark all excess as Flagged (Verified duplicate)
        const extraIds = activeEnrollments.slice(1).map((e) => e.id);
        await prisma.enrollment.updateMany({
          where: { id: { in: extraIds } },
          data: { status: "Flagged" },
        });
        return NextResponse.json({
          success: true,
          action: "verify_duplicate",
          flaggedCount: extraIds.length,
          message: `Verified duplicate marked for ${ben.fullName}`,
        });
      }
    }

    // Handle array of enrollmentIds
    if (Array.isArray(enrollmentIds) && enrollmentIds.length > 0 && status) {
      if (status === "Suspended") {
        return NextResponse.json(
          {
            success: false,
            error:
              "সরাসরি ভাতা বাতিল অনুমোদিত নয়। সংশ্লিষ্ট দপ্তর কর্মকর্তা কর্তৃক উপজেলা নির্বাহী কর্মকর্তার নিকট আবেদন পাঠাতে হবে এবং শুধুমাত্র উপজেলা নির্বাহী কর্মকর্তা (ইউএনও) প্রশাসনিক মন্তব্য সহ অনুমোদন করতে পারবেন।",
          },
          { status: 403 }
        );
      }
      if (!["Active", "Flagged"].includes(status)) {
        return NextResponse.json(
          { success: false, error: "Status must be 'Active' or 'Flagged'" },
          { status: 400 }
        );
      }
      await prisma.enrollment.updateMany({
        where: { id: { in: enrollmentIds } },
        data: { status },
      });
      return NextResponse.json({
        success: true,
        updatedCount: enrollmentIds.length,
        status,
      });
    }

    // Handle single enrollmentId
    if (!enrollmentId || !status) {
      return NextResponse.json(
        { success: false, error: "Missing enrollmentId or status" },
        { status: 400 }
      );
    }

    if (status === "Suspended") {
      return NextResponse.json(
        {
          success: false,
          error:
            "সরাসরি ভাতা বাতিল অনুমোদিত নয়। সংশ্লিষ্ট দপ্তর কর্মকর্তা কর্তৃক উপজেলা নির্বাহী কর্মকর্তার নিকট আবেদন পাঠাতে হবে এবং শুধুমাত্র উপজেলা নির্বাহী কর্মকর্তা (ইউএনও) প্রশাসনিক মন্তব্য সহ অনুমোদন করতে পারবেন।",
        },
        { status: 403 }
      );
    }

    if (!["Active", "Flagged"].includes(status)) {
      return NextResponse.json(
        { success: false, error: "Status must be 'Active' or 'Flagged'" },
        { status: 400 }
      );
    }

    const updated = await prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status },
      include: {
        scheme: true,
        beneficiary: true,
      },
    });

    return NextResponse.json({
      success: true,
      updatedEnrollment: {
        id: updated.id,
        status: updated.status,
        schemeName: updated.scheme.name,
        beneficiaryName: updated.beneficiary.fullName,
      },
    });
  } catch (error: unknown) {
    console.error("Failed to update enrollment status:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
