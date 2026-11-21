import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { ensureDefaultMasterData } from "@/lib/seed";
import { calculateMonthlyEquivalent } from "@/lib/scheme-calc";

let cachedDepartments: any = null;
let cachedDepartmentsTime = 0;
const DEPT_CACHE_TTL = 60 * 1000;

export async function GET() {
  try {
    if (cachedDepartments && Date.now() - cachedDepartmentsTime < DEPT_CACHE_TTL) {
      return NextResponse.json({ success: true, departments: cachedDepartments });
    }

    await ensureDefaultMasterData();

    const departments = await prisma.department.findMany({
      include: {
        schemes: {
          orderBy: { name: "asc" },
        },
      },
      orderBy: { name: "asc" },
    });

    cachedDepartments = departments;
    cachedDepartmentsTime = Date.now();

    return NextResponse.json(
      { success: true, departments },
      { headers: { "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (error: unknown) {
    console.error("Failed to fetch departments:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত অ্যাক্সেস (Unauthorized)" },
        { status: 401 }
      );
    }

    const userRole = session.user.role;
    const userDeptId = session.user.departmentId;

    if (userRole === "UNION_VIEWER") {
      return NextResponse.json(
        { success: false, error: "ইউনিয়ন পর্যবেক্ষকের কর্মসূচি তৈরির অনুমতি নেই" },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Check if this is a request to create a new Department
    if (body.type === "DEPARTMENT" || body.isDepartment || (!body.departmentId && (body.nameBn || body.nameEn))) {
      if (userRole !== "SUPER_ADMIN") {
        return NextResponse.json(
          { success: false, error: "শুধুমাত্র সুপার অ্যাডমিন নতুন দপ্তর যোগ করতে পারবেন" },
          { status: 403 }
        );
      }
      const cleanNameBn = (body.nameBn || "").trim();
      const cleanNameEn = (body.nameEn || body.name || "").trim();
      if (!cleanNameBn && !cleanNameEn) {
        return NextResponse.json(
          { success: false, error: "দপ্তরের নাম (বাংলা অথবা ইংরেজি) আবশ্যক" },
          { status: 400 }
        );
      }
      const legacyName = cleanNameEn || cleanNameBn;
      const department = await prisma.department.create({
        data: {
          name: legacyName,
          nameBn: cleanNameBn || null,
          nameEn: cleanNameEn || null,
        },
      });
      cachedDepartments = null;
      return NextResponse.json({ success: true, department });
    }

    const {
      departmentId,
      name,
      nameBn,
      nameEn,
      monthlyAmount,
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
        { success: false, error: "Missing required fields (departmentId, name)" },
        { status: 400 }
      );
    }

    // RBAC: DEPT_OFFICER can ONLY add schemes for their assigned department
    if (userRole === "DEPT_OFFICER" || userRole === "DEPARTMENT_OFFICER") {
      if (!userDeptId || userDeptId !== departmentId) {
        return NextResponse.json(
          {
            success: false,
            error: "দপ্তর কর্মকর্তা শুধুমাত্র নিজের নির্ধারিত দপ্তরের কর্মসূচি যোগ করতে পারবেন",
          },
          { status: 403 }
        );
      }
    }

    const parsedCash = cashAmount !== undefined && cashAmount !== null && cashAmount !== "" ? parseFloat(String(cashAmount)) : null;
    const parsedCommValue =
      commodityMarketValue !== undefined && commodityMarketValue !== null && commodityMarketValue !== ""
        ? parseFloat(String(commodityMarketValue))
        : null;
    const parsedCommQty =
      commodityQuantity !== undefined && commodityQuantity !== null && commodityQuantity !== ""
        ? parseFloat(String(commodityQuantity))
        : null;

    let computedMonthly = parseFloat(String(monthlyAmount)) || 0;
    if (monthlyAmount === undefined || monthlyAmount === null || monthlyAmount === "") {
      const calc = calculateMonthlyEquivalent({
        benefitType,
        cashAmount: parsedCash,
        commodityMarketValue: parsedCommValue,
        frequency,
      });
      computedMonthly = calc.monthlyAmount;
    }

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
        monthlyAmount: computedMonthly,
        frequency: frequency || "Monthly",
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
        description: description ? String(description).trim() : null,
      },
      include: {
        department: true,
      },
    });

    return NextResponse.json({ success: true, scheme });
  } catch (error: unknown) {
    console.error("Failed to create scheme:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
