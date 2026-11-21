import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { NETROKONA_UPAZILAS, NETROKONA_DISTRICT } from "@/lib/netrokona";

let hasEnsuredMasterData = false;

export async function ensureDefaultMasterData() {
  if (hasEnsuredMasterData) return;
  const count = await prisma.department.count();
  if (count === 0) {
    const initialData = [
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

    for (const dept of initialData) {
      const createdDept = await prisma.department.create({
        data: {
          name: dept.name,
          nameBn: dept.nameBn,
          nameEn: dept.nameEn,
        },
      });

      for (const scheme of dept.schemes) {
        await prisma.scheme.create({
          data: {
            departmentId: createdDept.id,
            name: scheme.name,
            nameBn: scheme.nameBn,
            nameEn: scheme.nameEn,
            monthlyAmount: scheme.monthlyAmount,
            frequency: scheme.frequency,
          },
        });
      }
    }
  }

  await ensureDefaultUsers();
}

export async function ensureDefaultUsers() {
  const dcUser = await prisma.user.findUnique({
    where: { email: "dc@netrokona.gov.bd" },
  });

  if (!dcUser) {
    const socialDept = await prisma.department.findFirst({
      where: { name: { contains: "Social Services" } },
    });
    const womenDept = await prisma.department.findFirst({
      where: { name: { contains: "Women Affairs" } },
    });

    const netrokonaUsers = [
      {
        name: "বনানী বিশ্বাস",
        designation: "জেলা প্রশাসক ও জেলা ম্যাজিস্ট্রেট, নেত্রকোণা",
        email: "dc@netrokona.gov.bd",
        passwordHash: hashPassword("admin123"),
        role: "SUPER_ADMIN",
        district: NETROKONA_DISTRICT.nameBn,
        upazilaName: null,
        departmentId: null,
        unionName: null,
        isActive: true,
      },
      {
        name: "তানিয়া আক্তার",
        designation: "উপজেলা নির্বাহী অফিসার, নেত্রকোণা সদর",
        email: "uno.sadar@netrokona.gov.bd",
        passwordHash: hashPassword("uno123"),
        role: "UPAZILA_ADMIN",
        district: NETROKONA_DISTRICT.nameBn,
        upazilaName: "নেত্রকোণা সদর",
        departmentId: null,
        unionName: null,
        isActive: true,
      },
      {
        name: "মো: ইমদাদুল হক তালুকদার",
        designation: "উপজেলা নির্বাহী অফিসার, কেন্দুয়া",
        email: "uno.kendua@netrokona.gov.bd",
        passwordHash: hashPassword("uno123"),
        role: "UPAZILA_ADMIN",
        district: NETROKONA_DISTRICT.nameBn,
        upazilaName: "কেন্দুয়া",
        departmentId: null,
        unionName: null,
        isActive: true,
      },
      {
        name: "উপজেলা সমাজসেবা কর্মকর্তা (নেত্রকোণা সদর)",
        designation: "উপজেলা সমাজসেবা কর্মকর্তা",
        email: "dss.sadar@netrokona.gov.bd",
        passwordHash: hashPassword("admin123"),
        role: "DEPT_OFFICER",
        district: NETROKONA_DISTRICT.nameBn,
        upazilaName: "নেত্রকোণা সদর",
        departmentId: socialDept?.id || null,
        isActive: true,
      },
      {
        name: "উপজেলা সমাজসেবা কর্মকর্তা (কেন্দুয়া)",
        designation: "উপজেলা সমাজসেবা কর্মকর্তা",
        email: "dss.kendua@netrokona.gov.bd",
        passwordHash: hashPassword("admin123"),
        role: "DEPT_OFFICER",
        district: NETROKONA_DISTRICT.nameBn,
        upazilaName: "কেন্দুয়া",
        departmentId: socialDept?.id || null,
        isActive: true,
      },
      {
        name: "উপজেলা মহিলা বিষয়ক কর্মকর্তা (নেত্রকোণা সদর)",
        designation: "উপজেলা মহিলা বিষয়ক কর্মকর্তা",
        email: "dwa.sadar@netrokona.gov.bd",
        passwordHash: hashPassword("admin123"),
        role: "DEPT_OFFICER",
        district: NETROKONA_DISTRICT.nameBn,
        upazilaName: "নেত্রকোণা সদর",
        departmentId: womenDept?.id || null,
        isActive: true,
      },
      {
        name: "উপজেলা মহিলা বিষয়ক কর্মকর্তা (কেন্দুয়া)",
        designation: "উপজেলা মহিলা বিষয়ক কর্মকর্তা",
        email: "dwa.kendua@netrokona.gov.bd",
        passwordHash: hashPassword("admin123"),
        role: "DEPT_OFFICER",
        district: NETROKONA_DISTRICT.nameBn,
        upazilaName: "কেন্দুয়া",
        departmentId: womenDept?.id || null,
        isActive: true,
      },
    ];

    for (const u of netrokonaUsers) {
      await prisma.user.upsert({
        where: { email: u.email },
        update: u,
        create: u,
      });
    }
  }

  // Populate district & upazila for any existing users
  const usersToUpdate = await prisma.user.findMany({
    where: {
      OR: [
        { district: null },
        { district: "" },
      ],
    },
  });

  for (const u of usersToUpdate) {
    await prisma.user.update({
      where: { id: u.id },
      data: {
        district: NETROKONA_DISTRICT.nameBn,
        upazilaName: u.role === "SUPER_ADMIN" ? null : (u.upazilaName || "নেত্রকোণা সদর"),
      },
    });
  }
  hasEnsuredMasterData = true;
}
