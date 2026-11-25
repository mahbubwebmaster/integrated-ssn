// Departmental MIS Column Presets and Smart Matching Helpers
export interface DepartmentPreset {
  id: string;
  nameBn: string;
  nameEn: string;
  departmentKeyword: string;
  descriptionBn: string;
  mappings: Record<string, string>; // systemKey -> typical header name
}

export const DEPARTMENT_PRESETS: DepartmentPreset[] = [
  {
    id: "auto",
    nameBn: "⚡ স্বয়ংক্রিয় এআই ম্যাপিং (Auto-Detect)",
    nameEn: "⚡ Automatic Smart Matching",
    departmentKeyword: "all",
    descriptionBn: "ফাইলের হেডার বিশ্লেষণ করে স্বয়ংক্রিয়ভাবে কলাম শনাক্ত করবে",
    mappings: {},
  },
  {
    id: "dss_mis",
    nameBn: "🏢 সমাজসেবা অধিদপ্তর (DSS MIS ফরম্যাট)",
    nameEn: "🏢 Dept of Social Services (DSS MIS)",
    departmentKeyword: "social",
    descriptionBn: "বয়স্ক, বিধবা ও প্রতিবন্ধী ভাতার এমআইএস এক্সেল এক্সপোর্ট ফরম্যাট",
    mappings: {
      fullName: "উপকারভোগীর নাম",
      nid: "জাতীয় পরিচয়পত্র নম্বর",
      guardianName: "পিতা/স্বামীর নাম",
      gender: "লিঙ্গ",
      dateOfBirth: "জন্ম তারিখ",
      mobile: "মোবাইল নম্বর",
      district: "জেলা",
      upazilaName: "উপজেলা",
      unionName: "ইউনিয়ন",
      wardNo: "ওয়ার্ড নং",
      cardNumber: "বই নম্বর",
    },
  },
  {
    id: "dwa_vwb",
    nameBn: "🏢 মহিলা বিষয়ক অধিদপ্তর (VWB MIS ফরম্যাট)",
    nameEn: "🏢 Dept of Women Affairs (VWB MIS)",
    departmentKeyword: "women",
    descriptionBn: "ভালনারেবল উইমেন বেনিফিট ও মাতৃকালীন ভাতার এক্সেল ফরম্যাট",
    mappings: {
      fullName: "Beneficiary Name",
      nid: "NID Number",
      guardianName: "Father/Husband Name",
      gender: "Gender",
      dateOfBirth: "Date of Birth",
      mobile: "Contact No",
      district: "District",
      upazilaName: "Upazila",
      unionName: "Union",
      wardNo: "Ward",
      cardNumber: "VWB Card No",
    },
  },
  {
    id: "food_ffp",
    nameBn: "🏢 খাদ্য অধিদপ্তর (খাদ্য বান্ধব FFP MIS)",
    nameEn: "🏢 Directorate of Food (FFP MIS)",
    departmentKeyword: "food",
    descriptionBn: "খাদ্য বান্ধব কর্মসূচি (১৫ টাকা কেজি চাল) ও ওএমএস কার্ডধারীদের ফরম্যাট",
    mappings: {
      fullName: "সুবিধাভোগীর নাম",
      nid: "এনআইডি নম্বর",
      guardianName: "পিতার নাম",
      gender: "লিঙ্গ",
      dateOfBirth: "জন্ম তারিখ",
      mobile: "মোবাইল",
      district: "জেলা",
      upazilaName: "উপজেলা",
      unionName: "ইউনিয়নের নাম",
      wardNo: "ওয়ার্ড",
      cardNumber: "রেশন কার্ড নং",
    },
  },
  {
    id: "relief_vgf",
    nameBn: "🏢 দুর্যোগ ও ত্রাণ মন্ত্রণালয় (VGF / GR ফরম্যাট)",
    nameEn: "🏢 Disaster Management (VGF/GR)",
    departmentKeyword: "relief",
    descriptionBn: "ভিজিএফ ও নগদ অর্থ বিতরণ মাস্টার রোল এক্সেল ফরম্যাট",
    mappings: {
      fullName: "মাস্টাররোল উপকারভোগী",
      nid: "জাতীয় পরিচয়পত্র",
      guardianName: "অভিভাবকের নাম",
      gender: "নারী/পুরুষ",
      mobile: "যোগাযোগ নম্বর",
      district: "জেলা",
      upazilaName: "উপজেলা",
      unionName: "ইউপি",
      wardNo: "ওয়ার্ড",
      cardNumber: "স্লিপ নম্বর",
    },
  },
  {
    id: "tcb_family",
    nameBn: "🏢 টিসিবি ফ্যামিলি কার্ড (TCB Portal)",
    nameEn: "🏢 Trading Corporation (TCB Family Card)",
    departmentKeyword: "tcb",
    descriptionBn: "টিসিবি ১ কোটি পরিবার কার্ড পণ্য ভর্তুকি এক্সেল ফরম্যাট",
    mappings: {
      fullName: "সুবিধাভোগীর নাম",
      nid: "এনআইডি",
      guardianName: "পিতা/স্বামী",
      gender: "লিঙ্গ",
      mobile: "মোবাইল",
      district: "জেলা",
      upazilaName: "উপজেলা",
      unionName: "ইউনিয়ন পরিষদ",
      wardNo: "ওয়ার্ড নং",
      cardNumber: "ফ্যামিলি কার্ড নং",
    },
  },
];

// Helper to sanitize header text for comparison
function cleanHeader(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]/g, "");
}

// Find matching header using aliases and fuzzy comparison
export function findMatchingHeader(
  headers: string[],
  aliases: string[],
  presetHeader?: string
): string | undefined {
  if (presetHeader) {
    const directMatch = headers.find(
      (h) => cleanHeader(h) === cleanHeader(presetHeader)
    );
    if (directMatch) return directMatch;
  }

  // Check aliases
  for (const alias of aliases) {
    const cleanAlias = cleanHeader(alias);
    const found = headers.find((h) => {
      const ch = cleanHeader(h);
      return ch === cleanAlias || ch.includes(cleanAlias) || cleanAlias.includes(ch);
    });
    if (found) return found;
  }

  return undefined;
}
