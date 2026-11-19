import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateMonthlyEquivalent } from "@/lib/scheme-calc";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const departmentId = searchParams.get("departmentId")?.trim() || "";
    const frequency = searchParams.get("frequency")?.trim() || "";
    const benefitType = searchParams.get("benefitType")?.trim() || "";
    const search = searchParams.get("search")?.trim().toLowerCase() || "";

    const where: any = {};

    if (departmentId) {
      where.departmentId = departmentId;
    }
    if (frequency && frequency !== "ALL") {
      where.frequency = frequency;
    }
    if (benefitType && benefitType !== "ALL") {
      where.benefitType = benefitType;
    }
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameBn: { contains: search } },
        { nameEn: { contains: search } },
        { department: { name: { contains: search } } },
        { department: { nameBn: { contains: search } } },
        { department: { nameEn: { contains: search } } },
        { commodityName: { contains: search } },
        { commodityNameBn: { contains: search } },
        { commodityNameEn: { contains: search } },
      ];
    }

    const schemes = await prisma.scheme.findMany({
      where,
      include: {
        department: true,
        _count: {
          select: { enrollments: true },
        },
      },
      orderBy: [
        { department: { name: "asc" } },
        { name: "asc" },
      ],
    });

    return NextResponse.json({ success: true, schemes });
  } catch (error: unknown) {
    console.error("Failed to fetch schemes:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত অ্যাক্সেস (Unauthorized. Please log in)" },
        { status: 401 }
      );
    }

    const userRole = session.user.role;
    const userDeptId = session.user.departmentId;

    // RBAC: UNION_VIEWER cannot create schemes
    if (userRole === "UNION_VIEWER") {
      return NextResponse.json(
        {
          success: false,
          error: "ইউনিয়ন পর্যবেক্ষকের কর্মসূচি যোগ করার অনুমতি নেই (Union viewers cannot add welfare schemes)",
        },
        { status: 403 }
      );
    }

    const body = await request.json();
    const {
      departmentId,
      name,
      nameBn,
      nameEn,
      frequency = "Monthly",
      benefitType = "CASH",
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

    const finalNameBn = (nameBn || name || "").trim();
    const finalNameEn = (nameEn || name || "").trim();

    if (!departmentId || (!finalNameBn && !finalNameEn)) {
      return NextResponse.json(
        { success: false, error: "দপ্তর এবং কর্মসূচির নাম পূরণ করা আবশ্যক (Department and Scheme Name are required)" },
        { status: 400 }
      );
    }

    // RBAC: DEPT_OFFICER can ONLY add schemes for their own assigned department
    if (userRole === "DEPT_OFFICER" || userRole === "DEPARTMENT_OFFICER") {
      if (!userDeptId || userDeptId !== departmentId) {
        return NextResponse.json(
          {
            success: false,
            error: "দপ্তর কর্মকর্তা শুধুমাত্র নিজের নির্ধারিত দপ্তরের কর্মসূচি যোগ করতে পারবেন (Department officers can only add schemes for their own department)",
          },
          { status: 403 }
        );
      }
    }

    // Validate that the department exists
    const dept = await prisma.department.findUnique({
      where: { id: departmentId },
    });
    if (!dept) {
      return NextResponse.json(
        { success: false, error: "নির্বাচিত দপ্তর পাওয়া যায়নি (Selected department not found)" },
        { status: 404 }
      );
    }

    // Calculate normalized monthly equivalent amount
    const parsedCash = cashAmount !== undefined && cashAmount !== null && cashAmount !== "" ? parseFloat(String(cashAmount)) : null;
    const parsedCommValue =
      commodityMarketValue !== undefined && commodityMarketValue !== null && commodityMarketValue !== ""
        ? parseFloat(String(commodityMarketValue))
        : null;
    const parsedCommQty =
      commodityQuantity !== undefined && commodityQuantity !== null && commodityQuantity !== ""
        ? parseFloat(String(commodityQuantity))
        : null;

    const { monthlyAmount } = calculateMonthlyEquivalent({
      benefitType,
      cashAmount: parsedCash,
      commodityMarketValue: parsedCommValue,
      frequency,
    });

    const legacyName = finalNameEn
      ? finalNameBn && finalNameBn !== finalNameEn
        ? `${finalNameEn} (${finalNameBn})`
        : finalNameEn
      : finalNameBn;

    const scheme = await prisma.scheme.create({
      data: {
        departmentId,
        name: legacyName,
        nameBn: finalNameBn || null,
        nameEn: finalNameEn || null,
        frequency,
        benefitType,
        cashAmount: parsedCash,
        commodityName: commodityName ? String(commodityName).trim() : (commodityNameBn || commodityNameEn || null),
        commodityNameBn: commodityNameBn ? String(commodityNameBn).trim() : null,
        commodityNameEn: commodityNameEn ? String(commodityNameEn).trim() : null,
        commodityQuantity: parsedCommQty,
        commodityUnit: commodityUnit ? String(commodityUnit).trim() : (commodityUnitBn || commodityUnitEn || null),
        commodityUnitBn: commodityUnitBn ? String(commodityUnitBn).trim() : null,
        commodityUnitEn: commodityUnitEn ? String(commodityUnitEn).trim() : null,
        commodityMarketValue: parsedCommValue,
        monthlyAmount: monthlyAmount || 0,
        description: description ? String(description).trim() : null,
      },
      include: {
        department: true,
        _count: {
          select: { enrollments: true },
        },
      },
    });

    return NextResponse.json({ success: true, scheme }, { status: 201 });
  } catch (error: unknown) {
    console.error("Failed to create scheme:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
