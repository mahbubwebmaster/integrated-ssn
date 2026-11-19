/**
 * Utility to calculate event value and monthly equivalent for welfare schemes
 * Supports CASH, COMMODITY (Rice, Wheat, Fertilizer), and HYBRID packages across
 * Monthly, 3 Monthly (Quarterly), 6 Monthly, Yearly, and One-Time frequencies.
 */

export type SchemeBenefitType = "CASH" | "COMMODITY" | "HYBRID";

export type SchemeFrequency =
  | "Monthly"
  | "3 Monthly"
  | "Quarterly"
  | "6 Monthly"
  | "Half-Yearly"
  | "Yearly"
  | "One-time";

export interface SchemeCalcParams {
  benefitType: string;
  cashAmount?: number | null;
  commodityMarketValue?: number | null;
  frequency: string;
}

export function calculateMonthlyEquivalent(params: SchemeCalcParams): {
  totalEventValue: number;
  monthlyAmount: number;
} {
  const isCommodityOnly = params.benefitType === "COMMODITY";
  const isCashOnly = params.benefitType === "CASH";

  const cash = isCommodityOnly ? 0 : Number(params.cashAmount) || 0;
  const commodity = isCashOnly ? 0 : Number(params.commodityMarketValue) || 0;
  const totalEventValue = cash + commodity;

  let monthlyAmount = totalEventValue;
  const freq = (params.frequency || "Monthly").toLowerCase();

  if (freq.includes("quarter") || freq.includes("3") || freq.includes("ত্রৈমাসিক")) {
    monthlyAmount = totalEventValue / 3;
  } else if (freq.includes("6") || freq.includes("half") || freq.includes("ষাণ্মাসিক")) {
    monthlyAmount = totalEventValue / 6;
  } else if (freq.includes("year") || freq.includes("বার্ষিক")) {
    monthlyAmount = totalEventValue / 12;
  } else if (freq.includes("one") || freq.includes("এককালীন")) {
    // For one-time disaster/emergency grants, amortize over 12 months for ongoing monthly leak tracking
    monthlyAmount = Math.round(totalEventValue / 12);
  } else {
    // Monthly
    monthlyAmount = totalEventValue;
  }

  return {
    totalEventValue: Math.round(totalEventValue * 100) / 100,
    monthlyAmount: Math.round(monthlyAmount * 100) / 100,
  };
}

export const FREQUENCY_OPTIONS = [
  { value: "Monthly", labelBn: "মাসিক", labelEn: "Monthly", divisor: 1 },
  { value: "3 Monthly", labelBn: "ত্রৈমাসিক (৩ মাস পর পর)", labelEn: "Every 3 Months (Quarterly)", divisor: 3 },
  { value: "Quarterly", labelBn: "ত্রৈমাসিক", labelEn: "Quarterly", divisor: 3 },
  { value: "6 Monthly", labelBn: "ষাণ্মাসিক (৬ মাস পর পর)", labelEn: "Every 6 Months", divisor: 6 },
  { value: "Yearly", labelBn: "বার্ষিক", labelEn: "Yearly", divisor: 12 },
  { value: "One-time", labelBn: "এককালীন", labelEn: "One-time Grant", divisor: 12 },
];

export const BENEFIT_TYPE_OPTIONS = [
  {
    value: "CASH",
    labelBn: "💵 নগদ অর্থ",
    labelEn: "💵 Cash Allowance",
    descriptionBn: "নগদ টাকা সরাসরি ব্যাংক বা মোবাইল ওয়ালেটে (G2P) প্রদান করা হয়",
    descriptionEn: "Cash disbursed directly to bank account or mobile wallet (G2P)",
  },
  {
    value: "COMMODITY",
    labelBn: "🌾 খাদ্যপণ্য / চাল",
    labelEn: "🌾 Food Grain / Commodity",
    descriptionBn: "টাকার পরিবর্তে চাল, গম, সার বা অন্যান্য পণ্য সামগ্রী প্রদান করা হয়",
    descriptionEn: "Commodities like rice, wheat, fertilizer, or relief goods instead of cash",
  },
  {
    value: "HYBRID",
    labelBn: "🔀 নগদ অর্থ ও পণ্য উভয়ই",
    labelEn: "🔀 Cash + Commodity",
    descriptionBn: "একই সাথে নগদ টাকা এবং খাদ্যপণ্য উভয় সুবিধা প্রদান করা হয়",
    descriptionEn: "Package combining both cash allowance and food grain assistance",
  },
];

export const COMMON_COMMODITIES = [
  { nameBn: "চাল", nameEn: "Rice", defaultUnitBn: "কেজি", defaultUnitEn: "kg", typicalQty: 30, typicalRate: 50 },
  { nameBn: "গম", nameEn: "Wheat", defaultUnitBn: "কেজি", defaultUnitEn: "kg", typicalQty: 20, typicalRate: 40 },
  { nameBn: "আটা", nameEn: "Flour", defaultUnitBn: "কেজি", defaultUnitEn: "kg", typicalQty: 10, typicalRate: 45 },
  { nameBn: "ভোজ্য তেল ও ডাল", nameEn: "Edible Oil & Lentils", defaultUnitBn: "লিটার/কেজি", defaultUnitEn: "litre/kg", typicalQty: 5, typicalRate: 150 },
  { nameBn: "টিসিবি পণ্য প্যাকেজ", nameEn: "TCB Commodity Package", defaultUnitBn: "প্যাকেজ", defaultUnitEn: "package", typicalQty: 1, typicalRate: 1200 },
  { nameBn: "কৃষি বীজ ও সার", nameEn: "Agricultural Seed & Fertilizer", defaultUnitBn: "বস্তা/কেজি", defaultUnitEn: "bag/kg", typicalQty: 25, typicalRate: 1600 },
  { nameBn: "শীতবস্ত্র / কম্বল", nameEn: "Blanket / Winter Clothes", defaultUnitBn: "পিস", defaultUnitEn: "pcs", typicalQty: 1, typicalRate: 700 },
  { nameBn: "ঢেউটিন ও গৃহনির্মাণ মঞ্জুরি", nameEn: "Corrugated Tin Sheets", defaultUnitBn: "বান্ডিল", defaultUnitEn: "bundle", typicalQty: 1, typicalRate: 6000 },
];
