import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureDefaultMasterData } from "@/lib/seed";

export async function POST() {
  try {
    await ensureDefaultMasterData();

    const depts = await prisma.department.findMany({
      include: { schemes: true },
    });

    const socialDept = depts.find((d) => d.name.includes("Social Services")) || depts[0];
    const womenDept = depts.find((d) => d.name.includes("Women Affairs")) || depts[1];
    const foodDept = depts.find((d) => d.name.includes("Food")) || depts[2];
    const disasterDept = depts.find((d) => d.name.includes("Disaster")) || depts[3];

    const oldAgeScheme = socialDept.schemes.find((s) => s.name.includes("Old Age")) || socialDept.schemes[0];
    const widowScheme = socialDept.schemes.find((s) => s.name.includes("Widow")) || socialDept.schemes[1];
    const disabilityScheme = socialDept.schemes.find((s) => s.name.includes("Disability")) || socialDept.schemes[2];
    const vwbScheme = womenDept.schemes.find((s) => s.name.includes("VWB")) || womenDept.schemes[0];
    const mcbpScheme = womenDept.schemes.find((s) => s.name.includes("Mother")) || womenDept.schemes[1];
    const ffpScheme = foodDept.schemes.find((s) => s.name.includes("Food Friendly")) || foodDept.schemes[0];
    const vgfScheme = disasterDept.schemes.find((s) => s.name.includes("VGF")) || disasterDept.schemes[0];

    const sampleCitizens = [
      // 1. Triple-scheme multi-dipper (High Leak: VWB ৳1050 + Old Age ৳600 + FFP ৳450 = Excess ৳1050/mo)
      {
        fullName: "মোসাঃ রহিমা খাতুন (Rahima Khatun)",
        guardianName: "আব্দুল মজিদ (Abdul Majid)",
        gender: "Female",
        nid: "19652692015000123",
        mobile: "01711223344",
        unionName: "বাহাদুরপুর (Bahadurpur)",
        wardNo: "03",
        enrollments: [
          { schemeId: vwbScheme.id, cardNumber: "VWB-2026-001", status: "Active" },
          { schemeId: oldAgeScheme.id, cardNumber: "OAA-2026-045", status: "Active" },
          { schemeId: ffpScheme.id, cardNumber: "FFP-2026-112", status: "Active" },
        ],
      },
      // 2. Dual scheme multi-dipper (Widow Allowance ৳550 + VWB ৳1050 = Excess ৳550/mo)
      {
        fullName: "হাজেরা বেগম (Hazera Begum)",
        guardianName: "মৃত কফিল উদ্দিন (Late Kafil Uddin)",
        gender: "Female",
        nid: "19728234567890123",
        mobile: "01812345678",
        unionName: "বাহাদুরপুর (Bahadurpur)",
        wardNo: "01",
        enrollments: [
          { schemeId: vwbScheme.id, cardNumber: "VWB-2026-015", status: "Active" },
          { schemeId: widowScheme.id, cardNumber: "WID-2026-092", status: "Active" },
        ],
      },
      // 3. Dual scheme multi-dipper (Disability ৳850 + Old Age ৳600 = Excess ৳600/mo)
      {
        fullName: "মোঃ মজিবুর রহমান (Md. Mujibur Rahman)",
        guardianName: "মৃত আফসার আলী (Late Afsar Ali)",
        gender: "Male",
        nid: "19541234567890123",
        mobile: "01987654321",
        unionName: "রামপুর (Rampur)",
        wardNo: "02",
        enrollments: [
          { schemeId: disabilityScheme.id, cardNumber: "DIS-2026-008", status: "Active" },
          { schemeId: oldAgeScheme.id, cardNumber: "OAA-2026-088", status: "Active" },
        ],
      },
      // 4. Same NID registered with 13-digit legacy in one and 17-digit barcode in another
      {
        fullName: "জাহেদা খাতুন (Zaheda Khatun)",
        guardianName: "মোঃ নুরুল হক (Nurul Huq)",
        gender: "Female",
        nid: "19682692015000789", // 17-digit format
        mobile: "01733445566",
        unionName: "রামপুর (Rampur)",
        wardNo: "04",
        enrollments: [
          { schemeId: vwbScheme.id, cardNumber: "VWB-2026-042", status: "Active" },
          { schemeId: vgfScheme.id, cardNumber: "VGF-2026-019", status: "Active" },
        ],
      },
      // 5. Clean Single Beneficiary (Legitimate VWB)
      {
        fullName: "সালেহা আক্তার (Saleha Akhter)",
        guardianName: "রফিকুল ইসলাম (Rafiqul Islam)",
        gender: "Female",
        nid: "8234567890", // 10-digit Smart NID
        mobile: "01722334455",
        unionName: "মিরজাপুর (Mirzapur)",
        wardNo: "05",
        enrollments: [
          { schemeId: mcbpScheme.id, cardNumber: "MCBP-2026-031", status: "Active" },
        ],
      },
      // 6. Clean Single Beneficiary (Legitimate Old Age Allowance)
      {
        fullName: "মোঃ আবুল কালাম (Md. Abul Kalam)",
        guardianName: "মৃত সোবহান মিয়া (Late Sobhan Mia)",
        gender: "Male",
        nid: "19482692015000456",
        mobile: "01744556677",
        unionName: "মিরজাপুর (Mirzapur)",
        wardNo: "07",
        enrollments: [
          { schemeId: oldAgeScheme.id, cardNumber: "OAA-2026-104", status: "Active" },
        ],
      },
      // 7. Clean Single Beneficiary (Legitimate FFP Food Subsidy)
      {
        fullName: "আনোয়ারা বেগম (Anwara Begum)",
        guardianName: "মৃত ছাত্তার মোল্লা (Late Sattar Molla)",
        gender: "Female",
        nid: "19602692015000888",
        mobile: "01855667788",
        unionName: "শ্যামপুর (Shampur)",
        wardNo: "09",
        enrollments: [
          { schemeId: ffpScheme.id, cardNumber: "FFP-2026-302", status: "Active" },
        ],
      },
      // 8. BRN Duplicate (Mother & Child Benefit + VGF on same digital birth certificate)
      {
        fullName: "ফাতেমা জান্নাত (Fatema Jannat)",
        guardianName: "মোঃ বাবুল হোসেন (Babul Hossain)",
        gender: "Female",
        brn: "20062692015009999", // 17-digit BRN
        mobile: "01799887766",
        unionName: "শ্যামপুর (Shampur)",
        wardNo: "08",
        enrollments: [
          { schemeId: mcbpScheme.id, cardNumber: "MCBP-2026-099", status: "Active" },
          { schemeId: vgfScheme.id, cardNumber: "VGF-2026-401", status: "Active" },
        ],
      },
    ];

    let createdBeneficiaries = 0;
    let createdEnrollments = 0;

    for (const citizen of sampleCitizens) {
      let b = await prisma.beneficiary.findFirst({
        where: {
          OR: [
            ...(citizen.nid ? [{ nid: citizen.nid }] : []),
            ...(citizen.brn ? [{ brn: citizen.brn }] : []),
          ],
        },
      });

      if (!b) {
        b = await prisma.beneficiary.create({
          data: {
            fullName: citizen.fullName,
            guardianName: citizen.guardianName,
            gender: citizen.gender,
            nid: citizen.nid || null,
            brn: citizen.brn || null,
            mobile: citizen.mobile || null,
            unionName: citizen.unionName,
            wardNo: citizen.wardNo,
          },
        });
        createdBeneficiaries++;
      }

      for (const enr of citizen.enrollments) {
        const existingEnr = await prisma.enrollment.findFirst({
          where: {
            beneficiaryId: b.id,
            schemeId: enr.schemeId,
          },
        });

        if (!existingEnr) {
          await prisma.enrollment.create({
            data: {
              beneficiaryId: b.id,
              schemeId: enr.schemeId,
              cardNumber: enr.cardNumber,
              startDate: new Date(2024, 0, 15),
              status: enr.status,
              uploadedBatchId: "DEMO-SAMPLE-BATCH",
            },
          });
          createdEnrollments++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      createdBeneficiaries,
      createdEnrollments,
    });
  } catch (error: unknown) {
    console.error("Demo seed failed:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
