import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { NETROKONA_UPAZILAS, NETROKONA_DISTRICT } from "../src/lib/netrokona";

function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

const dbUrl = process.env.DATABASE_URL!;
const adapter = new PrismaPg(dbUrl);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Starting Netrokona District & Upazila Seeding for SSNP System...");

  // --------------------------------------------------------------------------
  // 1. Seed Administrative Hierarchy: District & Upazilas
  // --------------------------------------------------------------------------
  console.log("\n📍 1. Seeding Administrative Hierarchy (District & Upazilas)...");

  const district = await prisma.district.upsert({
    where: { nameBn: NETROKONA_DISTRICT.nameBn },
    update: {
      nameEn: NETROKONA_DISTRICT.nameEn,
      code: "NET",
    },
    create: {
      nameBn: NETROKONA_DISTRICT.nameBn,
      nameEn: NETROKONA_DISTRICT.nameEn,
      code: "NET",
    },
  });
  console.log(`  ✓ District: ${district.nameBn} (${district.nameEn}) [${district.code}]`);

  for (const u of NETROKONA_UPAZILAS) {
    await prisma.upazila.upsert({
      where: {
        nameBn_districtId: {
          nameBn: u.nameBn,
          districtId: district.id,
        },
      },
      update: {
        nameEn: u.nameEn,
      },
      create: {
        nameBn: u.nameBn,
        nameEn: u.nameEn,
        districtId: district.id,
      },
    });
  }
  console.log(`  ✓ Seeded ${NETROKONA_UPAZILAS.length} Upazilas under ${district.nameBn}`);

  // --------------------------------------------------------------------------
  // 2. Seed Core Departments and Schemes
  // --------------------------------------------------------------------------
  console.log("\n🏢 2. Seeding Core Government Departments & Safety Net Schemes...");

  const departmentsData = [
    {
      name: "Department of Social Services",
      nameBn: "সমাজসেবা অধিদপ্তর",
      nameEn: "Department of Social Services",
      schemes: [
        { name: "Old Age Allowance (বয়স্ক ভাতা)", nameBn: "বয়স্ক ভাতা", nameEn: "Old Age Allowance", monthlyAmount: 600, frequency: "Monthly" },
        { name: "Widow & Destitute Women Allowance (বিধবা ভাতা)", nameBn: "বিধবা ও স্বামী নিগৃহীতা ভাতা", nameEn: "Widow & Destitute Women Allowance", monthlyAmount: 550, frequency: "Monthly" },
        { name: "Disability Allowance (প্রতিবন্ধী ভাতা)", nameBn: "প্রতিবন্ধী ভাতা", nameEn: "Disability Allowance", monthlyAmount: 850, frequency: "Monthly" },
      ],
    },
    {
      name: "Department of Women Affairs",
      nameBn: "মহিলা বিষয়ক অধিদপ্তর",
      nameEn: "Department of Women Affairs",
      schemes: [
        { name: "Vulnerable Women Benefit - VWB (ভিডব্লিউবি)", nameBn: "ভালনারেবল উইমেন বেনিফিট (ভিডব্লিউবি)", nameEn: "Vulnerable Women Benefit (VWB)", monthlyAmount: 1050, frequency: "Monthly" },
        { name: "Mother & Child Benefit Programme (মাতৃকল্যাণ ভাতা)", nameBn: "মা ও শিশু সহায়তা কর্মসূচি", nameEn: "Mother & Child Benefit Programme", monthlyAmount: 800, frequency: "Monthly" },
      ],
    },
    {
      name: "Department of Disaster Management & Relief",
      nameBn: "দুর্যোগ ব্যবস্থাপনা ও ত্রাণ মন্ত্রণালয়",
      nameEn: "Department of Disaster Management & Relief",
      schemes: [
        { name: "Vulnerable Group Feeding - VGF (ভিজিএফ খাদ্য সহায়তা)", nameBn: "ভিজিএফ খাদ্য সহায়তা", nameEn: "Vulnerable Group Feeding (VGF)", monthlyAmount: 1200, frequency: "One-time" },
        { name: "Gratuitous Relief - GR Cash (জরুরি নগদ সহায়তা)", nameBn: "জিআর নগদ সহায়তা", nameEn: "Gratuitous Relief (GR Cash)", monthlyAmount: 1000, frequency: "One-time" },
      ],
    },
    {
      name: "Directorate General of Food",
      nameBn: "খাদ্য অধিদপ্তর",
      nameEn: "Directorate General of Food",
      schemes: [
        { name: "Food Friendly Program - FFP (খাদ্য বান্ধব কর্মসূচি)", nameBn: "খাদ্য বান্ধব কর্মসূচি (এফএফপি)", nameEn: "Food Friendly Program (FFP)", monthlyAmount: 450, frequency: "Monthly" },
        { name: "Open Market Sale - OMS Subsidized Rice (ওএমএস)", nameBn: "ওএমএস খাদ্য সহায়তা", nameEn: "Open Market Sale (OMS)", monthlyAmount: 600, frequency: "Monthly" },
      ],
    },
    {
      name: "Trading Corporation of Bangladesh (TCB)",
      nameBn: "ট্রেডিং কর্পোরেশন অব বাংলাদেশ (টিসিবি)",
      nameEn: "Trading Corporation of Bangladesh (TCB)",
      schemes: [
        { name: "TCB Family Card Commodity Subsidy (টিসিবি ফ্যামিলি কার্ড)", nameBn: "টিসিবি ফ্যামিলি কার্ড পণ্য ভর্তুকি", nameEn: "TCB Family Card Commodity Subsidy", monthlyAmount: 1000, frequency: "Monthly" },
      ],
    },
  ];

  const deptMap = new Map<string, any>();

  for (const deptData of departmentsData) {
    let dept = await prisma.department.findUnique({
      where: { name: deptData.name },
    });

    if (!dept) {
      dept = await prisma.department.create({
        data: {
          name: deptData.name,
          nameBn: deptData.nameBn,
          nameEn: deptData.nameEn,
          districtName: NETROKONA_DISTRICT.nameBn,
        },
      });
      console.log(`  ✓ Created Department: ${dept.nameBn || dept.name}`);
    } else {
      await prisma.department.update({
        where: { id: dept.id },
        data: {
          nameBn: deptData.nameBn,
          nameEn: deptData.nameEn,
          districtName: NETROKONA_DISTRICT.nameBn,
        },
      });
    }

    deptMap.set(deptData.name, dept);

    for (const schemeData of deptData.schemes) {
      const existingScheme = await prisma.scheme.findFirst({
        where: { departmentId: dept.id, name: schemeData.name },
      });

      if (!existingScheme) {
        await prisma.scheme.create({
          data: {
            departmentId: dept.id,
            name: schemeData.name,
            nameBn: schemeData.nameBn,
            nameEn: schemeData.nameEn,
            monthlyAmount: schemeData.monthlyAmount,
            frequency: schemeData.frequency,
          },
        });
        console.log(`    ↳ Created Scheme: ${schemeData.nameBn || schemeData.name} (৳${schemeData.monthlyAmount}/mo)`);
      }
    }
  }

  const socialDept = deptMap.get("Department of Social Services")!;
  const womenDept = deptMap.get("Department of Women Affairs")!;
  const foodDept = deptMap.get("Directorate General of Food")!;
  const dmrDept = deptMap.get("Department of Disaster Management & Relief")!;

  // --------------------------------------------------------------------------
  // 3. User Model Roles: DISTRICT_ADMIN, UPAZILA_ADMIN, DEPT_OFFICER, SUPER_ADMIN
  // --------------------------------------------------------------------------
  console.log("\n👥 3. Seeding User Accounts (DISTRICT_ADMIN, UPAZILA_ADMIN, DEPT_OFFICER)...");

  const usersToSeed: any[] = [
    // 3.1 District Admin (Deputy Commissioner - DC) -> dc@district.gov.bd / dc123
    {
      name: "বনানী বিশ্বাস",
      designation: "জেলা প্রশাসক ও জেলা ম্যাজিস্ট্রেট, নেত্রকোণা",
      email: "dc@district.gov.bd",
      password: "dc123",
      role: "DISTRICT_ADMIN",
      district: NETROKONA_DISTRICT.nameBn,
      districtName: NETROKONA_DISTRICT.nameBn,
      upazilaName: null,
      departmentId: null,
      unionName: null,
      phone: "01713000001",
      isActive: true,
    },
    // Compat DC Login
    {
      name: "বনানী বিশ্বাস",
      designation: "জেলা প্রশাসক ও জেলা ম্যাজিস্ট্রেট, নেত্রকোণা",
      email: "dc@netrokona.gov.bd",
      password: "admin123",
      role: "DISTRICT_ADMIN",
      district: NETROKONA_DISTRICT.nameBn,
      districtName: NETROKONA_DISTRICT.nameBn,
      upazilaName: null,
      departmentId: null,
      unionName: null,
      phone: "01713000001",
      isActive: true,
    },
    // Super Admin / ICT Cell
    {
      name: "সিস্টেম অ্যাডমিনিস্ট্রেটর",
      designation: "সহকারী প্রোগ্রামার (আইসিটি সেল), নেত্রকোণা",
      email: "admin@upazila.gov.bd",
      password: "admin123",
      role: "SUPER_ADMIN",
      district: NETROKONA_DISTRICT.nameBn,
      districtName: NETROKONA_DISTRICT.nameBn,
      upazilaName: null,
      departmentId: null,
      unionName: null,
      phone: "01711000000",
      isActive: true,
    },
  ];

  // 3.2 Upazila Executive Officers (UNOs - UPAZILA_ADMIN)
  const unoOfficers = [
    { key: "kalmakanda", name: "মো: আসাদুজ্জামান", upazilaName: "কলমাকান্দা", phone: "01711000014" },
    { key: "durgapur", name: "নাভীদ রেজওয়ানুল কবীর", upazilaName: "দুর্গাপুর", phone: "01711000013" },
    { key: "sadar", name: "তানিয়া আক্তার", upazilaName: "নেত্রকোণা সদর", phone: "01711000011" },
    { key: "kendua", name: "মো: ইমদাদুল হক তালুকদার", upazilaName: "কেন্দুয়া", phone: "01711000012" },
    { key: "barhatta", name: "ফারজানা আক্তার ববি", upazilaName: "বারহাট্টা", phone: "01711000015" },
    { key: "madan", name: "মো: শাহ আলম মিয়া", upazilaName: "মদন", phone: "01711000016" },
    { key: "mohanganj", name: "ছাব্বির আহমেদ আকুঞ্জি", upazilaName: "মোহনগঞ্জ", phone: "01711000017" },
    { key: "khaliajuri", name: "মো: সামিউল ইসলাম", upazilaName: "খালিয়াজুড়ি", phone: "01711000018" },
    { key: "purbadhala", name: "রেহানা আক্তার", upazilaName: "পূর্বধলা", phone: "01711000019" },
    { key: "atpara", name: "এম. সাজ্জাদুল হাসান", upazilaName: "আটপাড়া", phone: "01711000020" },
  ];

  for (const uno of unoOfficers) {
    usersToSeed.push({
      name: uno.name,
      designation: `উপজেলা নির্বাহী অফিসার, ${uno.upazilaName}`,
      email: `uno.${uno.key}@netrokona.gov.bd`,
      password: "uno123",
      role: "UPAZILA_ADMIN",
      district: NETROKONA_DISTRICT.nameBn,
      districtName: NETROKONA_DISTRICT.nameBn,
      upazilaName: uno.upazilaName,
      departmentId: null,
      unionName: null,
      phone: uno.phone,
      isActive: true,
    });
  }

  // Legacy default uno@upazila.gov.bd
  usersToSeed.push({
    name: "তানিয়া আক্তার",
    designation: "উপজেলা নির্বাহী অফিসার, নেত্রকোণা সদর",
    email: "uno@upazila.gov.bd",
    password: "uno123",
    role: "UPAZILA_ADMIN",
    district: NETROKONA_DISTRICT.nameBn,
    districtName: NETROKONA_DISTRICT.nameBn,
    upazilaName: "নেত্রকোণা সদর",
    departmentId: null,
    unionName: null,
    phone: "01711000011",
    isActive: true,
  });

  // 3.3 Department Officers (DEPT_OFFICER) across Upazilas
  for (const u of NETROKONA_UPAZILAS) {
    // DSS Officer
    usersToSeed.push({
      name: `উপজেলা সমাজসেবা কর্মকর্তা (${u.nameBn})`,
      designation: `উপজেলা সমাজসেবা কর্মকর্তা, ${u.nameBn}`,
      email: `dss.${u.key}@netrokona.gov.bd`,
      password: "admin123",
      role: "DEPT_OFFICER",
      district: NETROKONA_DISTRICT.nameBn,
      districtName: NETROKONA_DISTRICT.nameBn,
      upazilaName: u.nameBn,
      departmentId: socialDept.id,
      unionName: null,
      phone: "017120000" + (usersToSeed.length % 90 + 10),
      isActive: true,
    });

    // DWA Officer
    usersToSeed.push({
      name: `উপজেলা মহিলা বিষয়ক কর্মকর্তা (${u.nameBn})`,
      designation: `উপজেলা মহিলা বিষয়ক কর্মকর্তা, ${u.nameBn}`,
      email: `dwa.${u.key}@netrokona.gov.bd`,
      password: "admin123",
      role: "DEPT_OFFICER",
      district: NETROKONA_DISTRICT.nameBn,
      districtName: NETROKONA_DISTRICT.nameBn,
      upazilaName: u.nameBn,
      departmentId: womenDept.id,
      unionName: null,
      phone: "017130000" + (usersToSeed.length % 90 + 10),
      isActive: true,
    });
  }

  // Food Dept Officers for Kalmakanda & Durgapur
  usersToSeed.push(
    {
      name: "উপজেলা খাদ্য নিয়ন্ত্রক, কলমাকান্দা",
      designation: "উপজেলা খাদ্য নিয়ন্ত্রক",
      email: "food.kalmakanda@netrokona.gov.bd",
      password: "admin123",
      role: "DEPT_OFFICER",
      district: NETROKONA_DISTRICT.nameBn,
      districtName: NETROKONA_DISTRICT.nameBn,
      upazilaName: "কলমাকান্দা",
      departmentId: foodDept.id,
      unionName: null,
      phone: "01714000101",
      isActive: true,
    },
    {
      name: "উপজেলা খাদ্য নিয়ন্ত্রক, দুর্গাপুর",
      designation: "উপজেলা খাদ্য নিয়ন্ত্রক",
      email: "food.durgapur@netrokona.gov.bd",
      password: "admin123",
      role: "DEPT_OFFICER",
      district: NETROKONA_DISTRICT.nameBn,
      districtName: NETROKONA_DISTRICT.nameBn,
      upazilaName: "দুর্গাপুর",
      departmentId: foodDept.id,
      unionName: null,
      phone: "01714000102",
      isActive: true,
    },
    {
      name: "তানভীর আহমেদ",
      designation: "উপজেলা সমাজসেবা কর্মকর্তা, নেত্রকোণা সদর",
      email: "dss@upazila.gov.bd",
      password: "admin123",
      role: "DEPT_OFFICER",
      district: NETROKONA_DISTRICT.nameBn,
      districtName: NETROKONA_DISTRICT.nameBn,
      upazilaName: "নেত্রকোণা সদর",
      departmentId: socialDept.id,
      unionName: null,
      phone: "01712000001",
      isActive: true,
    },
    {
      name: "নাসরিন সুলতানা",
      designation: "উপজেলা মহিলা বিষয়ক কর্মকর্তা, নেত্রকোণা সদর",
      email: "dwa@upazila.gov.bd",
      password: "admin123",
      role: "DEPT_OFFICER",
      district: NETROKONA_DISTRICT.nameBn,
      districtName: NETROKONA_DISTRICT.nameBn,
      upazilaName: "নেত্রকোণা সদর",
      departmentId: womenDept.id,
      unionName: null,
      phone: "01713000002",
      isActive: true,
    }
  );

  // 3.4 Union Viewers
  const unionViewers = [
    { email: "lengura.kalmakanda@netrokona.gov.bd", name: "মো: সাইদুর রহমান", desig: "ইউপি সচিব", upazila: "কলমাকান্দা", union: "লেংগুরা" },
    { email: "birishiri.durgapur@netrokona.gov.bd", name: "সুরেশ মারাক", desig: "ইউপি সচিব", upazila: "দুর্গাপুর", union: "বিরিশিরি" },
    { email: "mougati.sadar@netrokona.gov.bd", name: "মো: কামরুল হাসান", desig: "ইউপি সচিব", upazila: "নেত্রকোণা সদর", union: "মৌগাতি" },
    { email: "sandikona.kendua@netrokona.gov.bd", name: "আব্দুল মজিদ", desig: "ইউপি সচিব", upazila: "কেন্দুয়া", union: "সান্দিকোণা" },
  ];

  for (const uv of unionViewers) {
    usersToSeed.push({
      name: uv.name,
      designation: `${uv.desig}, ${uv.union} ইউনিয়ন পরিষদ`,
      email: uv.email,
      password: "admin123",
      role: "UNION_VIEWER",
      district: NETROKONA_DISTRICT.nameBn,
      districtName: NETROKONA_DISTRICT.nameBn,
      upazilaName: uv.upazila,
      departmentId: null,
      unionName: uv.union,
      phone: "017140000" + (usersToSeed.length % 90 + 10),
      isActive: true,
    });
  }

  // Upsert all users
  for (const u of usersToSeed) {
    const passwordHash = hashPassword(u.password);
    const existing = await prisma.user.findUnique({
      where: { email: u.email },
    });

    if (existing) {
      await prisma.user.update({
        where: { email: u.email },
        data: {
          name: u.name,
          designation: u.designation,
          role: u.role,
          password: u.password,
          passwordHash,
          district: u.district,
          districtName: u.districtName || u.district,
          upazilaName: u.upazilaName,
          departmentId: u.departmentId,
          unionName: u.unionName,
          phone: u.phone,
          isActive: u.isActive,
        },
      });
      console.log(`  ✓ Updated User: ${u.email} [${u.role}] (${u.upazilaName || "District Level"})`);
    } else {
      await prisma.user.create({
        data: {
          name: u.name,
          designation: u.designation,
          email: u.email,
          role: u.role,
          password: u.password,
          passwordHash,
          district: u.district,
          districtName: u.districtName || u.district,
          upazilaName: u.upazilaName,
          departmentId: u.departmentId,
          unionName: u.unionName,
          phone: u.phone,
          isActive: u.isActive,
        },
      });
      console.log(`  ✓ Created User: ${u.email} [${u.role}] (${u.upazilaName || "District Level"})`);
    }
  }

    // --------------------------------------------------------------------------
    // 4. Update Existing Beneficiaries with districtName
    // --------------------------------------------------------------------------
    await prisma.beneficiary.updateMany({
      where: {
        OR: [
          { districtName: null },
          { districtName: "" },
        ],
      },
      data: {
        district: NETROKONA_DISTRICT.nameBn,
        districtName: NETROKONA_DISTRICT.nameBn,
      },
    });

// --------------------------------------------------------------------------
// 5. Sample Beneficiaries across 2 Upazilas: Kalmakanda & Durgapur
//    Demonstrating 4 Statuses: ACTIVE, SUSPENDED, ARCHIVED, and Duplicates
// --------------------------------------------------------------------------
console.log("\n📋 4. Seeding Sample Data across Kalmakanda & Durgapur (4 Statuses)...");

// Get schemes
const oldAgeScheme = await prisma.scheme.findFirst({ where: { name: { contains: "Old Age" } } });
const widowScheme = await prisma.scheme.findFirst({ where: { name: { contains: "Widow" } } });
const disabilityScheme = await prisma.scheme.findFirst({ where: { name: { contains: "Disability" } } });
const vwbScheme = await prisma.scheme.findFirst({ where: { name: { contains: "VWB" } } });
const ffpScheme = await prisma.scheme.findFirst({ where: { name: { contains: "Food Friendly" } } });
const vgfScheme = await prisma.scheme.findFirst({ where: { name: { contains: "VGF" } } });

  const kalmakandaUno = await prisma.user.findFirst({ where: { email: "uno.kalmakanda@netrokona.gov.bd" } });
  const durgapurUno = await prisma.user.findFirst({ where: { email: "uno.durgapur@netrokona.gov.bd" } });
  const kalmakandaDssUser = await prisma.user.findFirst({ where: { email: "dss.kalmakanda@netrokona.gov.bd" } });
  const durgapurDwaUser = await prisma.user.findFirst({ where: { email: "dwa.durgapur@netrokona.gov.bd" } });

  if (oldAgeScheme && widowScheme && disabilityScheme && vwbScheme && ffpScheme && vgfScheme) {
    interface SampleEnrollment {
      schemeId: string;
      cardNumber: string;
      startDate: Date;
      status: string;
      isArchived: boolean;
      archiveReason?: string | null;
      archiveNote?: string | null;
      archivedAt?: Date | null;
      archivedBy?: string | null;
      suspensionReason?: string;
      removalApproved?: boolean;
    }

    interface SampleBeneficiary {
      fullName: string;
      nameBn: string;
      nameEn: string;
      guardianName: string;
      fatherName: string;
      gender: string;
      dateOfBirth?: Date;
      nid: string;
      mobile: string;
      district: string;
      districtName: string;
      upazilaName: string;
      unionName: string;
      wardNo: string;
      isArchived: boolean;
      archiveReason?: string | null;
      archiveNote?: string | null;
      archivedAt?: Date | null;
      archivedBy?: string | null;
      enrollments: SampleEnrollment[];
    }

    const sampleBeneficiaries: SampleBeneficiary[] = [
      // ======================================================================
      // UPAZILA 1: KALMAKANDA (কলমাকান্দা উপজেলা)
      // ======================================================================

      // 1.1 Kalmakanda: ACTIVE (সক্রিয় সুবিধাভোগী)
      {
        fullName: "মোছাঃ মমতাজ বেগম",
        nameBn: "মোছাঃ মমতাজ বেগম",
        nameEn: "Momtaz Begum",
        guardianName: "আলমগীর হোসেন",
        fatherName: "আলমগীর হোসেন",
        gender: "Female",
        dateOfBirth: new Date("1958-04-12"),
        nid: "19585077889900112",
        mobile: "01756789012",
        district: NETROKONA_DISTRICT.nameBn,
        districtName: NETROKONA_DISTRICT.nameBn,
        upazilaName: "কলমাকান্দা",
        unionName: "লেংগুরা",
        wardNo: "০৪",
        isArchived: false,
        enrollments: [
          {
            schemeId: oldAgeScheme.id,
            cardNumber: "KLM-OAA-101",
            startDate: new Date("2022-01-15"),
            status: "ACTIVE", // ACTIVE status
            isArchived: false,
          },
        ],
      },

      // 1.2 Kalmakanda: SUSPENDED (বাতিলকৃত সুবিধাভোগী - approved by UNO)
      {
        fullName: "মোঃ রফিকুল ইসলাম ভূঁইয়া",
        nameBn: "মোঃ রফিকুল ইসলাম ভূঁইয়া",
        nameEn: "Md. Rafiqul Islam Bhuiyan",
        guardianName: "মৃত জহিরুল হক",
        fatherName: "মৃত জহিরুল হক",
        gender: "Male",
        dateOfBirth: new Date("1965-08-20"),
        nid: "19655012345678999",
        mobile: "01712345670",
        district: NETROKONA_DISTRICT.nameBn,
        districtName: NETROKONA_DISTRICT.nameBn,
        upazilaName: "কলমাকান্দা",
        unionName: "কলমাকান্দা সদর",
        wardNo: "০২",
        isArchived: false,
        enrollments: [
          {
            schemeId: ffpScheme.id,
            cardNumber: "KLM-FFP-202",
            startDate: new Date("2023-03-01"),
            status: "SUSPENDED", // SUSPENDED status
            isArchived: false,
            suspensionReason: "অন্যত্র স্থানান্তরিত ও তথ্য অসংগতি পাওয়ায় ইউএনও কর্তৃক অনুমোদন সাপেক্ষে বাতিল।",
            removalApproved: true,
          },
        ],
      },

      // 1.3 Kalmakanda: ARCHIVED (আর্কাইভ সুবিধাভোগী - deceased)
      {
        fullName: "মরহুম আব্দুর রশিদ",
        nameBn: "মরহুম আব্দুর রশিদ",
        nameEn: "Late Abdur Rashid",
        guardianName: "মৃত ইনসান আলী",
        fatherName: "মৃত ইনসান আলী",
        gender: "Male",
        dateOfBirth: new Date("1948-11-05"),
        nid: "19485077889900333",
        mobile: "01733445566",
        district: NETROKONA_DISTRICT.nameBn,
        districtName: NETROKONA_DISTRICT.nameBn,
        upazilaName: "কলমাকান্দা",
        unionName: "নাজিরপুর",
        wardNo: "০৩",
        isArchived: true,
        archiveReason: "DECEASED",
        archiveNote: "উপকারভোগী মৃত্যুবরণ করায় তার প্রতিবন্ধী ভাতার রেকর্ডটি ২৫ এপ্রিল ২০২৪ তারিখে আর্কাইভ করা হলো।",
        archivedAt: new Date("2024-04-25"),
        archivedBy: "উপজেলা সমাজসেবা কর্মকর্তা, কলমাকান্দা",
        enrollments: [
          {
            schemeId: disabilityScheme.id,
            cardNumber: "KLM-DIS-303",
            startDate: new Date("2021-07-01"),
            status: "ARCHIVED", // ARCHIVED status
            isArchived: true,
            archiveReason: "DECEASED",
            archiveNote: "উপকারভোগী মৃত্যুবরণ করায় রেকর্ডটি আর্কাইভে স্থানান্তর করা হলো।",
            archivedAt: new Date("2024-04-25"),
            archivedBy: "উপজেলা সমাজসেবা কর্মকর্তা, কলমাকান্দা",
          },
        ],
      },

      // 1.4 Kalmakanda: CROSS-DEPARTMENT DUPLICATE (আন্তঃদপ্তর ডুপ্লিকেট - DSS + DWA)
      {
        fullName: "মোছাঃ হাজেরা খাতুন",
        nameBn: "মোছাঃ হাজেরা খাতুন",
        nameEn: "Hajera Khatun",
        guardianName: "মৃত শামসুল হক",
        fatherName: "মৃত শামসুল হক",
        gender: "Female",
        dateOfBirth: new Date("1974-06-18"),
        nid: "19745088990011223",
        mobile: "01788990011",
        district: NETROKONA_DISTRICT.nameBn,
        districtName: NETROKONA_DISTRICT.nameBn,
        upazilaName: "কলমাকান্দা",
        unionName: "পোগলা",
        wardNo: "০১",
        isArchived: false,
        enrollments: [
          {
            schemeId: widowScheme.id,
            cardNumber: "KLM-WID-404",
            startDate: new Date("2022-09-01"),
            status: "ACTIVE",
            isArchived: false,
          },
          {
            schemeId: vwbScheme.id,
            cardNumber: "KLM-VWB-405",
            startDate: new Date("2023-01-10"),
            status: "ACTIVE", // Dual ACTIVE -> Flags as duplicate
            isArchived: false,
          },
        ],
      },

      // ======================================================================
      // UPAZILA 2: DURGAPUR (দুর্গাপুর উপজেলা)
      // ======================================================================

      // 2.1 Durgapur: ACTIVE (সক্রিয় সুবিধাভোগী)
      {
        fullName: "সুকৃতি মানখিন",
        nameBn: "সুকৃতি মানখিন",
        nameEn: "Sukriti Mankhin",
        guardianName: "প্রবীন মারাক",
        fatherName: "প্রবীন মারাক",
        gender: "Female",
        dateOfBirth: new Date("1972-02-14"),
        nid: "19725055443322110",
        mobile: "01745678901",
        district: NETROKONA_DISTRICT.nameBn,
        districtName: NETROKONA_DISTRICT.nameBn,
        upazilaName: "দুর্গাপুর",
        unionName: "বিরিশিরি",
        wardNo: "০২",
        isArchived: false,
        enrollments: [
          {
            schemeId: widowScheme.id,
            cardNumber: "DUR-WID-501",
            startDate: new Date("2023-02-20"),
            status: "ACTIVE", // ACTIVE status
            isArchived: false,
          },
        ],
      },

      // 2.2 Durgapur: SUSPENDED (বাতিলকৃত সুবিধাভোগী - approved by UNO)
      {
        fullName: "নির্মল রেমা",
        nameBn: "নির্মল রেমা",
        nameEn: "Nirmal Rema",
        guardianName: "জনসন হাজং",
        fatherName: "জনসন হাজং",
        gender: "Male",
        dateOfBirth: new Date("1963-09-10"),
        nid: "19635033445566778",
        mobile: "01777889900",
        district: NETROKONA_DISTRICT.nameBn,
        districtName: NETROKONA_DISTRICT.nameBn,
        upazilaName: "দুর্গাপুর",
        unionName: "কুল্লাগড়া",
        wardNo: "০৫",
        isArchived: false,
        enrollments: [
          {
            schemeId: vgfScheme.id,
            cardNumber: "DUR-VGF-602",
            startDate: new Date("2023-05-15"),
            status: "SUSPENDED", // SUSPENDED status
            isArchived: false,
            suspensionReason: "নীতিমালা বহির্ভূত একাধিক ভাতার কারণে ইউএনও কর্তৃক বাতিলাদেশ অনুমোদিত।",
            removalApproved: true,
          },
        ],
      },

      // 2.3 Durgapur: ARCHIVED (আর্কাইভ সুবিধাভোগী - expired tenure)
      {
        fullName: "মনিকা মারাক",
        nameBn: "মনিকা মারাক",
        nameEn: "Monika Marak",
        guardianName: "আলবার্ট চিসিম",
        fatherName: "আলবার্ট চিসিম",
        gender: "Female",
        dateOfBirth: new Date("1982-12-01"),
        nid: "19825044556677889",
        mobile: "01799001122",
        district: NETROKONA_DISTRICT.nameBn,
        districtName: NETROKONA_DISTRICT.nameBn,
        upazilaName: "দুর্গাপুর",
        unionName: "চন্ডিগড়",
        wardNo: "০৬",
        isArchived: true,
        archiveReason: "BENEFIT_EXPIRED",
        archiveNote: "ভিডব্লিউবি (VWB) দুই বছরের মেয়াদ পূর্ণ হওয়ায় রেকর্ডটি আর্কাইভে স্থানান্তর করা হলো।",
        archivedAt: new Date("2024-12-31"),
        archivedBy: "উপজেলা মহিলা বিষয়ক কর্মকর্তা, দুর্গাপুর",
        enrollments: [
          {
            schemeId: vwbScheme.id,
            cardNumber: "DUR-VWB-703",
            startDate: new Date("2023-01-01"),
            status: "ARCHIVED", // ARCHIVED status
            isArchived: true,
            archiveReason: "BENEFIT_EXPIRED",
            archiveNote: "ভিডব্লিউবি কার্যক্রমের ২ বছর মেয়াদ শেষ হওয়ায় সফলভাবে সম্পন্ন ও আর্কাইভ করা হলো।",
            archivedAt: new Date("2024-12-31"),
            archivedBy: "উপজেলা মহিলা বিষয়ক কর্মকর্তা, দুর্গাপুর",
          },
        ],
      },

      // 2.4 Durgapur: CROSS-DEPARTMENT DUPLICATE (আন্তঃদপ্তর ডুপ্লিকেট - DSS + Food)
      {
        fullName: "প্রদীপ সাংমা",
        nameBn: "প্রদীপ সাংমা",
        nameEn: "Prodip Sangma",
        guardianName: "মৃত ধনেশ্বর সাংমা",
        fatherName: "মৃত ধনেশ্বর সাংমা",
        gender: "Male",
        dateOfBirth: new Date("1955-03-25"),
        nid: "19555099887711224",
        mobile: "01711223344",
        district: NETROKONA_DISTRICT.nameBn,
        districtName: NETROKONA_DISTRICT.nameBn,
        upazilaName: "দুর্গাপুর",
        unionName: "দুর্গাপুর সদর",
        wardNo: "০১",
        isArchived: false,
        enrollments: [
          {
            schemeId: oldAgeScheme.id,
            cardNumber: "DUR-OAA-801",
            startDate: new Date("2021-10-01"),
            status: "ACTIVE",
            isArchived: false,
          },
          {
            schemeId: ffpScheme.id,
            cardNumber: "DUR-FFP-802",
            startDate: new Date("2023-04-01"),
            status: "ACTIVE", // Dual ACTIVE -> Flags as duplicate
            isArchived: false,
          },
        ],
      },
    ];

      for (const bData of sampleBeneficiaries) {
        let b = await prisma.beneficiary.findFirst({
          where: { nid: bData.nid },
        });

        if (!b) {
          b = await prisma.beneficiary.create({
            data: {
              fullName: bData.fullName,
              nameBn: bData.nameBn,
              nameEn: bData.nameEn,
              guardianName: bData.guardianName,
              fatherName: bData.fatherName,
              gender: bData.gender,
              dateOfBirth: bData.dateOfBirth,
              nid: bData.nid,
              mobile: bData.mobile,
              district: bData.district,
              districtName: bData.districtName,
              upazilaName: bData.upazilaName,
              unionName: bData.unionName,
              wardNo: bData.wardNo,
              isArchived: bData.isArchived,
              archiveReason: bData.archiveReason || null,
              archiveNote: bData.archiveNote || null,
              archivedAt: bData.archivedAt || null,
              archivedBy: bData.archivedBy || null,
            },
          });
          console.log(`  ✓ Created Beneficiary in ${bData.upazilaName}: ${b.nameBn || b.fullName} [Archived: ${b.isArchived}]`);

          for (const enr of bData.enrollments) {
              const createdEnr = await prisma.enrollment.create({
                data: {
                  beneficiaryId: b.id,
                  schemeId: enr.schemeId,
                  cardNumber: enr.cardNumber,
                  startDate: enr.startDate,
                  status: enr.status,
                  isArchived: enr.isArchived || false,
                  archiveReason: enr.archiveReason || null,
                  archiveNote: enr.archiveNote || null,
                  archivedAt: enr.archivedAt || null,
                  archivedBy: enr.archivedBy || null,
                },
                include: {
                  scheme: true,
                },
              });

              // If SUSPENDED and removalApproved is true, create corresponding RemovalRequest
              if(enr.status === "SUSPENDED" && (enr as any).removalApproved) {
              const unoUser = bData.upazilaName === "কলমাকান্দা" ? kalmakandaUno : durgapurUno;
              const deptOfficer = bData.upazilaName === "কলমাকান্দা" ? kalmakandaDssUser : durgapurDwaUser;

              if (unoUser && deptOfficer) {
                await prisma.removalRequest.upsert({
                  where: { enrollmentId: createdEnr.id },
                  update: {
                    status: "APPROVED",
                    reviewedAt: new Date(),
                    reviewedByUserId: unoUser.id,
                    adminComment: (enr as any).suspensionReason || "আবেদনটি যথাযথ থাকায় অনুমোদনপূর্বক বাতিল করা হলো।",
                  },
                  create: {
                    enrollmentId: createdEnr.id,
                    beneficiaryId: b.id,
                    departmentId: createdEnr.scheme.departmentId,
                    requestedByUserId: deptOfficer.id,
                    requestReason: "নীতিমালা বহির্ভূত ভাতা গ্রহণ বা তথ্যের অসঙ্গতি।",
                    status: "APPROVED",
                    reviewedByUserId: unoUser.id,
                    adminComment: (enr as any).suspensionReason || "আবেদনটি যথাযথ থাকায় অনুমোদনপূর্বক বাতিল করা হলো।",
                    district: NETROKONA_DISTRICT.nameBn,
                    upazilaName: bData.upazilaName,
                    reviewedAt: new Date(),
                  },
                });
                console.log(`    ↳ Linked APPROVED RemovalRequest for UNO: ${createdEnr.cardNumber}`);
              }
            }
          }
        } else {
          // Update existing beneficiary
          await prisma.beneficiary.update({
            where: { id: b.id },
            data: {
              district: bData.district,
              districtName: bData.districtName,
              upazilaName: bData.upazilaName,
              unionName: bData.unionName,
              wardNo: bData.wardNo,
              isArchived: bData.isArchived,
              archiveReason: bData.archiveReason || null,
              archiveNote: bData.archiveNote || null,
              archivedAt: bData.archivedAt || null,
              archivedBy: bData.archivedBy || null,
            },
          });

          // Ensure enrollments exist and have matching statuses
          for (const enr of bData.enrollments) {
            const existingEnr = await prisma.enrollment.findFirst({
              where: { beneficiaryId: b.id, schemeId: enr.schemeId },
            });

            if (existingEnr) {
              await prisma.enrollment.update({
                where: { id: existingEnr.id },
                data: {
                  status: enr.status,
                  isArchived: enr.isArchived || false,
                  archiveReason: enr.archiveReason || null,
                  archiveNote: enr.archiveNote || null,
                  archivedAt: enr.archivedAt || null,
                  archivedBy: enr.archivedBy || null,
                },
              });
            }
          }
        }
      }
    }

    console.log("\n✅ Netrokona District seeding successfully completed!");
    console.log("===================================================================");
    console.log("District Oversight Account:");
    console.log("  • District Admin (DC): dc@district.gov.bd / dc123 [Role: DISTRICT_ADMIN]");
    console.log("  • District Admin (Compat): dc@netrokona.gov.bd / admin123");
    console.log("  • System Admin:        admin@upazila.gov.bd / admin123 [Role: SUPER_ADMIN]");
    console.log("\nSample Upazilas with 4 Beneficiary Statuses (ACTIVE, SUSPENDED, ARCHIVED, Duplicates):");
    console.log("  1. কলমাকান্দা উপজেলা (Kalmakanda):");
    console.log("     - UNO Login: uno.kalmakanda@netrokona.gov.bd / uno123");
    console.log("     - DSS Login: dss.kalmakanda@netrokona.gov.bd / admin123");
    console.log("     - Food Login: food.kalmakanda@netrokona.gov.bd / admin123");
    console.log("  2. দুর্গাপুর উপজেলা (Durgapur):");
    console.log("     - UNO Login: uno.durgapur@netrokona.gov.bd / uno123");
    console.log("     - DSS Login: dss.durgapur@netrokona.gov.bd / admin123");
    console.log("     - DWA Login: dwa.durgapur@netrokona.gov.bd / admin123");
    console.log("===================================================================");
  }

  main()
    .catch((e) => {
      console.error("❌ Seeding failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
