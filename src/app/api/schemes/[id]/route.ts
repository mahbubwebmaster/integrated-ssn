import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMonthlyEquivalent } from "@/lib/scheme-calc";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const scheme = await prisma.scheme.findUnique({
      where: { id },
      include: {
        department: true,
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!scheme) {
      return NextResponse.json(
        { success: false, error: "কর্মসূচি খুঁজে পাওয়া যায়নি (Scheme not found)" },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, scheme });
  } catch (error: unknown) {
    console.error("Failed to fetch scheme:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত অ্যাক্সেস (Unauthorized. Please log in)" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userRole = session.user.role;
    const userDeptId = session.user.departmentId;

    // RBAC: UNION_VIEWER cannot edit schemes
    if (userRole === "UNION_VIEWER") {
      return NextResponse.json(
        {
          success: false,
          error: "ইউনিয়ন পর্যবেক্ষকের কর্মসূচি সম্পাদনা করার অনুমতি নেই (Union viewers cannot edit welfare schemes)",
        },
        { status: 403 }
      );
    }

    const existingScheme = await prisma.scheme.findUnique({
      where: { id },
      include: { department: true },
    });

    if (!existingScheme) {
      return NextResponse.json(
        { success: false, error: "কর্মসূচি পাওয়া যায়নি (Scheme not found)" },
        { status: 404 }
      );
    }

    // RBAC: DEPT_OFFICER can ONLY edit their own department's scheme
    if (userRole === "DEPT_OFFICER" || userRole === "DEPARTMENT_OFFICER") {
      if (!userDeptId || existingScheme.departmentId !== userDeptId) {
        return NextResponse.json(
          {
            success: false,
            error: "দপ্তর কর্মকর্তা শুধুমাত্র নিজের নির্ধারিত দপ্তরের কর্মসূচি সম্পাদনা করতে পারবেন (Department officers can only edit schemes for their own department)",
          },
          { status: 403 }
        );
      }
    }

    const body = await request.json();
    const {
      departmentId,
      name,
      nameBn,
      nameEn,
      frequency,
      benefitType,
      cashAmount,
      commodityName,
      commodityNameBn,
      commodityNameEn,
      commodityQuantity,
      commodityUnit,
      commodityUnitBn,
      commodityUnitEn,
      commodityMarketValue,
      description,
    } = body;

    // If changing departmentId, only SUPER_ADMIN can do so
    let finalDeptId = existingScheme.departmentId;
    if (departmentId && departmentId !== existingScheme.departmentId) {
      if (userRole !== "SUPER_ADMIN") {
        return NextResponse.json(
          {
            success: false,
            error: "কর্মসূচির দপ্তর পরিবর্তন করার অধিকার শুধুমাত্র সুপার অ্যাডমিনের রয়েছে (Only Super Admin can change a scheme's department)",
          },
          { status: 403 }
        );
      }
      finalDeptId = departmentId;
    }

    const finalNameBn = nameBn !== undefined ? (nameBn ? String(nameBn).trim() : null) : existingScheme.nameBn;
    const finalNameEn = nameEn !== undefined ? (nameEn ? String(nameEn).trim() : null) : existingScheme.nameEn;
    
    let finalName = existingScheme.name;
    if (name !== undefined && name.trim()) {
      finalName = String(name).trim();
    } else if (finalNameEn || finalNameBn) {
      finalName = finalNameEn
        ? finalNameBn && finalNameBn !== finalNameEn
          ? `${finalNameEn} (${finalNameBn})`
          : finalNameEn
        : finalNameBn || existingScheme.name;
    }

    const finalFreq = frequency !== undefined ? String(frequency) : existingScheme.frequency;
    const finalBenefitType = benefitType !== undefined ? String(benefitType) : existingScheme.benefitType;

    const finalCash =
      cashAmount !== undefined
        ? cashAmount === "" || cashAmount === null
          ? null
          : parseFloat(String(cashAmount))
        : existingScheme.cashAmount;

    const finalCommValue =
      commodityMarketValue !== undefined
        ? commodityMarketValue === "" || commodityMarketValue === null
          ? null
          : parseFloat(String(commodityMarketValue))
        : existingScheme.commodityMarketValue;

    const finalCommQty =
      commodityQuantity !== undefined
        ? commodityQuantity === "" || commodityQuantity === null
          ? null
          : parseFloat(String(commodityQuantity))
        : existingScheme.commodityQuantity;

    const finalCommName =
      commodityName !== undefined
        ? commodityName === "" || commodityName === null
          ? null
          : String(commodityName).trim()
        : commodityNameBn || commodityNameEn || existingScheme.commodityName;

    const finalCommNameBn =
      commodityNameBn !== undefined
        ? commodityNameBn === "" || commodityNameBn === null
          ? null
          : String(commodityNameBn).trim()
        : existingScheme.commodityNameBn;

    const finalCommNameEn =
      commodityNameEn !== undefined
        ? commodityNameEn === "" || commodityNameEn === null
          ? null
          : String(commodityNameEn).trim()
        : existingScheme.commodityNameEn;

    const finalCommUnit =
      commodityUnit !== undefined
        ? commodityUnit === "" || commodityUnit === null
          ? null
          : String(commodityUnit).trim()
        : commodityUnitBn || commodityUnitEn || existingScheme.commodityUnit;

    const finalCommUnitBn =
      commodityUnitBn !== undefined
        ? commodityUnitBn === "" || commodityUnitBn === null
          ? null
          : String(commodityUnitBn).trim()
        : existingScheme.commodityUnitBn;

    const finalCommUnitEn =
      commodityUnitEn !== undefined
        ? commodityUnitEn === "" || commodityUnitEn === null
          ? null
          : String(commodityUnitEn).trim()
        : existingScheme.commodityUnitEn;

    const finalDesc =
      description !== undefined
        ? description === "" || description === null
          ? null
          : String(description).trim()
        : existingScheme.description;

    // Recalculate monthly amount
    const { monthlyAmount } = calculateMonthlyEquivalent({
      benefitType: finalBenefitType,
      cashAmount: finalCash,
      commodityMarketValue: finalCommValue,
      frequency: finalFreq,
    });

    const updatedScheme = await prisma.scheme.update({
      where: { id },
      data: {
        departmentId: finalDeptId,
        name: finalName,
        nameBn: finalNameBn,
        nameEn: finalNameEn,
        frequency: finalFreq,
        benefitType: finalBenefitType,
        cashAmount: finalCash,
        commodityName: finalCommName,
        commodityNameBn: finalCommNameBn,
        commodityNameEn: finalCommNameEn,
        commodityQuantity: finalCommQty,
        commodityUnit: finalCommUnit,
        commodityUnitBn: finalCommUnitBn,
        commodityUnitEn: finalCommUnitEn,
        commodityMarketValue: finalCommValue,
        monthlyAmount: monthlyAmount || 0,
        description: finalDesc,
      },
      include: {
        department: true,
        _count: {
          select: { enrollments: true },
        },
      },
    });

    return NextResponse.json({ success: true, scheme: updatedScheme });
  } catch (error: unknown) {
    console.error("Failed to update scheme:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত অ্যাক্সেস (Unauthorized. Please log in)" },
        { status: 401 }
      );
    }

    const { id } = await params;
    const userRole = session.user.role;
    const userDeptId = session.user.departmentId;

    // RBAC: UNION_VIEWER cannot delete schemes
    if (userRole === "UNION_VIEWER") {
      return NextResponse.json(
        {
          success: false,
          error: "ইউনিয়ন পর্যবেক্ষকের কর্মসূচি মুছে ফেলার অনুমতি নেই (Union viewers cannot delete welfare schemes)",
        },
        { status: 403 }
      );
    }

    const existingScheme = await prisma.scheme.findUnique({
      where: { id },
      include: {
        department: true,
        _count: {
          select: { enrollments: true },
        },
      },
    });

    if (!existingScheme) {
      return NextResponse.json(
        { success: false, error: "কর্মসূচি পাওয়া যায়নি (Scheme not found)" },
        { status: 404 }
      );
    }

    // RBAC: DEPT_OFFICER can ONLY delete their own department's scheme
    if (userRole === "DEPT_OFFICER" || userRole === "DEPARTMENT_OFFICER") {
      if (!userDeptId || existingScheme.departmentId !== userDeptId) {
        return NextResponse.json(
          {
            success: false,
            error: "দপ্তর কর্মকর্তা শুধুমাত্র নিজের নির্ধারিত দপ্তরের কর্মসূচি মুছে ফেলতে পারবেন (Department officers can only delete schemes for their own department)",
          },
          { status: 403 }
        );
      }
    }

    // Accidental data loss prevention check: Cannot delete scheme if active beneficiaries are enrolled
    if (existingScheme._count.enrollments > 0) {
      return NextResponse.json(
        {
          success: false,
          error: `এই কর্মসূচিতে ${existingScheme._count.enrollments} জন সুবিধাভোগী নিবন্ধিত আছেন! সুবিধাভোগী থাকা অবস্থায় কর্মসূচিটি মুছে ফেলা যাবে না।`,
        },
        { status: 400 }
      );
    }

    await prisma.scheme.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: "কর্মসূচি সফলভাবে মুছে ফেলা হয়েছে (Scheme deleted successfully)",
    });
  } catch (error: unknown) {
    console.error("Failed to delete scheme:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
