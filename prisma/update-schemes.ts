import { prisma } from "../src/lib/prisma";

async function main() {
  const schemes = await prisma.scheme.findMany({ include: { department: true } });
  for (const s of schemes) {
    if (s.name.includes("VWB") || s.name.includes("ভিডব্লিউবি")) {
      await prisma.scheme.update({
        where: { id: s.id },
        data: {
          benefitType: "COMMODITY",
          commodityName: "পুষ্টিকর চাল (Fortified Rice)",
          commodityQuantity: 30,
          commodityUnit: "কেজি (kg)",
          commodityMarketValue: 1500,
          monthlyAmount: 1500,
          frequency: "Monthly",
          cashAmount: 0,
          description: "হতদরিদ্র গ্রামীণ নারীদের প্রতি মাসে ৩০ কেজি পুষ্টিকর চাল বিতরণ",
        },
      });
    } else if (s.name.includes("FFP") || s.name.includes("খাদ্য বান্ধব")) {
      await prisma.scheme.update({
        where: { id: s.id },
        data: {
          benefitType: "COMMODITY",
          commodityName: "ভর্তুকিমূল্যের চাল (Subsidized Rice)",
          commodityQuantity: 30,
          commodityUnit: "কেজি (kg)",
          commodityMarketValue: 1200,
          monthlyAmount: 1200,
          frequency: "Monthly",
          cashAmount: 0,
          description: "১৫ টাকা কেজি দরে প্রতি মাসে ৩০ কেজি চাল বিতরণ",
        },
      });
    } else if (s.name.includes("VGF") || s.name.includes("ভিজিএফ")) {
      await prisma.scheme.update({
        where: { id: s.id },
        data: {
          benefitType: "COMMODITY",
          commodityName: "ত্রাণ চাল (Relief Rice)",
          commodityQuantity: 10,
          commodityUnit: "কেজি (kg)",
          commodityMarketValue: 600,
          monthlyAmount: 600,
          frequency: "One-time",
          cashAmount: 0,
          description: "দুর্যোগকালীন বা ঈদে বিনামূল্যে ১০ কেজি চাল বিতরণ",
        },
      });
    } else if (s.name.includes("TCB") || s.name.includes("টিসিবি")) {
      await prisma.scheme.update({
        where: { id: s.id },
        data: {
          benefitType: "COMMODITY",
          commodityName: "টিসিবি পণ্য প্যাকেজ (তেল, ডাল, চিনি ও চাল)",
          commodityQuantity: 1,
          commodityUnit: "প্যাকেজ (package)",
          commodityMarketValue: 1200,
          monthlyAmount: 1200,
          frequency: "Monthly",
          cashAmount: 0,
          description: "ফ্যামিলি কার্ডের মাধ্যমে সাশ্রয়ী মূল্যে নিত্যপ্রয়োজনীয় খাদ্যপণ্য",
        },
      });
    } else if (s.name.includes("GR Cash") || s.name.includes("জরুরি নগদ")) {
      await prisma.scheme.update({
        where: { id: s.id },
        data: {
          benefitType: "CASH",
          cashAmount: 1000,
          monthlyAmount: 1000,
          frequency: "One-time",
          description: "জরুরি দুর্যোগ ও পুনর্বাসনে এককালীন নগদ সহায়তা",
        },
      });
    } else {
      await prisma.scheme.update({
        where: { id: s.id },
        data: {
          benefitType: "CASH",
          cashAmount: s.monthlyAmount,
          frequency: s.frequency || "Monthly",
        },
      });
    }
  }
  console.log("Updated", schemes.length, "schemes successfully!");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
