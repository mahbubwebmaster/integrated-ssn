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
  console.log("🌱 Starting Netrokona District Seeding for SSNP System...");

  // 1. Seed Core Departments and Schemes
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
        },
      });
      console.log(`  ✓ Created Department: ${dept.nameBn || dept.name}`);
    } else {
      await prisma.department.update({
        where: { id: dept.id },
        data: { nameBn: deptData.nameBn, nameEn: deptData.nameEn },
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

  // 2. Prepare User Accounts for Netrokona District
  const usersToSeed: any[] = [
    // 2.1 District Level (Deputy Commissioner - DC) - Oversees whole Netrokona district
    {
      name: "বনানী বিশ্বাস",
      designation: "জেলা প্রশাসক ও জেলা ম্যাজিস্ট্রেট, নেত্রকোণা",
      email: "dc@netrokona.gov.bd",
      password: "admin123",
      role: "SUPER_ADMIN",
      district: NETROKONA_DISTRICT.nameBn,
      upazilaName: null,
      departmentId: null,
      unionName: null,
      phone: "01713000001",
      isActive: true,
    },
    // Compat / System Admin
    {
      name: "সিস্টেম অ্যাডমিনিস্ট্রেটর",
      designation: "সহকারী প্রোগ্রামার (আইসিটি সেল), নেত্রকোণা",
      email: "admin@upazila.gov.bd",
      password: "admin123",
      role: "SUPER_ADMIN",
      district: NETROKONA_DISTRICT.nameBn,
      upazilaName: null,
      departmentId: null,
      unionName: null,
      phone: "01711000000",
      isActive: true,
    },
  ];

  // 2.2 Seed UNOs for all 10 Upazilas of Netrokona
  const unoOfficers = [
    { key: "sadar", name: "তানিয়া আক্তার", upazilaName: "নেত্রকোণা সদর", phone: "01711000011" },
    { key: "kendua", name: "মো: ইমদাদুল হক তালুকদার", upazilaName: "কেন্দুয়া", phone: "01711000012" },
    { key: "durgapur", name: "নাভীদ রেজওয়ানুল কবীর", upazilaName: "দুর্গাপুর", phone: "01711000013" },
    { key: "kalmakanda", name: "মো: আসাদুজ্জামান", upazilaName: "কলমাকান্দা", phone: "01711000014" },
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
      upazilaName: uno.upazilaName,
      departmentId: null,
      unionName: null,
      phone: uno.phone,
      isActive: true,
    });
  }

  // Also include the legacy default uno@upazila.gov.bd mapped to Sadar
  usersToSeed.push({
    name: "তানিয়া আক্তার",
    designation: "উপজেলা নির্বাহী অফিসার, নেত্রকোণা সদর",
    email: "uno@upazila.gov.bd",
    password: "uno123",
    role: "UPAZILA_ADMIN",
    district: NETROKONA_DISTRICT.nameBn,
    upazilaName: "নেত্রকোণা সদর",
    departmentId: null,
    unionName: null,
    phone: "01711000011",
    isActive: true,
  });

  // 2.3 Department Officers for all 10 Upazilas (Social Services & Women Affairs)
  for (const u of NETROKONA_UPAZILAS) {
    // DSS Officer
    usersToSeed.push({
      name: `উপজেলা সমাজসেবা কর্মকর্তা (${u.nameBn})`,
      designation: "উপজেলা সমাজসেবা কর্মকর্তা",
      email: `dss.${u.key}@netrokona.gov.bd`,
      password: "admin123",
      role: "DEPT_OFFICER",
      district: NETROKONA_DISTRICT.nameBn,
      upazilaName: u.nameBn,
      departmentId: socialDept.id,
      unionName: null,
      phone: "017120000" + (usersToSeed.length % 90 + 10),
      isActive: true,
    });

    // DWA Officer
    usersToSeed.push({
      name: `উপজেলা মহিলা বিষয়ক কর্মকর্তা (${u.nameBn})`,
      designation: "উপজেলা মহিলা বিষয়ক কর্মকর্তা",
      email: `dwa.${u.key}@netrokona.gov.bd`,
      password: "admin123",
      role: "DEPT_OFFICER",
      district: NETROKONA_DISTRICT.nameBn,
      upazilaName: u.nameBn,
      departmentId: womenDept.id,
      unionName: null,
      phone: "017130000" + (usersToSeed.length % 90 + 10),
      isActive: true,
    });
  }

  // Add default legacy dept logins mapped to Sadar
  usersToSeed.push(
    {
      name: "তানভীর আহমেদ",
      designation: "উপজেলা সমাজসেবা কর্মকর্তা, নেত্রকোণা সদর",
      email: "dss@upazila.gov.bd",
      password: "admin123",
      role: "DEPT_OFFICER",
      district: NETROKONA_DISTRICT.nameBn,
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
      upazilaName: "নেত্রকোণা সদর",
      departmentId: womenDept.id,
      unionName: null,
      phone: "01713000002",
      isActive: true,
    }
  );

  // 2.4 Representative Union Viewers across Upazilas
  const unionViewers = [
    { email: "mougati.sadar@netrokona.gov.bd", name: "মো: কামরুল হাসান", desig: "ইউপি সচিব", upazila: "নেত্রকোণা সদর", union: "মৌগাতি" },
    { email: "sandikona.kendua@netrokona.gov.bd", name: "আব্দুল মজিদ", desig: "ইউপি সচিব", upazila: "কেন্দুয়া", union: "সান্দিকোণা" },
    { email: "birishiri.durgapur@netrokona.gov.bd", name: "সুরেশ মারাক", desig: "ইউপি সচিব", upazila: "দুর্গাপুর", union: "বিরিশিরি" },
    { email: "lengura.kalmakanda@netrokona.gov.bd", name: "মো: সাইদুর রহমান", desig: "ইউপি সচিব", upazila: "কলমাকান্দা", union: "লেংগুরা" },
  ];

  for (const uv of unionViewers) {
    usersToSeed.push({
      name: uv.name,
      designation: `${uv.desig}, ${uv.union} ইউনিয়ন পরিষদ`,
      email: uv.email,
      password: "admin123",
      role: "UNION_VIEWER",
      district: NETROKONA_DISTRICT.nameBn,
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
          passwordHash,
          district: u.district,
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
          passwordHash,
          district: u.district,
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

  // 3. Update Existing Beneficiaries to have district: "নেত্রকোণা" and valid Upazila
  const beneficiariesWithoutUpazila = await prisma.beneficiary.findMany({
    where: {
      OR: [
        { district: "" },
        { upazilaName: "" },
      ],
    },
  });

  if (beneficiariesWithoutUpazila.length > 0) {
    console.log(`\n  Updating ${beneficiariesWithoutUpazila.length} beneficiaries with Netrokona address hierarchy...`);
    for (const b of beneficiariesWithoutUpazila) {
      await prisma.beneficiary.update({
        where: { id: b.id },
        data: {
          district: NETROKONA_DISTRICT.nameBn,
          upazilaName: "নেত্রকোণা সদর",
        },
      });
    }
  }

  // 4. Seed Multi-Upazila Sample Beneficiaries with Duplicates across Netrokona
  const existingCount = await prisma.beneficiary.count();
  console.log(`\n  Current Beneficiary Count in DB: ${existingCount}`);

  // Fetch schemes
  const oldAgeScheme = await prisma.scheme.findFirst({ where: { name: { contains: "Old Age" } } });
  const widowScheme = await prisma.scheme.findFirst({ where: { name: { contains: "Widow" } } });
  const vwbScheme = await prisma.scheme.findFirst({ where: { name: { contains: "VWB" } } });
  const motherChildScheme = await prisma.scheme.findFirst({ where: { name: { contains: "Mother & Child" } } });
  const ffpScheme = await prisma.scheme.findFirst({ where: { name: { contains: "Food Friendly" } } });

  if (oldAgeScheme && widowScheme && vwbScheme) {
    // Let's create realistic beneficiaries for Kendua, Durgapur, Kalmakanda, and Sadar
    const sampleNetrokonaBeneficiaries = [
      // Kendua Upazila Duplicate Case
      {
        fullName: "মোসাঃ ফাতেমা বেগম",
        nameBn: "মোসাঃ ফাতেমা বেগম",
        nameEn: "Fatema Begum",
        guardianName: "আব্দুল মমিন",
        fatherName: "আব্দুল মমিন",
        gender: "Female",
        nid: "19685012345678901",
        mobile: "01723456789",
        district: "নেত্রকোণা",
        upazilaName: "কেন্দুয়া",
        unionName: "সান্দিকোণা",
        wardNo: "০৩",
        enrollments: [
          { schemeId: widowScheme.id, cardNumber: "KEN-WID-101", startDate: new Date("2023-01-15"), status: "Active" },
          { schemeId: vwbScheme.id, cardNumber: "KEN-VWB-202", startDate: new Date("2023-06-01"), status: "Flagged" },
        ],
      },
      // Kendua Upazila Case 2
      {
        fullName: "মো: রফিকুল ইসলাম ভূঁইয়া",
        nameBn: "মো: রফিকুল ইসলাম ভূঁইয়া",
        nameEn: "Rafiqul Islam Bhuiyan",
        guardianName: "মরহুম সামছুল হক",
        fatherName: "মরহুম সামছুল হক",
        gender: "Male",
        nid: "19555098765432101",
        mobile: "01734567890",
        district: "নেত্রকোণা",
        upazilaName: "কেন্দুয়া",
        unionName: "রোয়াইলবাড়ি",
        wardNo: "০৫",
        enrollments: [
          { schemeId: oldAgeScheme.id, cardNumber: "KEN-OAA-301", startDate: new Date("2022-03-10"), status: "Active" },
          ...(ffpScheme ? [{ schemeId: ffpScheme.id, cardNumber: "KEN-FFP-401", startDate: new Date("2023-09-01"), status: "Flagged" }] : []),
        ],
      },
      // Durgapur Upazila Duplicate Case
      {
        fullName: "সুকৃতি মানখিন",
        nameBn: "সুকৃতি মানখিন",
        nameEn: "Sukriti Mankhin",
        guardianName: "প্রবীন মারাক",
        fatherName: "প্রবীন মারাক",
        gender: "Female",
        nid: "19725055443322110",
        mobile: "01745678901",
        district: "নেত্রকোণা",
        upazilaName: "দুর্গাপুর",
        unionName: "বিরিশিরি",
        wardNo: "০২",
        enrollments: [
          { schemeId: widowScheme.id, cardNumber: "DUR-WID-501", startDate: new Date("2023-02-20"), status: "Active" },
          { schemeId: vwbScheme.id, cardNumber: "DUR-VWB-601", startDate: new Date("2023-07-15"), status: "Flagged" },
        ],
      },
      // Kalmakanda Upazila Duplicate Case
      {
        fullName: "মোছাঃ মমতাজ বেগম",
        nameBn: "মোছাঃ মমতাজ বেগম",
        nameEn: "Momtaz Begum",
        guardianName: "আলমগীর হোসেন",
        fatherName: "আলমগীর হোসেন",
        gender: "Female",
        nid: "19655077889900112",
        mobile: "01756789012",
        district: "নেত্রকোণা",
        upazilaName: "কলমাকান্দা",
        unionName: "লেংগুরা",
        wardNo: "০৪",
        enrollments: [
          { schemeId: oldAgeScheme.id, cardNumber: "KAL-OAA-701", startDate: new Date("2021-08-01"), status: "Active" },
          { schemeId: widowScheme.id, cardNumber: "KAL-WID-801", startDate: new Date("2023-04-10"), status: "Flagged" },
        ],
      },
      // Netrokona Sadar Case
      {
        fullName: "মোসাঃ সেলিনা আক্তার",
        nameBn: "মোসাঃ সেলিনা আক্তার",
        nameEn: "Selina Akter",
        guardianName: "আব্দুল করিম",
        fatherName: "আব্দুল করিম",
        gender: "Female",
        nid: "19805099887766554",
        mobile: "01767890123",
        district: "নেত্রকোণা",
        upazilaName: "নেত্রকোণা সদর",
        unionName: "মৌগাতি",
        wardNo: "০১",
        enrollments: [
          { schemeId: widowScheme.id, cardNumber: "SDR-WID-901", startDate: new Date("2022-11-01"), status: "Active" },
          ...(motherChildScheme ? [{ schemeId: motherChildScheme.id, cardNumber: "SDR-MC-902", startDate: new Date("2023-05-15"), status: "Flagged" }] : []),
        ],
      },
    ];

    for (const bData of sampleNetrokonaBeneficiaries) {
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
            nid: bData.nid,
            mobile: bData.mobile,
            district: bData.district,
            upazilaName: bData.upazilaName,
            unionName: bData.unionName,
            wardNo: bData.wardNo,
          },
        });
        console.log(`  ✓ Created Beneficiary in ${bData.upazilaName}: ${b.fullName}`);

        for (const enr of bData.enrollments) {
          await prisma.enrollment.create({
            data: {
              beneficiaryId: b.id,
              schemeId: enr.schemeId,
              cardNumber: enr.cardNumber,
              startDate: enr.startDate,
              status: enr.status,
            },
          });
        }
      } else {
        // Ensure district & upazila are updated
        await prisma.beneficiary.update({
          where: { id: b.id },
          data: {
            district: bData.district,
            upazilaName: bData.upazilaName,
            unionName: bData.unionName,
            wardNo: bData.wardNo,
          },
        });
      }
    }
  }

  console.log("\n✅ Netrokona District seeding successfully completed!");
  console.log("-------------------------------------------------------------------");
  console.log("District Oversight:");
  console.log("  • Deputy Commissioner (DC): dc@netrokona.gov.bd / admin123 (Full Netrokona View)");
  console.log("  • System Admin:            admin@upazila.gov.bd / admin123");
  console.log("\nUpazila Executive Officers (UNOs - password: uno123):");
  for (const uno of unoOfficers) {
    console.log(`  • ${uno.upazilaName.padEnd(16)}: uno.${uno.key}@netrokona.gov.bd`);
  }
  console.log("\nDepartment Officers (password: admin123):");
  console.log("  • Social Services: dss.[sadar|kendua|durgapur|kalmakanda|...]@netrokona.gov.bd");
  console.log("  • Women Affairs:   dwa.[sadar|kendua|durgapur|kalmakanda|...]@netrokona.gov.bd");
  console.log("-------------------------------------------------------------------");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
