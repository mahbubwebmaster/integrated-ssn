import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getBeneficiaryScope } from "@/lib/data-scope";

let hasEnsuredBeneficiaryIntegrity = false;

async function ensureBeneficiaryDataIntegrity() {
  if (hasEnsuredBeneficiaryIntegrity) return;
  try {
    const unmigrated = await prisma.beneficiary.findMany({
      where: {
        OR: [
          { nameBn: null },
          { dateOfBirth: null },
        ],
      },
      take: 50,
    });

    if (!unmigrated || unmigrated.length === 0) {
      hasEnsuredBeneficiaryIntegrity = true;
      return;
    }

    for (const b of unmigrated) {
      let nameBn = b.nameBn;
      let nameEn = b.nameEn;
      let fatherName = b.fatherName;
      let dateOfBirth = b.dateOfBirth;

      // Parse fullName e.g. "মোসাঃ রহিমা খাতুন (Rahima Khatun)"
      if (!nameBn && b.fullName) {
        const match = b.fullName.match(/^(.*?)\s*\((.*?)\)$/);
        if (match) {
          nameBn = match[1].trim();
          nameEn = nameEn || match[2].trim();
        } else {
          nameBn = b.fullName.trim();
        }
      }

      // Parse guardianName e.g. "আব্দুল মজিদ (Abdul Majid)" -> "আব্দুল মজিদ"
      if (!fatherName && b.guardianName) {
        const gMatch = b.guardianName.match(/^(.*?)\s*\((.*?)\)$/);
        fatherName = gMatch ? gMatch[1].trim() : b.guardianName.trim();
      }

      // Estimate dateOfBirth from NID or BRN
      if (!dateOfBirth) {
        let birthYear: number | null = null;
        if (b.nid && b.nid.length >= 4 && /^19\d{2}/.test(b.nid)) {
          birthYear = parseInt(b.nid.substring(0, 4), 10);
        } else if (b.brn && b.brn.length >= 4 && /^(19|20)\d{2}/.test(b.brn)) {
          birthYear = parseInt(b.brn.substring(0, 4), 10);
        } else {
          birthYear = 1968;
        }
        if (birthYear) {
          dateOfBirth = new Date(Date.UTC(birthYear, 5, 15));
        }
      }

      await prisma.beneficiary.update({
        where: { id: b.id },
        data: {
          nameBn,
          nameEn,
          fatherName,
          guardianName: fatherName || b.guardianName,
          dateOfBirth,
        },
      });
    }
  } catch (e) {
    console.error("Data integrity check warning:", e);
  }
}

export async function GET(request: Request) {
  try {
    await ensureBeneficiaryDataIntegrity();

    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim().toLowerCase() || "";
    const district = searchParams.get("district")?.trim() || "";
    let upazila = searchParams.get("upazila")?.trim() || "";
    const union = searchParams.get("union")?.trim() || "";
    const ward = searchParams.get("ward")?.trim() || "";
    const gender = searchParams.get("gender")?.trim() || "";
    const departmentId = searchParams.get("departmentId")?.trim() || "";
    const schemeId = searchParams.get("schemeId")?.trim() || "";
    const ageGroup = searchParams.get("ageGroup")?.trim() || "";
    const minAge = searchParams.get("minAge")?.trim() || "";
    const maxAge = searchParams.get("maxAge")?.trim() || "";
    const statusFilter = searchParams.get("statusFilter")?.trim() || "ALL"; // ALL, ACTIVE, SUSPENDED, ARCHIVED
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.max(1, Math.min(500, parseInt(searchParams.get("limit") || "10", 10)));
    const exportAll = searchParams.get("all") === "true";

    // Resolve administrative data scope for the user
    const user = await getSessionUser(request);
    if (!user) {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন (Unauthorized)." },
        { status: 401 }
      );
    }
    const scopeFilter = getBeneficiaryScope(user, {
      upazila,
      departmentId,
      union,
      district,
    });

    const andConditions: any[] = [];

    // Apply administrative jurisdiction scope
    if (Object.keys(scopeFilter).length > 0) {
      andConditions.push(scopeFilter);
    }

    if (ward) andConditions.push({ wardNo: ward });
    if (gender) andConditions.push({ gender });

    // Age / Date of Birth Filtering
    const now = new Date();
    if (ageGroup === "0-17" || ageGroup === "child") {
      const cutoff = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
      andConditions.push({ dateOfBirth: { gt: cutoff } });
    } else if (ageGroup === "18-35" || ageGroup === "youth") {
      const lower = new Date(now.getFullYear() - 36, now.getMonth(), now.getDate());
      const upper = new Date(now.getFullYear() - 18, now.getMonth(), now.getDate());
      andConditions.push({ dateOfBirth: { gte: lower, lte: upper } });
    } else if (ageGroup === "36-59" || ageGroup === "adult") {
      const lower = new Date(now.getFullYear() - 60, now.getMonth(), now.getDate());
      const upper = new Date(now.getFullYear() - 36, now.getMonth(), now.getDate());
      andConditions.push({ dateOfBirth: { gte: lower, lte: upper } });
    } else if (ageGroup === "60+" || ageGroup === "senior") {
      const cutoff = new Date(now.getFullYear() - 60, now.getMonth(), now.getDate());
      andConditions.push({ dateOfBirth: { lte: cutoff } });
    } else if (minAge || maxAge) {
      const cond: any = {};
      if (minAge) {
        const minVal = parseInt(minAge, 10);
        if (!isNaN(minVal)) {
          cond.lte = new Date(now.getFullYear() - minVal, now.getMonth(), now.getDate());
        }
      }
      if (maxAge) {
        const maxVal = parseInt(maxAge, 10);
        if (!isNaN(maxVal)) {
          cond.gte = new Date(now.getFullYear() - maxVal - 1, now.getMonth(), now.getDate());
        }
      }
      if (Object.keys(cond).length > 0) {
        andConditions.push({ dateOfBirth: cond });
      }
    }

    if (search) {
      andConditions.push({
        OR: [
          { fullName: { contains: search } },
          { nameBn: { contains: search } },
          { nameEn: { contains: search } },
          { fatherName: { contains: search } },
          { guardianName: { contains: search } },
          { nid: { contains: search } },
          { brn: { contains: search } },
          { mobile: { contains: search } },
        ],
      });
    }

    // If departmentId is provided and not already applied by scopeFilter
    if (departmentId && !scopeFilter.enrollments) {
      andConditions.push({
        enrollments: {
          some: {
            scheme: {
              departmentId: departmentId,
            },
          },
        },
      });
    }

    // If schemeId is provided (e.g. for DEPT_OFFICER scheme filtering)
    if (schemeId) {
      andConditions.push({
        enrollments: {
          some: {
            schemeId: schemeId,
          },
        },
      });
    }

    // Preserve base conditions for calculating status counts
    const baseWhereClause: any = andConditions.length > 0 ? { AND: [...andConditions] } : {};

    // Resolve effective departmentId: for DEPT_OFFICER, it is strictly their own departmentId
    const isDeptOfficer = user?.role === "DEPT_OFFICER" || user?.role === "DEPARTMENT_OFFICER";
    const effectiveDeptId = (isDeptOfficer ? user?.departmentId : departmentId) || departmentId;

    // Apply statusFilter (ALL, ACTIVE, PENDING, SUSPENDED, REJECTED, ARCHIVED)
    const statusConditions: any[] = [];
    if (statusFilter === "ACTIVE") {
      statusConditions.push({
        isArchived: false,
        enrollments: {
          some: {
            ...(effectiveDeptId ? { scheme: { departmentId: effectiveDeptId } } : {}),
            status: { in: ["ACTIVE", "Active"] },
            isArchived: false,
          },
        },
      });
    } else if (statusFilter === "PENDING") {
      statusConditions.push({
        enrollments: {
          some: {
            ...(effectiveDeptId ? { scheme: { departmentId: effectiveDeptId } } : {}),
            status: { in: ["PENDING", "Pending"] },
            isArchived: false,
          },
        },
      });
    } else if (statusFilter === "SUSPENDED") {
      statusConditions.push({
        enrollments: {
          some: {
            ...(effectiveDeptId ? { scheme: { departmentId: effectiveDeptId } } : {}),
            status: { in: ["SUSPENDED", "Suspended"] },
            isArchived: false,
          },
        },
      });
    } else if (statusFilter === "REJECTED") {
      statusConditions.push({
        enrollments: {
          some: {
            ...(effectiveDeptId ? { scheme: { departmentId: effectiveDeptId } } : {}),
            status: { in: ["REJECTED", "Rejected"] },
          },
        },
      });
    } else if (statusFilter === "ARCHIVED") {
      statusConditions.push({
        OR: [
          { isArchived: true },
          {
            enrollments: {
              some: {
                ...(effectiveDeptId ? { scheme: { departmentId: effectiveDeptId } } : {}),
                OR: [{ isArchived: true }, { status: { in: ["ARCHIVED", "Archived"] } }],
              },
            },
          },
        ],
      });
    }

    const whereClause: any = statusConditions.length > 0
      ? { AND: [...andConditions, ...statusConditions] }
      : (andConditions.length > 0 ? { AND: andConditions } : {});

    // Prepare pagination
    const skip = exportAll ? undefined : Math.max(0, (page - 1) * limit);
    const take = exportAll ? undefined : limit;

    // Calculate Status Card Counts and fetch beneficiaries concurrently in a single parallel batch
    const [
      countAll,
      countActive,
      countPending,
      countSuspended,
      countRejected,
      countArchived,
      beneficiaries,
    ] = await Promise.all([
      prisma.beneficiary.count({ where: baseWhereClause }),
      prisma.beneficiary.count({
        where: {
          ...baseWhereClause,
          AND: [
            ...(baseWhereClause.AND || []),
            {
              isArchived: false,
              enrollments: {
                some: {
                  ...(effectiveDeptId ? { scheme: { departmentId: effectiveDeptId } } : {}),
                  status: { in: ["ACTIVE", "Active"] },
                  isArchived: false,
                },
              },
            },
          ],
        },
      }),
      prisma.beneficiary.count({
        where: {
          ...baseWhereClause,
          AND: [
            ...(baseWhereClause.AND || []),
            {
              isArchived: false,
              enrollments: {
                some: {
                  ...(effectiveDeptId ? { scheme: { departmentId: effectiveDeptId } } : {}),
                  status: { in: ["PENDING", "Pending"] },
                  isArchived: false,
                },
              },
            },
          ],
        },
      }),
      prisma.beneficiary.count({
        where: {
          ...baseWhereClause,
          AND: [
            ...(baseWhereClause.AND || []),
            {
              enrollments: {
                some: {
                  ...(effectiveDeptId ? { scheme: { departmentId: effectiveDeptId } } : {}),
                  status: { in: ["SUSPENDED", "Suspended"] },
                  isArchived: false,
                },
              },
            },
          ],
        },
      }),
      prisma.beneficiary.count({
        where: {
          ...baseWhereClause,
          AND: [
            ...(baseWhereClause.AND || []),
            {
              enrollments: {
                some: {
                  ...(effectiveDeptId ? { scheme: { departmentId: effectiveDeptId } } : {}),
                  status: { in: ["REJECTED", "Rejected"] },
                },
              },
            },
          ],
        },
      }),
      prisma.beneficiary.count({
        where: {
          ...baseWhereClause,
          AND: [
            ...(baseWhereClause.AND || []),
            {
              OR: [
                { isArchived: true },
                {
                  enrollments: {
                    some: {
                      ...(effectiveDeptId ? { scheme: { departmentId: effectiveDeptId } } : {}),
                      OR: [{ isArchived: true }, { status: { in: ["ARCHIVED", "Archived"] } }],
                    },
                  },
                },
              ],
            },
          ],
        },
      }),
      prisma.beneficiary.findMany({
        where: whereClause,
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
        orderBy: { createdAt: "desc" },
        ...(skip !== undefined ? { skip } : {}),
        ...(take !== undefined ? { take } : {}),
      }),
    ]);

    const total =
      statusFilter === "ACTIVE"
        ? countActive
        : statusFilter === "PENDING"
        ? countPending
        : statusFilter === "SUSPENDED"
        ? countSuspended
        : statusFilter === "REJECTED"
        ? countRejected
        : statusFilter === "ARCHIVED"
        ? countArchived
        : countAll;

    const totalPages = Math.max(1, Math.ceil(total / limit));

    return NextResponse.json({
      success: true,
      count: beneficiaries.length,
      total,
      statusCounts: {
        all: countAll,
        active: countActive,
        pending: countPending,
        suspended: countSuspended,
        rejected: countRejected,
        archived: countArchived,
      },
      pagination: {
        total,
        page,
        limit,
        totalPages,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
      beneficiaries,
    });
  } catch (error: unknown) {
    console.error("Failed to fetch beneficiaries:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন (Unauthorized)" },
        { status: 401 }
      );
    }

    const isUnionViewer = session.user.role === "UNION_VIEWER";
    const userScopeDistrict = (session.user as any).district || (session.user as any).districtName || "নেত্রকোণা";
    const userScopeUpazila = (session.user as any).upazilaName || "নেত্রকোণা সদর";
    const userScopeUnion = (session.user as any).unionName || "";

    const body = await request.json();
    const {
      nameBn,
      nameEn,
      fatherName,
      gender,
      dateOfBirth,
      nid,
      brn,
      mobile,
      unionName,
      wardNo,
      schemeId,
      cardNumber,
    } = body;

    const finalDistrict = isUnionViewer && userScopeDistrict ? userScopeDistrict : (body.district?.trim() || "নেত্রকোণা");
    const finalUpazila = isUnionViewer && userScopeUpazila ? userScopeUpazila : (body.upazilaName?.trim() || "নেত্রকোণা সদর");
    const finalUnion = isUnionViewer && userScopeUnion ? userScopeUnion : (unionName?.trim() || "");

    if (!nameBn || !fatherName || !gender || !finalUnion || !wardNo) {
      return NextResponse.json(
        {
          success: false,
          error: "সুবিধাভোগীর নাম (বাংলা), পিতার নাম, লিঙ্গ, ইউনিয়ন ও ওয়ার্ড নম্বর আবশ্যক।",
        },
        { status: 400 }
      );
    }

    const targetEnrollmentStatus = isUnionViewer ? "PENDING" : "Active";

    // Check if beneficiary already exists by NID or BRN
    let existingBeneficiary = null;
    if (nid && nid.trim()) {
      existingBeneficiary = await prisma.beneficiary.findFirst({
        where: { nid: nid.trim() },
        include: { enrollments: true },
      });
    } else if (brn && brn.trim()) {
      existingBeneficiary = await prisma.beneficiary.findFirst({
        where: { brn: brn.trim() },
        include: { enrollments: true },
      });
    }

    if (existingBeneficiary && schemeId) {
      const alreadyInScheme = existingBeneficiary.enrollments.some(
        (e) =>
          e.schemeId === schemeId.trim() &&
          ["ACTIVE", "Active", "PENDING", "Pending"].includes(e.status)
      );
      if (alreadyInScheme) {
        return NextResponse.json(
          {
            success: false,
            error: "এই নাগরিকের নামে এই স্কিমে ইতিমধ্যে একটি সক্রিয় ভাতা বা অপেক্ষমান আবেদন রয়েছে।",
          },
          { status: 400 }
        );
      }
    }

    const cleanNameBn = nameBn.trim();
    const cleanNameEn = nameEn ? nameEn.trim() : "";
    const cleanFatherName = fatherName.trim();
    const cleanFullName = cleanNameEn ? `${cleanNameBn} (${cleanNameEn})` : cleanNameBn;
    const parsedDob = dateOfBirth ? new Date(dateOfBirth) : null;

    let created;
    if (existingBeneficiary) {
      if (schemeId) {
        await prisma.enrollment.create({
          data: {
            beneficiaryId: existingBeneficiary.id,
            schemeId: schemeId.trim(),
            status: targetEnrollmentStatus,
            cardNumber: cardNumber ? cardNumber.trim() : null,
            startDate: body.startDate ? new Date(body.startDate) : new Date(),
            uploadedBatchId: null,
            uploadedByUserId: session.user.id,
          },
        });
      }
      created = await prisma.beneficiary.findUnique({
        where: { id: existingBeneficiary.id },
        include: {
          enrollments: {
            include: { scheme: { include: { department: true } } },
          },
        },
      });
    } else {
      created = await prisma.beneficiary.create({
        data: {
          fullName: cleanFullName,
          nameBn: cleanNameBn,
          nameEn: cleanNameEn || null,
          fatherName: cleanFatherName,
          guardianName: cleanFatherName,
          gender: gender.trim(),
          dateOfBirth: parsedDob,
          nid: nid ? nid.trim() : null,
          brn: brn ? brn.trim() : null,
          mobile: mobile ? mobile.trim() : null,
          district: finalDistrict,
          upazilaName: finalUpazila,
          unionName: finalUnion,
          wardNo: wardNo.trim(),
          ...(schemeId
            ? {
                enrollments: {
                  create: {
                    schemeId: schemeId.trim(),
                    status: targetEnrollmentStatus,
                    cardNumber: cardNumber ? cardNumber.trim() : null,
                    startDate: body.startDate ? new Date(body.startDate) : new Date(),
                    uploadedBatchId: null,
                    uploadedByUserId: session.user.id,
                  },
                },
              }
            : {}),
        },
        include: {
          enrollments: {
            include: {
              scheme: { include: { department: true } },
            },
          },
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: isUnionViewer
        ? "সুবিধাভোগীর আবেদন সফলভাবে দাখিল করা হয়েছে। এটি সংশ্লিষ্ট দপ্তরের পর্যালোচনা ও অনুমোদনের জন্য অপেক্ষমান (Pending) রয়েছে।"
        : "সুবিধাভোগীর তথ্য সফলভাবে সংরক্ষণ করা হয়েছে।",
      beneficiary: created,
    });
  } catch (error: unknown) {
    console.error("Failed to create beneficiary:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন (Unauthorized)" },
        { status: 401 }
      );
    }

    if (session.user.role === "UNION_VIEWER") {
      return NextResponse.json(
        { success: false, error: "অ্যাক্সেস ডিনাইড: ইউনিয়ন পর্যবেক্ষক অ্যাকাউন্টে সুবিধাভোগীর তথ্য পরিবর্তনের অনুমতি নেই (Forbidden)" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      id,
      nameBn,
      nameEn,
      fatherName,
      fullName,
      guardianName,
      gender,
      dateOfBirth,
      nid,
      brn,
      mobile,
      unionName,
      wardNo,
      enrollmentId,
      cardNumber,
    } = body;

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Beneficiary ID is required." },
        { status: 400 }
      );
    }

    // Check if beneficiary exists
    const existing = await prisma.beneficiary.findUnique({
      where: { id },
      include: {
        enrollments: {
          include: { scheme: true },
        },
      },
    });

    if (existing) {
      const role = session.user.role;
      const userUpazila = (session.user as any).upazilaName;
      const userDeptId = session.user.departmentId;

      if (role === "UPAZILA_ADMIN" && userUpazila && existing.upazilaName !== userUpazila) {
        return NextResponse.json(
          { success: false, error: "অ্যাক্সেস ডিনাইড: অন্য উপজেলার উপকারভোগীর তথ্য পরিবর্তন করা যাবে না (Forbidden)" },
          { status: 403 }
        );
      }

      if (role === "DEPT_OFFICER" || role === "DEPARTMENT_OFFICER") {
        const upazilaMismatch = Boolean(userUpazila && existing.upazilaName !== userUpazila);
        const deptMismatch = Boolean(
          userDeptId && !existing.enrollments.some((e) => e.scheme.departmentId === userDeptId)
        );
        if (upazilaMismatch || deptMismatch) {
          return NextResponse.json(
            { success: false, error: "অ্যাক্সেস ডিনাইড: নিজ দপ্তর ও উপজেলার বাইরের উপকারভোগীর তথ্য পরিবর্তন করা যাবে না (Forbidden)" },
            { status: 403 }
          );
        }
      }
    }

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Beneficiary not found." },
        { status: 404 }
      );
    }

    // If NID changed, ensure it's not duplicate with another citizen
    if (nid && nid.trim() !== existing.nid) {
      const duplicateNid = await prisma.beneficiary.findFirst({
        where: { nid: nid.trim() },
      });
      if (duplicateNid && duplicateNid.id !== id) {
        return NextResponse.json(
          {
            success: false,
            error: "This NID is already registered to another citizen.",
          },
          { status: 400 }
        );
      }
    }

    // If BRN changed, ensure uniqueness
    if (brn && brn.trim() !== existing.brn) {
      const duplicateBrn = await prisma.beneficiary.findFirst({
        where: { brn: brn.trim() },
      });
      if (duplicateBrn && duplicateBrn.id !== id) {
        return NextResponse.json(
          {
            success: false,
            error: "This Birth Registration Number (BRN) is already registered.",
          },
          { status: 400 }
        );
      }
    }

    const cleanNameBn = nameBn !== undefined ? (nameBn ? nameBn.trim() : "") : existing.nameBn;
    const cleanNameEn = nameEn !== undefined ? (nameEn ? nameEn.trim() : "") : existing.nameEn;
    const cleanFatherName = fatherName !== undefined ? (fatherName ? fatherName.trim() : "") : existing.fatherName;

    const cleanFullName = cleanNameBn
      ? cleanNameEn ? `${cleanNameBn} (${cleanNameEn})` : cleanNameBn
      : (fullName ? fullName.trim() : existing.fullName);

    const cleanGuardianName = cleanFatherName || (guardianName ? guardianName.trim() : existing.guardianName);
    const parsedDob = dateOfBirth !== undefined ? (dateOfBirth ? new Date(dateOfBirth) : null) : existing.dateOfBirth;

    // Update Beneficiary details
    const updated = await prisma.beneficiary.update({
      where: { id },
      data: {
        fullName: cleanFullName,
        nameBn: cleanNameBn || null,
        nameEn: cleanNameEn || null,
        fatherName: cleanFatherName || null,
        guardianName: cleanGuardianName,
        ...(gender ? { gender: gender.trim() } : {}),
        dateOfBirth: parsedDob,
        nid: nid !== undefined ? (nid ? nid.trim() : null) : existing.nid,
        brn: brn !== undefined ? (brn ? brn.trim() : null) : existing.brn,
        ...(mobile !== undefined ? { mobile: mobile ? mobile.trim() : null } : {}),
        ...(body.district ? { district: body.district.trim() } : {}),
        ...(body.upazilaName ? { upazilaName: body.upazilaName.trim() } : {}),
        ...(unionName ? { unionName: unionName.trim() } : {}),
        ...(wardNo ? { wardNo: wardNo.trim() } : {}),
      },
      include: {
        enrollments: {
          include: {
            scheme: {
              include: { department: true },
            },
          },
        },
      },
    });

    // Optionally update enrollment card number and start date
    if (enrollmentId) {
      const enrollmentUpdate: any = {};
      if (cardNumber !== undefined) {
        enrollmentUpdate.cardNumber = cardNumber ? cardNumber.trim() : null;
      }
      if (body.startDate !== undefined && body.startDate) {
        enrollmentUpdate.startDate = new Date(body.startDate);
      }
      if (Object.keys(enrollmentUpdate).length > 0) {
        await prisma.enrollment.update({
          where: { id: enrollmentId },
          data: enrollmentUpdate,
        });
      }
    }

    return NextResponse.json({
      success: true,
      message: "Beneficiary updated successfully",
      beneficiary: updated,
    });
  } catch (error: unknown) {
    console.error("Failed to update beneficiary:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  // Policy rule: Deletion of beneficiary records is strictly prohibited for Upazila Admin, District Admin, and System Admin
  return NextResponse.json(
    {
      success: false,
      error:
        "সরকারি নীতিমালা অনুযায়ী উপজেলা এডমিন, জেলা এডমিন বা সিস্টেম এডমিন আইডি থেকে সরাসরি সুবিধাভোগীর ডাটা মুছে ফেলার অনুমতি নেই। তবে প্রয়োজনে তথ্য সম্পাদনা (Edit) করা যাবে অথবা অনুমোদন ইনবক্সের মাধ্যমে ভাতা বাতিলের আবেদন করা যাবে।",
    },
    { status: 403 }
  );
}
