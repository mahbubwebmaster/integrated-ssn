import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionUser, getBeneficiaryScope } from "@/lib/data-scope";

async function ensureBeneficiaryDataIntegrity() {
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

    if (!unmigrated || unmigrated.length === 0) return;

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

    // Apply statusFilter (ALL, ACTIVE, SUSPENDED, ARCHIVED)
    const statusConditions: any[] = [];
    if (statusFilter === "ACTIVE") {
      statusConditions.push({
        isArchived: false,
        enrollments: {
          some: {
            ...(departmentId ? { scheme: { departmentId } } : {}),
            status: { in: ["ACTIVE", "Active"] },
            isArchived: false,
          },
        },
      });
    } else if (statusFilter === "SUSPENDED") {
      statusConditions.push({
        enrollments: {
          some: {
            ...(departmentId ? { scheme: { departmentId } } : {}),
            status: { in: ["SUSPENDED", "Suspended"] },
            isArchived: false,
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
                ...(departmentId ? { scheme: { departmentId } } : {}),
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

    // Calculate Status Card Counts in parallel
    const [countAll, countActive, countSuspended, countArchived, total] = await Promise.all([
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
                  ...(departmentId ? { scheme: { departmentId } } : {}),
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
              enrollments: {
                some: {
                  ...(departmentId ? { scheme: { departmentId } } : {}),
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
              OR: [
                { isArchived: true },
                {
                  enrollments: {
                    some: {
                      ...(departmentId ? { scheme: { departmentId } } : {}),
                      OR: [{ isArchived: true }, { status: { in: ["ARCHIVED", "Archived"] } }],
                    },
                  },
                },
              ],
            },
          ],
        },
      }),
      prisma.beneficiary.count({
        where: whereClause,
      }),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const effectivePage = Math.min(page, totalPages);
    const skip = exportAll ? undefined : (effectivePage - 1) * limit;
    const take = exportAll ? undefined : limit;

    const beneficiaries = await prisma.beneficiary.findMany({
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
    });

    return NextResponse.json({
      success: true,
      count: beneficiaries.length,
      total,
      statusCounts: {
        all: countAll,
        active: countActive,
        suspended: countSuspended,
        archived: countArchived,
      },
      pagination: {
        total,
        page: effectivePage,
        limit,
        totalPages,
        hasNextPage: effectivePage < totalPages,
        hasPrevPage: effectivePage > 1,
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

    if (!nameBn || !fatherName || !gender || !unionName || !wardNo) {
      return NextResponse.json(
        {
          success: false,
          error: "সুবিধাভোগীর নাম (বাংলা), পিতার নাম, লিঙ্গ, ইউনিয়ন ও ওয়ার্ড নম্বর আবশ্যক।",
        },
        { status: 400 }
      );
    }

    // Check NID uniqueness
    if (nid && nid.trim()) {
      const duplicateNid = await prisma.beneficiary.findFirst({
        where: { nid: nid.trim() },
      });
      if (duplicateNid) {
        return NextResponse.json(
          {
            success: false,
            error: "এই জাতীয় পরিচয়পত্র (NID) ইতিমধ্যে অন্য একজন নাগরিকের নামে নিবন্ধিত।",
          },
          { status: 400 }
        );
      }
    }

    // Check BRN uniqueness
    if (brn && brn.trim()) {
      const duplicateBrn = await prisma.beneficiary.findFirst({
        where: { brn: brn.trim() },
      });
      if (duplicateBrn) {
        return NextResponse.json(
          {
            success: false,
            error: "এই জন্ম নিবন্ধন নম্বর (BRN) ইতিমধ্যে নিবন্ধিত রয়েছে।",
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

    const created = await prisma.beneficiary.create({
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
        district: body.district ? body.district.trim() : "নেত্রকোণা",
        upazilaName: body.upazilaName ? body.upazilaName.trim() : "নেত্রকোণা সদর",
        unionName: unionName.trim(),
        wardNo: wardNo.trim(),
        ...(schemeId
          ? {
              enrollments: {
                create: {
                  schemeId: schemeId.trim(),
                  status: "Active",
                  cardNumber: cardNumber ? cardNumber.trim() : null,
                  startDate: body.startDate ? new Date(body.startDate) : new Date(),
                  uploadedBatchId: `MANUAL-${new Date().toISOString().split("T")[0]}`,
                },
              },
            }
          : {}),
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

    return NextResponse.json({
      success: true,
      message: "সুবিধাভোগীর তথ্য সফলভাবে সংরক্ষণ করা হয়েছে।",
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
    });

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
