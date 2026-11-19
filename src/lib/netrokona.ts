// Netrokona District Hierarchy & Geography Definition

export interface UpazilaInfo {
  key: string;
  nameBn: string;
  nameEn: string;
  unions: string[];
}

export const NETROKONA_DISTRICT = {
  nameBn: "নেত্রকোণা",
  nameEn: "Netrokona",
  divisionBn: "ময়মনসিংহ",
  divisionEn: "Mymensingh",
};

export const NETROKONA_UPAZILAS: UpazilaInfo[] = [
  {
    key: "sadar",
    nameBn: "নেত্রকোণা সদর",
    nameEn: "Netrokona Sadar",
    unions: [
      "মৌগাতি",
      "মেদনী",
      "ঠাকুরাকোণা",
      "কালিয়ারা গাবরাগাতী",
      "রৌহা",
      "চল্লিশা",
      "দক্ষিণ বিশিউড়া",
      "কাইলাটী",
      "আমতলি",
      "মদনপুর",
      "সিংহের বাংলা",
      "লক্ষ্মীগঞ্জ",
    ],
  },
  {
    key: "kendua",
    nameBn: "কেন্দুয়া",
    nameEn: "Kendua",
    unions: [
      "আশুজিয়া",
      "দলপা",
      "গড়াডোবা",
      "গণ্ডা",
      "সান্দিকোণা",
      "মাসকা",
      "বলাইশিমুল",
      "নওপাড়া",
      "কান্দিউড়া",
      "চিরাং",
      "রোয়াইলবাড়ি",
      "পাইকুড়া",
      "মুজাফরপুর",
    ],
  },
  {
    key: "durgapur",
    nameBn: "দুর্গাপুর",
    nameEn: "Durgapur",
    unions: [
      "কুল্লাগড়া",
      "দুর্গাপুর সদর",
      "চণ্ডীগড়",
      "বিরিশিরি",
      "বাকলজোড়া",
      "কাকৈরগড়া",
      "গাওকান্দিয়া",
    ],
  },
  {
    key: "kalmakanda",
    nameBn: "কলমাকান্দা",
    nameEn: "Kalmakanda",
    unions: [
      "কলমাকান্দা সদর",
      "লেংগুরা",
      "খারনৈ",
      "নাজিরপুর",
      "পোগলা",
      "বড়খাপন",
      "রংছাতি",
      "কৈলাটী",
    ],
  },
  {
    key: "barhatta",
    nameBn: "বারহাট্টা",
    nameEn: "Barhatta",
    unions: [
      "বাউসী",
      "সাহতা",
      "বারহাট্টা সদর",
      "আসমা",
      "চিরাম",
      "সিংধা",
      "রায়পুর",
    ],
  },
  {
    key: "madan",
    nameBn: "মদন",
    nameEn: "Madan",
    unions: [
      "মদন সদর",
      "তিয়শ্রী",
      "কাইটাইল",
      "চানগাঁও",
      "গোবিন্দশ্রী",
      "মাঘান",
      "ফতেপুর",
      "নায়কপুর",
    ],
  },
  {
    key: "mohanganj",
    nameBn: "মোহনগঞ্জ",
    nameEn: "Mohanganj",
    unions: [
      "বড়কাclipboard",
      "মাঘান সিয়াধার",
      "সমাজ সহিলদেও",
      "তেঁতুলিয়া",
      "বরকাশিয়া বিরামপুর",
      "সুয়ারপুর",
      "গাগলাজুর",
    ],
  },
  {
    key: "khaliajuri",
    nameBn: "খালিয়াজুড়ি",
    nameEn: "Khaliajuri",
    unions: [
      "খালিয়াজুড়ি সদর",
      "মেন্দিপুর",
      "চাকুয়া",
      "নগর",
      "কৃষ্ণপুর",
      "গাজীপুর",
    ],
  },
  {
    key: "purbadhala",
    nameBn: "পূর্বধলা",
    nameEn: "Purbadhala",
    unions: [
      "হোগলা",
      "ঘাগড়া",
      "জারিয়া",
      "ধলামূলগাঁও",
      "পূর্বধলা সদর",
      "আগিয়া",
      "বিশালপুর",
      "খলিশাউড়",
      "নারায়নডহর",
      "গোহালাকান্দা",
      "বৈরাটি",
    ],
  },
  {
    key: "atpara",
    nameBn: "আটপাড়া",
    nameEn: "Atpara",
    unions: [
      "স্বরমুশিয়া",
      "শুনই",
      "লুনিশ্বর",
      "বানিয়াজান",
      "তিলশিমুল",
      "দোয়াজ",
      "সুখারি",
    ],
  },
];

// Department officer types common across all upazilas
export const UPAZILA_DEPARTMENTS = [
  {
    code: "dss",
    nameBn: "উপজেলা সমাজসেবা কার্যালয়",
    nameEn: "Upazila Social Services Office",
    designationBn: "উপজেলা সমাজসেবা কর্মকর্তা",
    deptMatch: "সমাজসেবা অধিদপ্তর",
  },
  {
    code: "dwa",
    nameBn: "উপজেলা মহিলা বিষয়ক কর্মকর্তার কার্যালয়",
    nameEn: "Upazila Women Affairs Office",
    designationBn: "উপজেলা মহিলা বিষয়ক কর্মকর্তা",
    deptMatch: "মহিলা বিষয়ক অধিদপ্তর",
  },
  {
    code: "food",
    nameBn: "উপজেলা খাদ্য নিয়ন্ত্রকের কার্যালয়",
    nameEn: "Upazila Food Controller Office",
    designationBn: "উপজেলা খাদ্য নিয়ন্ত্রক",
    deptMatch: "খাদ্য অধিদপ্তর",
  },
  {
    code: "pio",
    nameBn: "উপজেলা প্রকল্প বাস্তবায়ন কর্মকর্তার কার্যালয়",
    nameEn: "Project Implementation Office (PIO)",
    designationBn: "উপজেলা প্রকল্প বাস্তবায়ন কর্মকর্তা (পিআইও)",
    deptMatch: "দুর্যোগ ব্যবস্থাপনা ও ত্রাণ মন্ত্রণালয়",
  },
];

export function getUpazilaByName(name?: string | null): UpazilaInfo | undefined {
  if (!name) return undefined;
  const clean = name.trim();
  return NETROKONA_UPAZILAS.find(
    (u) => u.nameBn === clean || u.nameEn.toLowerCase() === clean.toLowerCase() || u.key === clean.toLowerCase()
  );
}

export function getAllUpazilaNames(): string[] {
  return NETROKONA_UPAZILAS.map((u) => u.nameBn);
}
