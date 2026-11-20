import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

const dbUrl = process.env.DATABASE_URL!;
const adapter = new PrismaPg(dbUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🚀 Seeding 5 Kalmakanda duplicate test cases with DSS removal requests...");

  // 1. Ensure Social Services Department exists
  let dssDept = await prisma.department.findFirst({
    where: {
      OR: [
        { name: "Department of Social Services" },
        { nameBn: "সমাজসেবা অধিদপ্তর" },
      ],
    },
  });

  if (!dssDept) {
    dssDept = await prisma.department.create({
      data: {
        name: "Department of Social Services",
        nameBn: "সমাজসেবা অধিদপ্তর",
        nameEn: "Department of Social Services",
      },
    });
  }

  // Ensure Women Affairs Department exists
  let dwaDept = await prisma.department.findFirst({
    where: {
      OR: [
        { name: "Department of Women Affairs" },
        { nameBn: "মহিলা বিষয়ক অধিদপ্তর" },
      ],
    },
  });

  if (!dwaDept) {
    dwaDept = await prisma.department.create({
      data: {
        name: "Department of Women Affairs",
        nameBn: "মহিলা বিষয়ক অধিদপ্তর",
        nameEn: "Department of Women Affairs",
      },
    });
  }

  // Ensure Food Department exists
  let foodDept = await prisma.department.findFirst({
    where: {
      OR: [
        { name: "Directorate General of Food" },
        { nameBn: "খাদ্য অধিদপ্তর" },
      ],
    },
  });

  if (!foodDept) {
    foodDept = await prisma.department.create({
      data: {
        name: "Directorate General of Food",
        nameBn: "খাদ্য অধিদপ্তর",
        nameEn: "Directorate General of Food",
      },
    });
  }

  // Ensure Relief Department exists
  let reliefDept = await prisma.department.findFirst({
    where: {
      OR: [
        { name: "Department of Disaster Management & Relief" },
        { nameBn: "দুর্যোগ ব্যবস্থাপনা ও ত্রাণ মন্ত্রণালয়" },
      ],
    },
  });

  if (!reliefDept) {
    reliefDept = await prisma.department.create({
      data: {
        name: "Department of Disaster Management & Relief",
        nameBn: "দুর্যোগ ব্যবস্থাপনা ও ত্রাণ মন্ত্রণালয়",
        nameEn: "Department of Disaster Management & Relief",
      },
    });
  }

  // Ensure TCB exists
  let tcbDept = await prisma.department.findFirst({
    where: {
      OR: [
        { name: "Trading Corporation of Bangladesh (TCB)" },
        { nameBn: "ট্রেডিং কর্পোরেশন অব বাংলাদেশ (টিসিবি)" },
      ],
    },
  });

  if (!tcbDept) {
    tcbDept = await prisma.department.create({
      data: {
        name: "Trading Corporation of Bangladesh (TCB)",
        nameBn: "ট্রেডিং কর্পোরেশন অব বাংলাদেশ (টিসিবি)",
        nameEn: "Trading Corporation of Bangladesh (TCB)",
      },
    });
  }

  // Schemes setup helper
  async function ensureScheme(
    deptId: string,
    name: string,
    nameBn: string,
    monthlyAmount: number
  ) {
    let scheme = await prisma.scheme.findFirst({
      where: { departmentId: deptId, name },
    });
    if (!scheme) {
      scheme = await prisma.scheme.create({
        data: {
          departmentId: deptId,
          name,
          nameBn,
          monthlyAmount,
          frequency: "Monthly",
        },
      });
    }
    return scheme;
  }

  const oldAgeScheme = await ensureScheme(
    dssDept.id,
    "Old Age Allowance (বয়স্ক ভাতা)",
    "বয়স্ক ভাতা",
    600
  );
  const widowScheme = await ensureScheme(
    dssDept.id,
    "Widow & Destitute Women Allowance (বিধবা ভাতা)",
    "বিধবা ও স্বামী নিগৃহীতা ভাতা",
    550
  );
  const disabilityScheme = await ensureScheme(
    dssDept.id,
    "Disability Allowance (প্রতিবন্ধী ভাতা)",
    "প্রতিবন্ধী ভাতা",
    850
  );
  const vwbScheme = await ensureScheme(
    dwaDept.id,
    "Vulnerable Women Benefit - VWB (ভিডব্লিউবি)",
    "ভালনারেবল উইমেন বেনিফিট (ভিডব্লিউবি)",
    1050
  );
  const childScheme = await ensureScheme(
    dwaDept.id,
    "Mother & Child Benefit Programme (মাতৃকল্যাণ ভাতা)",
    "মা ও শিশু সহায়তা কর্মসূচি",
    800
  );
  const ffpScheme = await ensureScheme(
    foodDept.id,
    "Food Friendly Program - FFP (খাদ্য বান্ধব কর্মসূচি)",
    "খাদ্য বান্ধব কর্মসূচি (এফএফপি)",
    450
  );
  const vgfScheme = await ensureScheme(
    reliefDept.id,
    "Vulnerable Group Feeding - VGF (ভিজিএফ খাদ্য সহায়তা)",
    "ভিজিএফ খাদ্য সহায়তা",
    1200
  );
  const tcbScheme = await ensureScheme(
    tcbDept.id,
    "TCB Family Card Commodity Subsidy (টিসিবি ফ্যামিলি কার্ড)",
    "টিসিবি ফ্যামিলি কার্ড পণ্য ভর্তুকি",
    1000
  );

  // 2. Ensure Kalmakanda UNO and DSS Officer users exist
  let dssOfficer = await prisma.user.findFirst({
    where: { email: "dss.kalmakanda@netrokona.gov.bd" },
  });

  if (!dssOfficer) {
    dssOfficer = await prisma.user.create({
      data: {
        name: "উপজেলা সমাজসেবা কর্মকর্তা (কলমাকান্দা)",
        designation: "উপজেলা সমাজসেবা কর্মকর্তা",
        email: "dss.kalmakanda@netrokona.gov.bd",
        passwordHash: hashPassword("admin123"),
        role: "DEPT_OFFICER",
        district: "নেত্রকোণা",
        upazilaName: "কলমাকান্দা",
        departmentId: dssDept.id,
        phone: "01712000055",
        isActive: true,
      },
    });
    console.log("  ✓ Created Kalmakanda DSS Officer:", dssOfficer.email);
  }

  let kalmakandaUno = await prisma.user.findFirst({
    where: { email: "uno.kalmakanda@netrokona.gov.bd" },
  });

  if (!kalmakandaUno) {
    kalmakandaUno = await prisma.user.create({
      data: {
        name: "মো: আসাদুজ্জামান",
        designation: "উপজেলা নির্বাহী অফিসার, কলমাকান্দা",
        email: "uno.kalmakanda@netrokona.gov.bd",
        passwordHash: hashPassword("uno123"),
        role: "UPAZILA_ADMIN",
        district: "নেত্রকোণা",
        upazilaName: "কলমাকান্দা",
        phone: "01711000014",
        isActive: true,
      },
    });
    console.log("  ✓ Created Kalmakanda UNO:", kalmakandaUno.email);
  }

  // 3. Dummy Beneficiaries Definition for Kalmakanda
  const dummyBeneficiaries = [
    {
      nid: "19756815801000001",
      nameBn: "মোছাঃ রোকেয়া বেগম",
      nameEn: "Most. Rokeya Begum",
      fatherName: "মোঃ আব্দুল করিম",
      gender: "Female",
      dateOfBirth: new Date("1975-04-12"),
      mobile: "01711122301",
      unionName: "নাজিরপুর",
      wardNo: "৩",
      enrollments: [
        {
          schemeId: oldAgeScheme.id, // Primary (Senior)
          cardNumber: "KLM-DSS-101",
          startDate: new Date("2021-02-10"),
          status: "Active",
        },
        {
          schemeId: vwbScheme.id, // Excess (Junior) - Has Pending Removal Request
          cardNumber: "KLM-DWA-201",
          startDate: new Date("2023-05-15"),
          status: "Active",
          hasPendingRemoval: true,
          removalReason:
            "দপ্তর নিরীক্ষায় দেখা গেছে নাগরিক একই সাথে ভিডব্লিউবি এবং বয়স্ক ভাতা গ্রহণ করছেন। জ্যেষ্ঠতা ও নীতিমালা অনুযায়ী ভিডব্লিউবি ভাতা বাতিলের সুপারিশ করা হলো।",
        },
      ],
    },
    {
      nid: "19686815802000002",
      nameBn: "মোঃ নুরুল ইসলাম",
      nameEn: "Md. Nurul Islam",
      fatherName: "মৃত জালাল উদ্দিন",
      gender: "Male",
      dateOfBirth: new Date("1968-08-19"),
      mobile: "01711122302",
      unionName: "লেংগুরা",
      wardNo: "১",
      enrollments: [
        {
          schemeId: disabilityScheme.id, // Primary
          cardNumber: "KLM-DSS-102",
          startDate: new Date("2020-04-12"),
          status: "Active",
        },
        {
          schemeId: ffpScheme.id, // Excess - Ready for DSS officer to submit removal request in UI
          cardNumber: "KLM-FOOD-302",
          startDate: new Date("2023-08-01"),
          status: "Active",
          hasPendingRemoval: false,
        },
      ],
    },
    {
      nid: "19826815803000003",
      nameBn: "মোছাঃ ফাতেমা আক্তার",
      nameEn: "Most. Fatema Akter",
      fatherName: "মোঃ সিরাজুল ইসলাম",
      gender: "Female",
      dateOfBirth: new Date("1982-11-03"),
      mobile: "01711122303",
      unionName: "খারনৈ",
      wardNo: "৫",
      enrollments: [
        {
          schemeId: widowScheme.id, // Primary
          cardNumber: "KLM-DSS-103",
          startDate: new Date("2019-10-05"),
          status: "Active",
        },
        {
          schemeId: tcbScheme.id, // Excess
          cardNumber: "KLM-TCB-403",
          startDate: new Date("2024-01-10"),
          status: "Active",
          hasPendingRemoval: false,
        },
      ],
    },
    {
      nid: "19606815804000004",
      nameBn: "মোঃ আব্দুল কাইয়ুম",
      nameEn: "Md. Abdul Kaiyum",
      fatherName: "মোঃ আফসার উদ্দিন",
      gender: "Male",
      dateOfBirth: new Date("1960-03-25"),
      mobile: "01711122304",
      unionName: "রংছাতি",
      wardNo: "২",
      enrollments: [
        {
          schemeId: oldAgeScheme.id, // Primary
          cardNumber: "KLM-DSS-104",
          startDate: new Date("2018-06-20"),
          status: "Active",
        },
        {
          schemeId: vgfScheme.id, // Excess - Has Pending Removal Request
          cardNumber: "KLM-REL-504",
          startDate: new Date("2024-04-10"),
          status: "Active",
          hasPendingRemoval: true,
          removalReason:
            "নাগরিক দ্বৈত সুবিধা গ্রহণ করছেন। ভিজিএফ বরাদ্দ বাতিলপূর্বক কেবল বয়স্ক ভাতা বহাল রাখার সুপারিশ করা হলো।",
        },
      ],
    },
    {
      nid: "19856815805000005",
      nameBn: "মোছাঃ মরিয়ম নেসা",
      nameEn: "Most. Mariam Nesa",
      fatherName: "মোঃ রফিকুল ইসলাম",
      gender: "Female",
      dateOfBirth: new Date("1985-07-14"),
      mobile: "01711122305",
      unionName: "পোগলা",
      wardNo: "৪",
      enrollments: [
        {
          schemeId: childScheme.id, // Primary
          cardNumber: "KLM-DWA-205",
          startDate: new Date("2021-03-01"),
          status: "Active",
        },
        {
          schemeId: disabilityScheme.id, // Excess
          cardNumber: "KLM-DSS-105",
          startDate: new Date("2023-10-15"),
          status: "Active",
          hasPendingRemoval: false,
        },
      ],
    },
  ];

  // Ensure an UploadBatch exists for Kalmakanda test
  let testBatch = await prisma.uploadBatch.findFirst({
    where: { batchCode: "BATCH-KLM-TEST-2026" },
  });
  if (!testBatch) {
    testBatch = await prisma.uploadBatch.create({
      data: {
        batchCode: "BATCH-KLM-TEST-2026",
        fileName: "Kalmakanda_Social_Services_Test.xlsx",
        departmentId: dssDept.id,
        schemeId: oldAgeScheme.id,
        totalRecords: 10,
        uploadedByUserId: dssOfficer.id,
        district: "নেত্রকোণা",
        upazilaName: "কলমাকান্দা",
        status: "ACTIVE",
      },
    });
  }

  for (const bData of dummyBeneficiaries) {
    // Check if beneficiary already exists by NID
    let ben = await prisma.beneficiary.findFirst({
      where: { nid: bData.nid },
      include: { enrollments: true },
    });

    if (ben) {
      // Clean up previous test enrollments/removal requests to refresh cleanly
      await prisma.removalRequest.deleteMany({
        where: { beneficiaryId: ben.id },
      });
      await prisma.enrollment.deleteMany({
        where: { beneficiaryId: ben.id },
      });
      await prisma.beneficiary.delete({
        where: { id: ben.id },
      });
    }

    ben = await prisma.beneficiary.create({
      data: {
        nid: bData.nid,
        fullName: `${bData.nameBn} (${bData.nameEn})`,
        nameBn: bData.nameBn,
        nameEn: bData.nameEn,
        fatherName: bData.fatherName,
        guardianName: bData.fatherName,
        gender: bData.gender,
        dateOfBirth: bData.dateOfBirth,
        mobile: bData.mobile,
        district: "নেত্রকোণা",
        upazilaName: "কলমাকান্দা",
        unionName: bData.unionName,
        wardNo: bData.wardNo,
      },
      include: { enrollments: true },
    });

    console.log(`  ✓ Created Beneficiary: ${ben.nameBn} (${ben.unionName}, কলমাকান্দা)`);

    // Create enrollments
    for (const eData of bData.enrollments) {
      const enr = await prisma.enrollment.create({
        data: {
          beneficiaryId: ben.id,
          schemeId: eData.schemeId,
          cardNumber: eData.cardNumber,
          startDate: eData.startDate,
          status: eData.status,
          uploadedByUserId: dssOfficer.id,
          uploadedBatchId: testBatch.id,
        },
        include: { scheme: { include: { department: true } } },
      });

      if (eData.hasPendingRemoval) {
        await prisma.removalRequest.create({
          data: {
            enrollmentId: enr.id,
            beneficiaryId: ben.id,
            departmentId: enr.scheme.departmentId,
            requestedByUserId: dssOfficer.id,
            requestReason: (eData as any).removalReason || "দ্বৈত সুবিধা গ্রহণের কারণে ভাতা বাতিলের সুপারিশ।",
            status: "PENDING",
            district: "নেত্রকোণা",
            upazilaName: "কলমাকান্দা",
          },
        });
        console.log(
          `    ↳ Added PENDING Removal Request for [${enr.scheme.nameBn}] requested by DSS Officer`
        );
      }
    }
  }

  console.log("\n✅ Kalmakanda seeding finished successfully!");
  console.log("-------------------------------------------------------------------");
  console.log("🔑 টেস্ট লগইন ক্রেডেনশিয়াল (Login Credentials):");
  console.log("1. সমাজসেবা কর্মকর্তা (DSS Officer):");
  console.log("   - Email: dss.kalmakanda@netrokona.gov.bd");
  console.log("   - Password: admin123");
  console.log("   - সুবিধা: ড্যাশবোর্ডে গিয়ে যেকোনো সক্রিয় ভাতার জন্য নতুন 'বাদ দেওয়ার আবেদন' করতে পারবেন।");
  console.log("");
  console.log("2. উপজেলা নির্বাহী অফিসার (UNO, Kalmakanda):");
  console.log("   - Email: uno.kalmakanda@netrokona.gov.bd");
  console.log("   - Password: uno123");
  console.log("   - সুবিধা: '/admin/removal-requests' পেজে গিয়ে সমাজসেবা কর্মকর্তার পাঠানো আবেদনগুলো পর্যালোচনা করে অনুমোদন (বাতিল) বা প্রত্যাখ্যান করতে পারবেন।");
  console.log("-------------------------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("Seeding error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
