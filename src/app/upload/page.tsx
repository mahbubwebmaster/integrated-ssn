"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Plus,
  ArrowRight,
  Download,
  Building2,
  Layers,
  Sparkles,
  Info,
  ShieldCheck,
  ShieldAlert,
  ArrowLeft,
  Loader2,
  Eye,
  Check,
  Ban,
  Lock,
  Wheat,
  History,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  calculateMonthlyEquivalent,
  FREQUENCY_OPTIONS,
  BENEFIT_TYPE_OPTIONS,
} from "@/lib/scheme-calc";

interface Department {
  id: string;
  name: string;
  nameBn?: string | null;
  nameEn?: string | null;
  schemes: Scheme[];
}

interface Scheme {
  id: string;
  departmentId: string;
  name: string;
  nameBn?: string | null;
  nameEn?: string | null;
  monthlyAmount: number;
  frequency: string;
  benefitType?: string;
  commodityName?: string | null;
  commodityNameBn?: string | null;
  commodityNameEn?: string | null;
  commodityQuantity?: number | null;
  commodityUnit?: string | null;
  commodityUnitBn?: string | null;
  commodityUnitEn?: string | null;
  commodityMarketValue?: number | null;
  cashAmount?: number | null;
}

interface SystemFieldDef {
  key: string;
  labelBn: string;
  labelEn: string;
  required: boolean;
  descBn: string;
  descEn: string;
  aliases: string[];
}

const SYSTEM_FIELD_DEFS: SystemFieldDef[] = [
  {
    key: "fullName",
    labelBn: "পূর্ণ নাম",
    labelEn: "Full Name",
    required: true,
    descBn: "সুবিধাভোগীর পূর্ণ নাম",
    descEn: "Beneficiary full legal name",
    aliases: ["name", "fullname", "full_name", "beneficiary_name", "নাম", "পূর্ণ নাম", "বেনিফিশিয়ারি"],
  },
  {
    key: "nid",
    labelBn: "জাতীয় পরিচয়পত্র নম্বর",
    labelEn: "National ID Number",
    required: false,
    descBn: "১০ ডিজিট স্মার্টকার্ড, ১৩ ডিজিট বা ১৭ ডিজিট এনআইডি",
    descEn: "10-digit Smart Card, 13-digit legacy, or 17-digit barcode NID",
    aliases: ["nid", "nid_no", "national_id", "nid_number", "জাতীয় পরিচয়পত্র", "এনআইডি"],
  },
  {
    key: "brn",
    labelBn: "জন্ম নিবন্ধন নম্বর",
    labelEn: "Birth Registration Number",
    required: false,
    descBn: "১৭ ডিজিটের ডিজিটাল জন্ম নিবন্ধন নম্বর",
    descEn: "17-digit digital birth certificate registration number",
    aliases: ["brn", "birth_registration", "birth_reg_no", "birth_id", "জন্ম নিবন্ধন"],
  },
  {
    key: "guardianName",
    labelBn: "পিতা / স্বামীর নাম",
    labelEn: "Guardian / Father Name",
    required: true,
    descBn: "পিতা, স্বামী অথবা আইনসম্মত অভিভাবকের নাম",
    descEn: "Father, husband, or legal guardian name",
    aliases: ["guardian", "father", "husband", "father_name", "guardian_name", "পিতার নাম", "স্বামীর নাম", "পিতা / স্বামীর নাম"],
  },
  {
    key: "gender",
    labelBn: "লিঙ্গ",
    labelEn: "Gender",
    required: true,
    descBn: "নারী, পুরুষ অথবা অন্যান্য",
    descEn: "Female, Male, or Other",
    aliases: ["gender", "sex", "লিঙ্গ"],
  },
  {
    key: "unionName",
    labelBn: "ইউনিয়ন পরিষদ",
    labelEn: "Union Parishad",
    required: true,
    descBn: "উপজেলার আওতাভুক্ত ইউনিয়নের নাম",
    descEn: "Union name in Upazila jurisdiction",
    aliases: ["union", "union_name", "up_name", "ইউনিয়ন", "ইউপি"],
  },
  {
    key: "wardNo",
    labelBn: "ওয়ার্ড নং",
    labelEn: "Ward No",
    required: true,
    descBn: "১ থেকে ৯ নং ওয়ার্ড",
    descEn: "Ward 1 through 9",
    aliases: ["ward", "ward_no", "ward_number", "ওয়ার্ড", "ওয়ার্ড নং"],
  },
  {
    key: "mobile",
    labelBn: "মোবাইল নম্বর",
    labelEn: "Mobile No",
    required: false,
    descBn: "১১ ডিজিটের সক্রিয় মোবাইল নম্বর",
    descEn: "11-digit mobile number for MFS / G2P payment",
    aliases: ["mobile", "phone", "contact", "cell", "মোবাইল", "ফোন"],
  },
  {
    key: "cardNumber",
    labelBn: "কার্ড / বই নম্বর",
    labelEn: "Card / Passbook No",
    required: false,
    descBn: "সুবিধাভোগী ভাতার বই বা ক্রমিক নম্বর",
    descEn: "Beneficiary passbook or card serial number",
    aliases: ["card", "card_no", "passbook", "book_no", "কার্ড নং", "বই নং"],
  },
];

interface CleanedRow {
  rowNumber: number;
  fullName: string;
  guardianName: string;
  gender: string;
  nid?: string;
  brn?: string;
  mobile?: string;
  unionName: string;
  wardNo: string;
  cardNumber?: string;
  nidValidation: {
    status: "valid" | "warning" | "empty";
    message: string;
  };
  brnValidation: {
    status: "valid" | "warning" | "empty";
    message: string;
  };
}

interface UploadResponse {
  success: boolean;
  batchId: string;
  fileName: string;
  totalRecords: number;
  newBeneficiariesCreated: number;
  existingBeneficiariesMatched: number;
  activeCount: number;
  flaggedCount: number;
  flags: Array<{
    rowNumber: number;
    fullName: string;
    nid?: string;
    brn?: string;
    schemeName: string;
    flagType: string;
    reason: string;
    existingRecord?: {
      beneficiaryName: string;
      guardianName: string;
      schemeName: string;
      departmentName: string;
      monthlyAmount: number;
      startDate: string;
      cardNumber?: string | null;
    };
  }>;
}

export default function BulkUploadPage() {
  const { currentUser, isSuperAdmin, isDeptOfficer, isUnionViewer } = useAuth();
  const { language, t, formatNumber, formatCurrency, getDepartmentName, getSchemeName } = useLanguage();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [loadingDepts, setLoadingDepts] = useState(true);
  const [selectedDeptId, setSelectedDeptId] = useState<string>("");
  const [selectedSchemeId, setSelectedSchemeId] = useState<string>("");

  // New Scheme Creation Modal
  const [showNewSchemeModal, setShowNewSchemeModal] = useState(false);
  const [newSchemeName, setNewSchemeName] = useState("");
  const [newSchemeFrequency, setNewSchemeFrequency] = useState("Monthly");
  const [newSchemeBenefitType, setNewSchemeBenefitType] = useState<"CASH" | "COMMODITY" | "HYBRID">("CASH");
  const [newSchemeCashAmount, setNewSchemeCashAmount] = useState("600");
  const [newSchemeCommodityName, setNewSchemeCommodityName] = useState("");
  const [newSchemeCommodityQty, setNewSchemeCommodityQty] = useState("30");
  const [newSchemeCommodityUnit, setNewSchemeCommodityUnit] = useState(language === "bn" ? "কেজি" : "kg");
  const [newSchemeCommodityMarketValue, setNewSchemeCommodityMarketValue] = useState("1500");
  const [creatingScheme, setCreatingScheme] = useState(false);

  // File & Excel State
  const [file, setFile] = useState<File | null>(null);
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, unknown>[]>([]);
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column Mapping: systemKey -> excelHeader
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});

  // Submission State
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResponse | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const systemFields = useMemo(() => {
    return SYSTEM_FIELD_DEFS.map((f) => ({
      key: f.key,
      label: language === "bn" ? f.labelBn : f.labelEn,
      required: f.required,
      description: language === "bn" ? f.descBn : f.descEn,
      aliases: f.aliases,
    }));
  }, [language]);

  // Load Departments & Schemes
  useEffect(() => {
    fetchDepartments();
  }, [currentUser]);

  const fetchDepartments = async () => {
    try {
      setLoadingDepts(true);
      const res = await fetch("/api/departments");
      const data = await res.json();
      if (data.success && data.departments) {
        setDepartments(data.departments);
        if (data.departments.length > 0) {
          let targetDept = data.departments[0];
          if (isDeptOfficer && currentUser.departmentId) {
            const found = data.departments.find((d: any) => d.id === currentUser.departmentId);
            if (found) targetDept = found;
          }

          setSelectedDeptId(targetDept.id);
          if (targetDept.schemes && targetDept.schemes.length > 0) {
            setSelectedSchemeId(targetDept.schemes[0].id);
          }
        }
      }
    } catch (err) {
      console.error("Error loading departments:", err);
    } finally {
      setLoadingDepts(false);
    }
  };

  const currentDept = useMemo(() => {
    return departments.find((d) => d.id === selectedDeptId);
  }, [departments, selectedDeptId]);

  const currentScheme = useMemo(() => {
    return currentDept?.schemes.find((s) => s.id === selectedSchemeId);
  }, [currentDept, selectedSchemeId]);

  const handleDepartmentChange = (deptId: string) => {
    setSelectedDeptId(deptId);
    const dept = departments.find((d) => d.id === deptId);
    if (dept && dept.schemes.length > 0) {
      setSelectedSchemeId(dept.schemes[0].id);
    } else {
      setSelectedSchemeId("");
    }
  };

  const handleCreateScheme = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDeptId || !newSchemeName.trim()) return;

    try {
      setCreatingScheme(true);
      const res = await fetch("/api/schemes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: selectedDeptId,
          name: newSchemeName.trim(),
          frequency: newSchemeFrequency,
          benefitType: newSchemeBenefitType,
          cashAmount:
            newSchemeBenefitType !== "COMMODITY" && newSchemeCashAmount
              ? parseFloat(newSchemeCashAmount)
              : null,
          commodityName:
            newSchemeBenefitType !== "CASH" ? newSchemeCommodityName.trim() : null,
          commodityQuantity:
            newSchemeBenefitType !== "CASH" && newSchemeCommodityQty
              ? parseFloat(newSchemeCommodityQty)
              : null,
          commodityUnit:
            newSchemeBenefitType !== "CASH" ? newSchemeCommodityUnit.trim() : null,
          commodityMarketValue:
            newSchemeBenefitType !== "CASH" && newSchemeCommodityMarketValue
              ? parseFloat(newSchemeCommodityMarketValue)
              : null,
        }),
      });

      const data = await res.json();
      if (data.success && data.scheme) {
        await fetchDepartments();
        setSelectedSchemeId(data.scheme.id);
        setShowNewSchemeModal(false);
        setNewSchemeName("");
        setNewSchemeCashAmount("600");
        setNewSchemeCommodityName("");
      } else {
        alert(data.error || (language === "bn" ? "কর্মসূচি তৈরি ব্যর্থ হয়েছে" : "Failed to create scheme"));
      }
    } catch (err) {
      console.error(err);
      alert(language === "bn" ? "ত্রুটি ঘটেছে" : "Error creating scheme");
    } finally {
      setCreatingScheme(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    processSelectedFile(selectedFile);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      processSelectedFile(droppedFile);
    }
  };

  const processSelectedFile = (selectedFile: File) => {
    setFile(selectedFile);
    setErrorMessage(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsname = wb.SheetNames[0];
        const ws = wb.Sheets[wsname];
        const data = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1 });

        if (data.length < 2) {
          setErrorMessage(
            language === "bn"
              ? "আপলোডকৃত স্প্রেডশিটে কোনো ডাটা নেই।"
              : "The uploaded spreadsheet is empty or has no data rows."
          );
          return;
        }

        const headers = (data[0] || []).map((h) => String(h || "").trim()).filter(Boolean);
        setExcelHeaders(headers);

        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws);
        setRawRows(rows);

        const initialMapping: Record<string, string> = {};
        for (const sysField of systemFields) {
          const matchedHeader = headers.find((h) => {
            const cleanH = h.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]/g, "");
            return sysField.aliases.some((alias) =>
              cleanH.includes(alias.toLowerCase().replace(/[^a-z0-9\u0980-\u09FF]/g, ""))
            );
          });
          if (matchedHeader) {
            initialMapping[sysField.key] = matchedHeader;
          }
        }

        setColumnMapping(initialMapping);
        setStep(2);
      } catch (err) {
        console.error("Excel parse error:", err);
        setErrorMessage(
          language === "bn"
            ? "ফাইলটি পার্স করতে ব্যর্থ হয়েছে। অনুগ্রহ করে সঠিক এক্সেল ফাইল (.xlsx, .xls, .csv) ব্যবহার করুন।"
            : "Failed to parse Excel file. Please ensure it is a valid .xlsx, .xls, or .csv file."
        );
      }
    };
    reader.readAsBinaryString(selectedFile);
  };

  const cleanedData = useMemo<CleanedRow[]>(() => {
    if (rawRows.length === 0) return [];

    return rawRows.map((row, idx) => {
      const getVal = (sysKey: string): string => {
        const excelCol = columnMapping[sysKey];
        if (!excelCol) return "";
        return String(row[excelCol] ?? "").trim();
      };

      const fullName = getVal("fullName");
      const rawNid = getVal("nid");
      const rawBrn = getVal("brn");
      const guardianName = getVal("guardianName");
      const gender = getVal("gender") || (language === "bn" ? "নারী" : "Female");
      const unionName = getVal("unionName");
      const wardNo = getVal("wardNo");
      const rawMobile = getVal("mobile");
      const cardNumber = getVal("cardNumber");

      const cleanNid = rawNid ? rawNid.replace(/\D/g, "") : undefined;
      let nidValidation: CleanedRow["nidValidation"] = {
        status: "empty",
        message: language === "bn" ? "জাতীয় পরিচয়পত্র দেওয়া হয়নি" : "No NID provided",
      };
      if (cleanNid) {
        if (cleanNid.length === 10) {
          nidValidation = {
            status: "valid",
            message: language === "bn" ? "১০ ডিজিট স্মার্টকার্ড (বৈধ)" : "10-digit Smart Card (Valid)",
          };
        } else if (cleanNid.length === 13) {
          nidValidation = {
            status: "valid",
            message: language === "bn" ? "১৩ ডিজিট এনআইডি (বৈধ)" : "13-digit Legacy NID (Valid)",
          };
        } else if (cleanNid.length === 17) {
          nidValidation = {
            status: "valid",
            message: language === "bn" ? "১৭ ডিজিট বারকোড এনআইডি (বৈধ)" : "17-digit Barcode NID (Valid)",
          };
        } else {
          nidValidation = {
            status: "warning",
            message:
              language === "bn"
                ? `অস্বাভাবিক দৈর্ঘ্য: ${formatNumber(cleanNid.length, language)} ডিজিট`
                : `Unusual NID length: ${cleanNid.length} digits`,
          };
        }
      }

      const cleanBrn = rawBrn ? rawBrn.replace(/\D/g, "") : undefined;
      let brnValidation: CleanedRow["brnValidation"] = {
        status: "empty",
        message: language === "bn" ? "জন্ম নিবন্ধন দেওয়া হয়নি" : "No BRN provided",
      };
      if (cleanBrn) {
        if (cleanBrn.length === 17) {
          brnValidation = {
            status: "valid",
            message: language === "bn" ? "১৭ ডিজিট ডিজিটাল জন্ম নিবন্ধন (বৈধ)" : "17-digit Digital BRN (Valid)",
          };
        } else {
          brnValidation = {
            status: "warning",
            message:
              language === "bn"
                ? `জন্ম নিবন্ধন ১৭ ডিজিট হওয়া আবশ্যক (পাওয়া গেছে ${formatNumber(cleanBrn.length, language)})`
                : `BRN should be 17 digits (got ${cleanBrn.length})`,
          };
        }
      }

      let cleanMobile = rawMobile ? rawMobile.replace(/\D/g, "") : undefined;
      if (cleanMobile && cleanMobile.startsWith("8801")) {
        cleanMobile = cleanMobile.substring(2);
      }

      return {
        rowNumber: idx + 1,
        fullName,
        guardianName,
        gender,
        nid: cleanNid,
        brn: cleanBrn,
        mobile: cleanMobile,
        unionName,
        wardNo,
        cardNumber,
        nidValidation,
        brnValidation,
      };
    });
  }, [rawRows, columnMapping, language, formatNumber]);

  const missingRequiredFields = useMemo(() => {
    return systemFields.filter((f) => f.required && !columnMapping[f.key]);
  }, [systemFields, columnMapping]);

  const handleSubmitBatch = async () => {
    if (!selectedDeptId || !selectedSchemeId) {
      alert(language === "bn" ? "দয়া করে দপ্তর ও কর্মসূচি নির্বাচন করুন।" : "Please select Department and Scheme first.");
      return;
    }

    if (missingRequiredFields.length > 0) {
      alert(
        language === "bn"
          ? `বাধ্যতামূলক ফিল্ডগুলো পূরণ করুন: ${missingRequiredFields.map((f) => f.label).join(", ")}`
          : `Please map required fields: ${missingRequiredFields.map((f) => f.label).join(", ")}`
      );
      return;
    }

    try {
      setUploading(true);
      setErrorMessage(null);

      const recordsToSend = cleanedData.map((r) => ({
        fullName: r.fullName,
        guardianName: r.guardianName,
        gender: r.gender,
        nid: r.nid,
        brn: r.brn,
        mobile: r.mobile,
        unionName: r.unionName,
        wardNo: r.wardNo,
        cardNumber: r.cardNumber,
        rowNumber: r.rowNumber,
      }));

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: selectedDeptId,
          schemeId: selectedSchemeId,
          records: recordsToSend,
          fileName: file?.name || "upload.xlsx",
          uploadedByUserId: currentUser?.id,
        }),
      });

      const data: UploadResponse = await res.json();
      if (data.success) {
        setUploadResult(data);
        setStep(4);
      } else {
        setErrorMessage((data as unknown as { error?: string }).error || (language === "bn" ? "আপলোড সম্পন্ন হয়নি।" : "Failed to process upload."));
      }
    } catch (err) {
      console.error("Upload error:", err);
      setErrorMessage(language === "bn" ? "নেটওয়ার্ক বা সার্ভার সমস্যা ঘটেছে।" : "Network or server error during upload.");
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadSampleExcel = () => {
    const isBn = language === "bn";
    const sampleRows = isBn
      ? [
          {
            "পূর্ণ নাম": "মোসাঃ রহিমা খাতুন",
            "জাতীয় পরিচয়পত্র নম্বর": "19652692015000123",
            "জন্ম নিবন্ধন নম্বর": "",
            "পিতা / স্বামীর নাম": "আব্দুল মজিদ",
            লিঙ্গ: "নারী",
            "ইউনিয়ন পরিষদ": "বাহাদুরপুর",
            "ওয়ার্ড নং": "০৩",
            "মোবাইল নম্বর": "01711223344",
            "কার্ড / বই নম্বর": "VWB-2026-001",
          },
          {
            "পূর্ণ নাম": "হাজেরা বেগম",
            "জাতীয় পরিচয়পত্র নম্বর": "8234567890",
            "জন্ম নিবন্ধন নম্বর": "",
            "পিতা / স্বামীর নাম": "মোঃ কফিল উদ্দিন",
            লিঙ্গ: "নারী",
            "ইউনিয়ন পরিষদ": "বাহাদুরপুর",
            "ওয়ার্ড নং": "০১",
            "মোবাইল নম্বর": "01812345678",
            "কার্ড / বই নম্বর": "VWB-2026-002",
          },
          {
            "পূর্ণ নাম": "মোঃ মজিবুর রহমান",
            "জাতীয় পরিচয়পত্র নম্বর": "19541234567890123",
            "জন্ম নিবন্ধন নম্বর": "",
            "পিতা / স্বামীর নাম": "মৃত আফসার আলী",
            লিঙ্গ: "পুরুষ",
            "ইউনিয়ন পরিষদ": "রামপুর",
            "ওয়ার্ড নং": "০২",
            "মোবাইল নম্বর": "01987654321",
            "কার্ড / বই নম্বর": "OA-2026-045",
          },
          {
            "পূর্ণ নাম": "সালেহা আক্তার",
            "জাতীয় পরিচয়পত্র নম্বর": "",
            "জন্ম নিবন্ধন নম্বর": "20052692015004567",
            "পিতা / স্বামীর নাম": "রফিকুল ইসলাম",
            লিঙ্গ: "নারী",
            "ইউনিয়ন পরিষদ": "বাহাদুরপুর",
            "ওয়ার্ড নং": "০৫",
            "মোবাইল নম্বর": "01722334455",
            "কার্ড / বই নম্বর": "MCBP-2026-089",
          },
          {
            "পূর্ণ নাম": "মোসাঃ রহিমা খাতুন",
            "জাতীয় পরিচয়পত্র নম্বর": "19652692015000123",
            "জন্ম নিবন্ধন নম্বর": "",
            "পিতা / স্বামীর নাম": "আব্দুল মজিদ",
            লিঙ্গ: "নারী",
            "ইউনিয়ন পরিষদ": "বাহাদুরপুর",
            "ওয়ার্ড নং": "০৩",
            "মোবাইল নম্বর": "01711223344",
            "কার্ড / বই নম্বর": "VWB-2026-099",
          },
        ]
      : [
          {
            "Full Name": "Rahima Khatun",
            "NID Number": "19652692015000123",
            "Birth Reg No": "",
            "Guardian / Father Name": "Abdul Majid",
            Gender: "Female",
            Union: "Bahadurpur",
            "Ward No": "03",
            "Mobile No": "01711223344",
            "Card Number": "VWB-2026-001",
          },
          {
            "Full Name": "Hazera Begum",
            "NID Number": "8234567890",
            "Birth Reg No": "",
            "Guardian / Father Name": "Kafil Uddin",
            Gender: "Female",
            Union: "Bahadurpur",
            "Ward No": "01",
            "Mobile No": "01812345678",
            "Card Number": "VWB-2026-002",
          },
          {
            "Full Name": "Md. Mujibur Rahman",
            "NID Number": "19541234567890123",
            "Birth Reg No": "",
            "Guardian / Father Name": "Late Afsar Ali",
            Gender: "Male",
            Union: "Rampur",
            "Ward No": "02",
            "Mobile No": "01987654321",
            "Card Number": "OA-2026-045",
          },
          {
            "Full Name": "Saleha Akhter",
            "NID Number": "",
            "Birth Reg No": "20052692015004567",
            "Guardian / Father Name": "Rafiqul Islam",
            Gender: "Female",
            Union: "Bahadurpur",
            "Ward No": "05",
            "Mobile No": "01722334455",
            "Card Number": "MCBP-2026-089",
          },
          {
            "Full Name": "Rahima Khatun (Duplicate Test)",
            "NID Number": "19652692015000123",
            "Birth Reg No": "",
            "Guardian / Father Name": "Abdul Majid",
            Gender: "Female",
            Union: "Bahadurpur",
            "Ward No": "03",
            "Mobile No": "01711223344",
            "Card Number": "VWB-2026-099",
          },
        ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "SSNP_Beneficiaries");

    worksheet["!cols"] = [
      { wch: 30 },
      { wch: 22 },
      { wch: 22 },
      { wch: 25 },
      { wch: 12 },
      { wch: 18 },
      { wch: 10 },
      { wch: 15 },
      { wch: 18 },
    ];

    XLSX.writeFile(
      workbook,
      isBn ? "উপজেলা_সুবিধাভোগী_নমুনা_ফাইল.xlsx" : "SSNP_Beneficiary_Template.xlsx"
    );
  };

  const resetForm = () => {
    setFile(null);
    setExcelHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setUploadResult(null);
    setErrorMessage(null);
    setStep(1);
  };

  if (isUnionViewer) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-lg mx-auto bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <Ban className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {t.upload.restrictedTitle}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {t.upload.restrictedDesc}
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition-all shadow-xs"
            >
              {t.upload.returnDashboard}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Top Header Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 mb-2">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                {t.upload.badge}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {t.upload.title}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {t.upload.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/admin/audit-logs"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold transition-all shadow-xs"
              >
                <History className="w-4 h-4 text-blue-700" />
                <span>{language === "bn" ? "আপলোডকৃত ব্যাচ হিস্ট্রি" : "Batch History & Logs"}</span>
              </Link>

              <button
                onClick={handleDownloadSampleExcel}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-all shadow-xs cursor-pointer"
                title={t.upload.downloadTemplate}
              >
                <Download className="w-4 h-4 text-emerald-700" />
                {t.upload.downloadTemplate}
              </button>
            </div>
          </div>

          {/* Stepper Wizard Progress */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <div className="grid grid-cols-4 gap-2 sm:gap-4 text-center">
              {[
                { s: 1, title: t.upload.step1 },
                { s: 2, title: t.upload.step2 },
                { s: 3, title: t.upload.step3 },
                { s: 4, title: t.upload.step4 },
              ].map((item) => (
                <div
                  key={item.s}
                  className={`py-2 px-3 rounded-xl border text-xs sm:text-sm font-medium transition-all ${
                    step === item.s
                      ? "bg-emerald-800 text-white border-emerald-800 shadow-sm"
                      : step > item.s
                      ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                      : "bg-slate-50 text-slate-400 border-slate-200"
                  }`}
                >
                  {item.title}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Global Error Banner */}
        {errorMessage && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-sm">{t.common.error}</div>
              <div className="text-xs mt-0.5 text-red-700">{errorMessage}</div>
            </div>
          </div>
        )}

        {/* STEP 1: Program Selection & File Upload */}
        {step === 1 && (
          <div className="space-y-6">
            {/* Scheme & Department Selection Box */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-emerald-700" />
                {t.upload.selectDeptScheme}
              </h2>

              {loadingDepts ? (
                <div className="flex items-center gap-2 py-4 text-sm text-slate-500">
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-600" />
                  {t.upload.loadingDepts}
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Department Select */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        {t.upload.labelDept}
                      </label>
                      {isDeptOfficer && (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                          <Lock className="w-3 h-3" />
                          {t.upload.onlyOwnDept}
                        </span>
                      )}
                    </div>
                    <select
                      value={selectedDeptId}
                      onChange={(e) => handleDepartmentChange(e.target.value)}
                      disabled={isDeptOfficer}
                      className={`w-full px-4 py-2.5 rounded-xl border font-medium text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                        isDeptOfficer
                          ? "bg-slate-100 text-slate-700 border-slate-300 cursor-not-allowed"
                          : "bg-white text-slate-800 border-slate-300"
                      }`}
                    >
                      {departments.map((dept) => (
                        <option key={dept.id} value={dept.id}>
                          {getDepartmentName(dept, language)} ({formatNumber(dept.schemes.length, language)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Scheme Select */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        {t.upload.labelScheme}
                      </label>
                      {isSuperAdmin && (
                        <button
                          type="button"
                          onClick={() => setShowNewSchemeModal(true)}
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {t.upload.btnAddNewScheme}
                        </button>
                      )}
                    </div>

                    <select
                      value={selectedSchemeId}
                      onChange={(e) => setSelectedSchemeId(e.target.value)}
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      {currentDept?.schemes.map((scheme) => (
                        <option key={scheme.id} value={scheme.id}>
                          {getSchemeName(scheme, language)} — {formatCurrency(scheme.monthlyAmount, language)} ({scheme.frequency})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Selected Scheme Detail Pill */}
              {currentScheme && (
                <div className="mt-4 p-3 bg-emerald-50/70 rounded-xl border border-emerald-200/60 flex items-center justify-between text-xs text-emerald-900">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-700" />
                    <span>
                      {t.upload.labelScheme}: <strong>{getSchemeName(currentScheme, language)}</strong>
                    </span>
                  </div>
                  <div className="flex items-center gap-4">
                    <span>
                      {t.upload.effectiveMonthlyValue} <strong>{formatCurrency(currentScheme.monthlyAmount, language)}</strong> {t.common.perMonth}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-emerald-200/70 font-semibold uppercase text-[10px]">
                      {currentScheme.frequency}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Drag & Drop File Zone */}
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-4">
                <FileSpreadsheet className="w-5 h-5 text-emerald-700" />
                {t.upload.excelFileTitle}
              </h2>

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-600 rounded-2xl p-10 text-center cursor-pointer bg-slate-50/50 hover:bg-emerald-50/30 transition-all group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  className="hidden"
                  onChange={handleFileChange}
                />
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                  <UploadCloud className="w-8 h-8" />
                </div>
                <h3 className="font-semibold text-slate-800 text-base mb-1">
                  {t.upload.dropzoneTitle}
                </h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  {t.upload.dropzoneSub}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: Column Mapping UI */}
        {step === 2 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-700" />
                  {t.upload.mappingTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {t.upload.selectedFile} <strong className="text-slate-800">{file?.name}</strong> • {t.upload.totalRowsFound} {formatNumber(rawRows.length, language)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setStep(1)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-xs text-slate-600 hover:bg-slate-100 font-medium"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {t.upload.changeFile}
              </button>
            </div>

            {/* Missing Required Warning */}
            {missingRequiredFields.length > 0 && (
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0" />
                <span>
                  {language === "bn" ? "বাকি থাকা আবশ্যক ফিল্ড:" : "Required fields remaining:"}{" "}
                  <strong>{missingRequiredFields.map((f) => f.label).join(", ")}</strong>
                </span>
              </div>
            )}

            {/* Grid of Mappings */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {systemFields.map((sysField) => {
                const currentMappedCol = columnMapping[sysField.key] || "";
                return (
                  <div
                    key={sysField.key}
                    className={`p-4 rounded-xl border transition-all ${
                      currentMappedCol
                        ? "border-emerald-300 bg-emerald-50/30"
                        : sysField.required
                        ? "border-amber-300 bg-amber-50/20"
                        : "border-slate-200 bg-slate-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
                        {sysField.label}
                        {sysField.required && (
                          <span className="text-red-500 text-xs font-bold">*</span>
                        )}
                      </span>
                      {currentMappedCol ? (
                        <span className="text-[11px] font-medium text-emerald-700 flex items-center gap-1">
                          <Check className="w-3.5 h-3.5" /> {t.upload.mapped}
                        </span>
                      ) : sysField.required ? (
                        <span className="text-[11px] font-medium text-amber-600">{t.upload.required}</span>
                      ) : (
                        <span className="text-[11px] text-slate-400">{t.upload.optional}</span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 mb-2">{sysField.description}</p>

                    <select
                      value={currentMappedCol}
                      onChange={(e) => {
                        const val = e.target.value;
                        setColumnMapping((prev) => ({
                          ...prev,
                          [sysField.key]: val,
                        }));
                      }}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="">{t.upload.ignoreField}</option>
                      {excelHeaders.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>

            {/* Navigation buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {t.upload.prevStep}
              </button>

              <button
                type="button"
                disabled={missingRequiredFields.length > 0}
                onClick={() => setStep(3)}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-sm font-semibold shadow-sm transition-all"
              >
                {t.upload.nextPreview}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Automated Cleansing & Live Preview */}
        {step === 3 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-xs font-semibold mb-1">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  {t.upload.badge}
                </div>
                <h2 className="text-lg font-bold text-slate-900">
                  {t.upload.previewTitle}
                </h2>
                <p className="text-xs text-slate-500">
                  {t.upload.previewSub} ({formatNumber(cleanedData.length, language)} {language === "bn" ? "রেকর্ড" : "records"})
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 hover:bg-slate-100 font-medium"
                >
                  {t.upload.prevStep}
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleSubmitBatch}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-sm font-bold shadow-md transition-all"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      {t.upload.submitting}
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="w-4 h-4" />
                      {t.upload.btnSubmitBatch}
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Validation Statistics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">
                  {language === "bn" ? "মোট রেকর্ড" : "Total Rows"}
                </div>
                <div className="text-xl font-bold text-slate-900 mt-1">
                  {formatNumber(cleanedData.length, language)}
                </div>
              </div>
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200">
                <div className="text-xs text-emerald-700 font-medium">
                  {language === "bn" ? "বৈধ এনআইডি / বিআরএন" : "Valid NID/BRN Records"}
                </div>
                <div className="text-xl font-bold text-emerald-800 mt-1">
                  {formatNumber(
                    cleanedData.filter(
                      (r) => r.nidValidation.status === "valid" || r.brnValidation.status === "valid"
                    ).length,
                    language
                  )}
                </div>
              </div>
              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200">
                <div className="text-xs text-amber-700 font-medium">
                  {language === "bn" ? "সতর্কবার্তা" : "Format Warnings"}
                </div>
                <div className="text-xl font-bold text-amber-800 mt-1">
                  {formatNumber(
                    cleanedData.filter(
                      (r) => r.nidValidation.status === "warning" || r.brnValidation.status === "warning"
                    ).length,
                    language
                  )}
                </div>
              </div>
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200">
                <div className="text-xs text-blue-700 font-medium">
                  {language === "bn" ? "কর্মসূচির মাসিক সমমূল্য" : "Scheme Monthly Rate"}
                </div>
                <div className="text-sm font-bold text-blue-900 mt-1">
                  {formatCurrency(currentScheme?.monthlyAmount || 0, language)} {t.common.perMonth}
                </div>
              </div>
            </div>

            {/* Table Preview */}
            <div className="overflow-x-auto border border-slate-200 rounded-xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3">{t.upload.colRow}</th>
                    <th className="py-2.5 px-3">{t.upload.colName}</th>
                    <th className="py-2.5 px-3">{t.upload.colGuardian}</th>
                    <th className="py-2.5 px-3">{t.upload.colGender}</th>
                    <th className="py-2.5 px-3">{t.upload.colNid}</th>
                    <th className="py-2.5 px-3">{t.upload.colBrn}</th>
                    <th className="py-2.5 px-3">{t.upload.colUnionWard}</th>
                    <th className="py-2.5 px-3">{t.upload.colMobile}</th>
                    <th className="py-2.5 px-3">{t.upload.colCard}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800 font-normal">
                  {cleanedData.slice(0, 10).map((row) => (
                    <tr key={row.rowNumber} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-3 text-slate-400 font-mono">
                        {formatNumber(row.rowNumber, language)}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{row.fullName}</td>
                      <td className="py-2.5 px-3 text-slate-600">{row.guardianName}</td>
                      <td className="py-2.5 px-3">
                        <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 text-[10px] font-medium">
                          {row.gender}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {row.nid ? (
                          <div>
                            <span className="font-semibold text-slate-900">{row.nid}</span>
                            <div className="text-[10px] text-emerald-700">{row.nidValidation.message}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono">
                        {row.brn ? (
                          <div>
                            <span className="font-semibold text-slate-900">{row.brn}</span>
                            <div className="text-[10px] text-blue-700">{row.brnValidation.message}</div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">-</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-medium text-slate-900">{row.unionName}</span>
                        <span className="text-slate-500 ml-1">
                          {language === "bn" ? `ওয়ার্ড-${formatNumber(row.wardNo, language)}` : `W-${row.wardNo}`}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {row.mobile || <span className="text-slate-300">-</span>}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600">
                        {row.cardNumber || <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* STEP 4: Real-time Deduplication Results Summary */}
        {step === 4 && uploadResult && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-slate-900">
                    {t.upload.auditResultsTitle}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {language === "bn" ? "ব্যাচ আইডি:" : "Batch ID:"}{" "}
                    <span className="font-mono font-semibold text-slate-800">{uploadResult.batchId}</span> • {t.upload.labelScheme}:{" "}
                    <strong>{currentScheme?.name}</strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href="/admin/audit-logs"
                  className="px-4 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-semibold shadow-xs"
                >
                  {language === "bn" ? "ব্যাচ হিস্ট্রি ও রোলব্যাক" : "Batch History & Rollback"}
                </Link>
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 cursor-pointer"
                >
                  {t.upload.btnUploadAnother}
                </button>
                <Link
                  href="/duplicates"
                  className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-xs"
                >
                  {t.upload.btnViewDuplicates} &rarr;
                </Link>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                <div className="text-xs text-slate-500 font-medium">{t.upload.kpiTotalUploaded}</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">
                  {formatNumber(uploadResult.totalRecords, language)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200">
                <div className="text-xs text-emerald-800 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {t.upload.kpiActiveClean}
                </div>
                <div className="text-2xl font-bold text-emerald-800 mt-1">
                  {formatNumber(uploadResult.activeCount, language)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-red-50 border border-red-200">
                <div className="text-xs text-red-800 font-medium flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                  {t.upload.kpiDuplicatesFlagged}
                </div>
                <div className="text-2xl font-bold text-red-700 mt-1">
                  {formatNumber(uploadResult.flaggedCount, language)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200">
                <div className="text-xs text-blue-800 font-medium">{t.upload.kpiNewCreated}</div>
                <div className="text-2xl font-bold text-blue-900 mt-1">
                  {formatNumber(uploadResult.newBeneficiariesCreated, language)}
                </div>
              </div>

              <div className="p-4 rounded-xl bg-purple-50 border border-purple-200">
                <div className="text-xs text-purple-800 font-medium">{t.upload.kpiExistingMatched}</div>
                <div className="text-2xl font-bold text-purple-900 mt-1">
                  {formatNumber(uploadResult.existingBeneficiariesMatched, language)}
                </div>
              </div>
            </div>

            {/* Flagged Duplicates List */}
            {uploadResult.flaggedCount > 0 ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    {t.upload.duplicatesFound} ({formatNumber(uploadResult.flags.length, language)})
                  </h3>
                </div>

                <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden">
                  {uploadResult.flags.map((flag, idx) => (
                    <div key={idx} className="p-4 bg-red-50/40 hover:bg-red-50/70 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded bg-red-200 text-red-900 text-[10px] font-bold uppercase tracking-wide">
                              {flag.flagType.replace(/_/g, " ")}
                            </span>
                            <span className="font-bold text-sm text-slate-900">
                              {language === "bn" ? `রেকর্ড #${formatNumber(flag.rowNumber, language)}` : `Row #${flag.rowNumber}`}: {flag.fullName}
                            </span>
                            {flag.nid && (
                              <span className="font-mono text-xs text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {language === "bn" ? "এনআইডি:" : "NID:"} {flag.nid}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-red-800 font-medium">{flag.reason}</p>
                        </div>

                        {flag.existingRecord && (
                          <div className="bg-white p-2.5 rounded-lg border border-red-200 text-xs text-slate-700 shrink-0 min-w-[260px]">
                            <div className="font-semibold text-slate-900 text-[11px] uppercase tracking-wider mb-1 text-red-700">
                              {language === "bn" ? "পূর্বে থাকা সক্রিয় ভাতা" : "Existing Active Enrollment"}
                            </div>
                            <div>{t.upload.labelScheme}: <strong>{getSchemeName(flag.existingRecord, language)}</strong></div>
                            <div>{t.upload.labelDept}: {getDepartmentName(flag.existingRecord, language)}</div>
                            <div>{t.common.actions}: {formatCurrency(flag.existingRecord.monthlyAmount, language)} {t.common.perMonth}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-8 text-center bg-emerald-50/60 rounded-xl border border-emerald-200">
                <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-2" />
                <h3 className="font-bold text-emerald-900 text-base">{t.upload.zeroDuplicates}</h3>
                <p className="text-xs text-emerald-700 mt-1 max-w-md mx-auto">
                  {language === "bn"
                    ? `এই ব্যাচের সকল ${formatNumber(uploadResult.totalRecords, language)} টি রেকর্ড সফলভাবে যাচাই সম্পন্ন হয়েছে। কোনো ডুপ্লিকেট পাওয়া যায়নি।`
                    : `All ${uploadResult.totalRecords} records in this batch passed validation with no duplicate NIDs or cross-program conflicts. All enrollments set to Active.`}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Create Scheme Modal */}
        {showNewSchemeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Plus className="w-4 h-4 text-emerald-700" />
                  {t.schemes.modalAddTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowNewSchemeModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateScheme} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    {t.schemes.labelMinistry}
                  </label>
                  <input
                    type="text"
                    disabled
                    value={currentDept?.name || ""}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-slate-100 text-xs text-slate-600 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    {t.schemes.labelSchemeName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newSchemeName}
                    onChange={(e) => setNewSchemeName(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                    {t.schemes.labelBenefitType} *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {BENEFIT_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setNewSchemeBenefitType(opt.value as any)}
                        className={`p-2.5 rounded-xl border text-left transition-all ${
                          newSchemeBenefitType === opt.value
                            ? "border-emerald-600 bg-emerald-50 text-emerald-950 font-bold"
                            : "border-slate-200 bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="text-[11px] leading-snug">
                          {language === "bn" ? opt.labelBn : opt.labelEn}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {(newSchemeBenefitType === "COMMODITY" || newSchemeBenefitType === "HYBRID") && (
                  <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2 text-xs">
                    <span className="font-bold text-amber-900 flex items-center gap-1">
                      <Wheat className="w-3.5 h-3.5 text-amber-700" />
                      {t.schemes.labelCommodityDetails}
                    </span>

                    <div className="grid grid-cols-3 gap-2">
                      <div className="col-span-1">
                        <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                          {t.schemes.labelCommodityName}
                        </label>
                        <input
                          type="text"
                          required
                          value={newSchemeCommodityName}
                          onChange={(e) => setNewSchemeCommodityName(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                          {t.schemes.labelCommodityQty}
                        </label>
                        <input
                          type="number"
                          required
                          min="0.1"
                          step="any"
                          value={newSchemeCommodityQty}
                          onChange={(e) => setNewSchemeCommodityQty(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                          {t.schemes.labelCommodityUnit}
                        </label>
                        <select
                          value={newSchemeCommodityUnit}
                          onChange={(e) => setNewSchemeCommodityUnit(e.target.value)}
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                        >
                          <option value={language === "bn" ? "কেজি" : "kg"}>
                            {language === "bn" ? "কেজি" : "kg"}
                          </option>
                          <option value={language === "bn" ? "বস্তা" : "bag"}>
                            {language === "bn" ? "বস্তা" : "bag"}
                          </option>
                          <option value={language === "bn" ? "প্যাকেট" : "packet"}>
                            {language === "bn" ? "প্যাকেট" : "packet"}
                          </option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-semibold text-slate-700 mb-0.5">
                        {t.schemes.labelMarketValue} *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        value={newSchemeCommodityMarketValue}
                        onChange={(e) => setNewSchemeCommodityMarketValue(e.target.value)}
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white"
                      />
                    </div>
                  </div>
                )}

                {(newSchemeBenefitType === "CASH" || newSchemeBenefitType === "HYBRID") && (
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      {t.schemes.labelCashAmount} *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={newSchemeCashAmount}
                      onChange={(e) => setNewSchemeCashAmount(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                      {t.schemes.labelFrequency} *
                    </label>
                    <select
                      value={newSchemeFrequency}
                      onChange={(e) => setNewSchemeFrequency(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    >
                      {FREQUENCY_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {language === "bn" ? f.labelBn : f.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col justify-center">
                    <span className="text-[10px] font-semibold text-emerald-800 uppercase">
                      {t.schemes.labelNormalizedMonthly}
                    </span>
                    <span className="text-sm font-black text-emerald-950">
                      {formatCurrency(
                        calculateMonthlyEquivalent({
                          benefitType: newSchemeBenefitType,
                          cashAmount: parseFloat(newSchemeCashAmount) || 0,
                          commodityMarketValue: parseFloat(newSchemeCommodityMarketValue) || 0,
                          frequency: newSchemeFrequency,
                        }).monthlyAmount,
                        language
                      )}{" "}
                      {t.common.perMonth}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowNewSchemeModal(false)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={creatingScheme}
                    className="px-4 py-2 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold disabled:opacity-50"
                  >
                    {creatingScheme ? t.common.saving : t.common.save}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
