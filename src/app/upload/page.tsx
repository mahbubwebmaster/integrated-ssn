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
  Database,
  Trash2,
  Play,
  RefreshCw,
  Clock,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  calculateMonthlyEquivalent,
  FREQUENCY_OPTIONS,
  BENEFIT_TYPE_OPTIONS,
} from "@/lib/scheme-calc";
import { NETROKONA_UPAZILAS } from "@/lib/netrokona";
import {
  DEPARTMENT_PRESETS,
  findMatchingHeader,
  DepartmentPreset,
} from "@/lib/department-presets";

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
    key: "district",
    labelBn: "জেলা",
    labelEn: "District",
    required: false,
    descBn: "সুবিধাভোগীর জেলা (যেমন: নেত্রকোণা)",
    descEn: "Beneficiary district (e.g. Netrokona)",
    aliases: ["district", "zila", "জেলা", "জেলার নাম", "সুবিধাভোগীর জেলা"],
  },
  {
    key: "upazilaName",
    labelBn: "উপজেলা",
    labelEn: "Upazila",
    required: false,
    descBn: "সুবিধাভোগীর উপজেলা (যেমন: নেত্রকোণা সদর, কেন্দুয়া ইত্যাদি)",
    descEn: "Beneficiary Upazila (e.g. Netrokona Sadar, Kendua etc.)",
    aliases: ["upazila", "upazila_name", "upazilaname", "thana", "উপজেলা", "উপজেলার নাম", "থানা"],
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
  district?: string;
  upazilaName?: string;
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
  const [selectedDistrict, setSelectedDistrict] = useState("নেত্রকোণা");
  const [selectedUpazila, setSelectedUpazila] = useState(currentUser.upazilaName || "নেত্রকোণা সদর");

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

  // Staging Buffer & Preset State
  const [activeTab, setActiveTab] = useState<"upload" | "staging">("upload");
  const [stagedBatches, setStagedBatches] = useState<any[]>([]);
  const [loadingStaged, setLoadingStaged] = useState(false);
  const [currentStagedId, setCurrentStagedId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>("auto");
  const [savingToStaging, setSavingToStaging] = useState(false);
  const [stagingSuccessMsg, setStagingSuccessMsg] = useState<string | null>(null);

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

  const fetchStagedBatches = async () => {
    try {
      setLoadingStaged(true);
      const res = await fetch("/api/staging");
      const data = await res.json();
      if (data.success && Array.isArray(data.stagedBatches)) {
        setStagedBatches(data.stagedBatches);
      }
    } catch (e) {
      console.error("Failed to load staging batches:", e);
    } finally {
      setLoadingStaged(false);
    }
  };

  useEffect(() => {
    fetchStagedBatches();
  }, []);

  const handleApplyPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = DEPARTMENT_PRESETS.find((p) => p.id === presetId);
    const newMapping: Record<string, string> = {};

    for (const sysField of systemFields) {
      const presetCol = preset?.mappings ? preset.mappings[sysField.key] : undefined;
      const matched = findMatchingHeader(excelHeaders, sysField.aliases, presetCol);
      if (matched) {
        newMapping[sysField.key] = matched;
      }
    }
    setColumnMapping(newMapping);
  };

  const handleSaveToStaging = async () => {
    if (!selectedDeptId || !selectedSchemeId) {
      alert(language === "bn" ? "দপ্তর ও কর্মসূচি নির্বাচন করুন।" : "Please select department & scheme.");
      return;
    }
    if (rawRows.length === 0) {
      alert(language === "bn" ? "কোনো ডাটা পাওয়া যায়নি।" : "No rows to stage.");
      return;
    }

    try {
      setSavingToStaging(true);
      setStagingSuccessMsg(null);
      const res = await fetch("/api/staging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          departmentId: selectedDeptId,
          departmentName: currentDept?.nameBn || currentDept?.name,
          schemeId: selectedSchemeId,
          schemeName: currentScheme?.nameBn || currentScheme?.name,
          district: selectedDistrict,
          upazilaName: selectedUpazila,
          fileName: file?.name || "uploaded_data.xlsx",
          headers: excelHeaders,
          rawRows,
          columnMapping,
          presetId: selectedPresetId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setCurrentStagedId(data.stageId);
        setStagingSuccessMsg(
          language === "bn"
            ? `✓ ফাইলটি সফলভাবে অস্থায়ী স্টেজিং টেবিলে সংরক্ষিত হয়েছে (${formatNumber(rawRows.length, language)} টি সারি)।`
            : `✓ File saved to staging buffer successfully (${rawRows.length} rows).`
        );
        fetchStagedBatches();
      } else {
        alert(data.error || "Failed to save staging data");
      }
    } catch (e: any) {
      console.error("Save to staging error:", e);
      alert("Error saving to staging");
    } finally {
      setSavingToStaging(false);
    }
  };

  const handleLoadStagedBatch = async (stagedItem: any) => {
    try {
      setLoadingStaged(true);
      const res = await fetch(`/api/staging/${stagedItem.id}`);
      const data = await res.json();
      if (data.success && data.rawRows) {
        setCurrentStagedId(stagedItem.id);
        setSelectedDeptId(stagedItem.departmentId);
        setSelectedSchemeId(stagedItem.schemeId);
        setSelectedDistrict(stagedItem.district || "নেত্রকোণা");
        setSelectedUpazila(stagedItem.upazilaName || "নেত্রকোণা সদর");
        setExcelHeaders(stagedItem.headers || []);
        setRawRows(data.rawRows);
        setFile({ name: stagedItem.fileName } as any);

        if (stagedItem.columnMapping && Object.keys(stagedItem.columnMapping).length > 0) {
          setColumnMapping(stagedItem.columnMapping);
        } else {
          const autoMap: Record<string, string> = {};
          for (const sysField of systemFields) {
            const m = findMatchingHeader(stagedItem.headers || [], sysField.aliases);
            if (m) autoMap[sysField.key] = m;
          }
          setColumnMapping(autoMap);
        }

        setActiveTab("upload");
        setStep(2);
      }
    } catch (e) {
      console.error("Failed to load staged batch:", e);
    } finally {
      setLoadingStaged(false);
    }
  };

  const handleDeleteStagedBatch = async (id: string) => {
    if (!confirm(language === "bn" ? "আপনি কি নিশ্চিত এই খসড়া ডাটা মুছে ফেলতে চান?" : "Are you sure you want to discard this staged batch?")) return;
    try {
      const res = await fetch(`/api/staging/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        fetchStagedBatches();
        if (currentStagedId === id) {
          setCurrentStagedId(null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

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
      const district = getVal("district") || selectedDistrict || "নেত্রকোণা";
      const upazilaName = getVal("upazilaName") || selectedUpazila || "নেত্রকোণা সদর";
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
        district,
        upazilaName,
        unionName,
        wardNo,
        cardNumber,
        nidValidation,
        brnValidation,
      };
    });
  }, [rawRows, columnMapping, language, formatNumber, selectedDistrict, selectedUpazila]);

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

      let res;
      if (currentStagedId) {
        res = await fetch(`/api/staging/${currentStagedId}/commit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            columnMapping,
          }),
        });
      } else {
        const recordsToSend = cleanedData.map((r) => ({
          fullName: r.fullName,
          guardianName: r.guardianName,
          gender: r.gender,
          nid: r.nid,
          brn: r.brn,
          mobile: r.mobile,
          district: r.district || selectedDistrict,
          upazilaName: r.upazilaName || selectedUpazila,
          unionName: r.unionName,
          wardNo: r.wardNo,
          cardNumber: r.cardNumber,
          rowNumber: r.rowNumber,
        }));

        res = await fetch("/api/upload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            departmentId: selectedDeptId,
            schemeId: selectedSchemeId,
            district: selectedDistrict,
            upazilaName: selectedUpazila,
            records: recordsToSend,
            fileName: file?.name || "upload.xlsx",
            uploadedByUserId: currentUser?.id,
          }),
        });
      }

      const data: UploadResponse = await res.json();
      if (data.success) {
        setUploadResult(data);
        setStep(4);
        fetchStagedBatches();
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
            "জেলা": "নেত্রকোণা",
            "উপজেলা": "নেত্রকোণা সদর",
            "ইউনিয়ন পরিষদ": "মৌগাতি",
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
            "জেলা": "নেত্রকোণা",
            "উপজেলা": "নেত্রকোণা সদর",
            "ইউনিয়ন পরিষদ": "মৌগাতি",
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
            "জেলা": "নেত্রকোণা",
            "উপজেলা": "কেন্দুয়া",
            "ইউনিয়ন পরিষদ": "সান্দিকোণা",
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
            "জেলা": "নেত্রকোণা",
            "উপজেলা": "দুর্গাপুর",
            "ইউনিয়ন পরিষদ": "বিরিশিরি",
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
            "জেলা": "নেত্রকোণা",
            "উপজেলা": "নেত্রকোণা সদর",
            "ইউনিয়ন পরিষদ": "মৌগাতি",
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
            District: "Netrokona",
            Upazila: "Netrokona Sadar",
            Union: "Mougati",
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
            District: "Netrokona",
            Upazila: "Netrokona Sadar",
            Union: "Mougati",
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
            District: "Netrokona",
            Upazila: "Kendua",
            Union: "Sandikona",
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
            District: "Netrokona",
            Upazila: "Durgapur",
            Union: "Birishiri",
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
            District: "Netrokona",
            Upazila: "Netrokona Sadar",
            Union: "Mougati",
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

          {/* Tab Navigation: Upload Wizard vs Staging Buffer */}
          <div className="mt-6 flex border-b border-slate-200 gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === "upload"
                  ? "border-emerald-700 text-emerald-800"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <UploadCloud className="w-4 h-4" />
              <span>{language === "bn" ? "নতুন ফাইল আপলোড ও উইজার্ড" : "Upload & Ingest Wizard"}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("staging");
                fetchStagedBatches();
              }}
              className={`pb-3 px-4 text-xs sm:text-sm font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === "staging"
                  ? "border-emerald-700 text-emerald-800"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              <Database className="w-4 h-4" />
              <span>{language === "bn" ? "অস্থায়ী ডাটা স্টেজিং বাফার" : "Staging Buffer"}</span>
              {stagedBatches.length > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                  {formatNumber(stagedBatches.length, language)}
                </span>
              )}
            </button>
          </div>

          {/* Stepper Wizard Progress */}
          {activeTab === "upload" && (
            <div className="mt-6 pt-2">
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
          )}
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
        {activeTab === "upload" && step === 1 && (
          <div className="space-y-6">
            {/* Multi-Department MIS Info Banner */}
            <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-2xl border border-blue-200 flex items-start gap-3 shadow-xs">
              <Database className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div className="text-xs text-blue-900 leading-relaxed">
                <span className="font-bold">
                  {language === "bn" ? "বহু-দাপ্তরিক MIS এক্সপোর্ট ডাটা সরাসরি আপলোড:" : "Multi-Department MIS Support:"}
                </span>{" "}
                {language === "bn"
                  ? "সমাজসেবা (বয়স্ক/বিধবা/প্রতিবন্ধী), মহিলা বিষয়ক (VWB), খাদ্য অধিদপ্তর (FFP/OMS), দুর্যোগ ব্যবস্থাপনা (VGF/GR) কিংবা টিসিবি যেকোনো দপ্তরের এক্সপোর্ট ফাইল কলামের ক্রম না বদলেই আপলোড করুন। পরবর্তী ধাপে প্রিসেট ও অস্থায়ী স্টেজিং সুবিধা রয়েছে।"
                  : "Upload roster exports directly from Social Services, Women Affairs, Food, Relief, or TCB without reordering columns. Department presets and staging buffer are available in next steps."}
              </div>
            </div>

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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
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
                      className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border font-medium text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
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
                          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 min-h-[28px]"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          {t.upload.btnAddNewScheme}
                        </button>
                      )}
                    </div>

                    <select
                      value={selectedSchemeId}
                      onChange={(e) => setSelectedSchemeId(e.target.value)}
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      {currentDept?.schemes.map((scheme) => (
                        <option key={scheme.id} value={scheme.id}>
                          {getSchemeName(scheme, language)} — {formatCurrency(scheme.monthlyAmount, language)} ({scheme.frequency})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* District Select */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">
                      {t.upload.labelDistrict || "জেলা"}
                    </label>
                    <input
                      type="text"
                      value={selectedDistrict}
                      onChange={(e) => setSelectedDistrict(e.target.value)}
                      placeholder="যেমন: নেত্রকোণা"
                      className="w-full min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-800 font-medium text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>

                  {/* Upazila Select */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                        {t.upload.labelUpazila || "উপজেলা"}
                      </label>
                      <span className="text-[11px] text-slate-400">
                        {language === "bn" ? "(ডিফল্ট ব্যাচ উপজেলা)" : "(Default batch upazila)"}
                      </span>
                    </div>
                    <select
                      value={selectedUpazila}
                      onChange={(e) => setSelectedUpazila(e.target.value)}
                      disabled={!isSuperAdmin && Boolean(currentUser.upazilaName)}
                      className={`w-full min-h-[44px] px-4 py-2.5 rounded-xl border font-medium text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                        !isSuperAdmin && currentUser.upazilaName
                          ? "bg-slate-100 text-slate-600 border-slate-300 cursor-not-allowed"
                          : "bg-white text-slate-800 border-slate-300"
                      }`}
                    >
                      {NETROKONA_UPAZILAS.map((up) => (
                        <option key={up.key} value={up.nameBn}>
                          {language === "bn" ? up.nameBn : up.nameEn}
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
        {activeTab === "upload" && step === 2 && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="w-5 h-5 text-emerald-700" />
                  {t.upload.mappingTitle}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap items-center gap-2">
                  <span>
                    {t.upload.selectedFile} <strong className="text-slate-800">{file?.name}</strong> • {t.upload.totalRowsFound}{" "}
                    {formatNumber(rawRows.length, language)}
                  </span>
                  {currentStagedId && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200">
                      {language === "bn" ? `স্টেজিং আইডি: ${currentStagedId}` : `Stage ID: ${currentStagedId}`}
                    </span>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveToStaging}
                  disabled={savingToStaging}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-200 text-xs font-bold transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  title={language === "bn" ? "পরে কাজ করার জন্য অথবা ড্রাফট রাখার জন্য এই কাঁচা ডাটা অস্থায়ী টেবিলে সংরক্ষণ করুন" : "Save raw data into temporary staging table"}
                >
                  {savingToStaging ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-700" />
                  ) : (
                    <Database className="w-3.5 h-3.5 text-blue-700" />
                  )}
                  <span>{language === "bn" ? "অস্থায়ী স্টেজিংয়ে সংরক্ষণ" : "Save to Staging"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-600 hover:bg-slate-100 font-medium cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t.upload.changeFile}
                </button>
              </div>
            </div>

            {/* Staging Success Notification */}
            {stagingSuccessMsg && (
              <div className="p-3 bg-blue-50 rounded-xl border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="w-4 h-4 text-blue-600 shrink-0" />
                  <span>{stagingSuccessMsg}</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStagingSuccessMsg(null)}
                  className="text-blue-500 hover:text-blue-700 font-bold ml-2 text-xs cursor-pointer"
                >
                  ✕
                </button>
              </div>
            )}

            {/* Department MIS Preset Selector Box */}
            <div className="p-4 bg-gradient-to-r from-emerald-50/70 to-teal-50/70 rounded-xl border border-emerald-200/80">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                    <Sparkles className="w-4 h-4 text-emerald-700" />
                    <span>{language === "bn" ? "দপ্তরভিত্তিক MIS কলাম প্রিসেট (Auto-Mapper)" : "Department MIS Preset (Auto-Mapper)"}</span>
                  </div>
                  <p className="text-[11px] text-slate-600">
                    {language === "bn"
                      ? "যে দপ্তরের এমআইএস থেকে ফাইলটি এসেছে তা নির্বাচন করুন, সিস্টেম স্বয়ংক্রিয়ভাবে সংশ্লিষ্ট কলামগুলো ম্যাচ করিয়ে নিবে।"
                      : "Select the originating department MIS format to auto-align its unique column structure."}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={selectedPresetId}
                    onChange={(e) => handleApplyPreset(e.target.value)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    {DEPARTMENT_PRESETS.map((p) => (
                      <option key={p.id} value={p.id}>
                        {language === "bn" ? p.nameBn : p.nameEn}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset(selectedPresetId)}
                    className="min-h-[38px] px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{language === "bn" ? "প্রয়োগ করুন" : "Apply"}</span>
                  </button>
                </div>
              </div>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              {systemFields.map((sysField) => {
                const currentMappedCol = columnMapping[sysField.key] || "";
                return (
                  <div
                    key={sysField.key}
                    className={`p-3.5 sm:p-4 rounded-xl border transition-all ${
                      currentMappedCol
                        ? "border-emerald-300 bg-emerald-50/30"
                        : sysField.required
                        ? "border-amber-300 bg-amber-50/20"
                        : "border-slate-200 bg-slate-50/40"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="font-semibold text-xs sm:text-sm text-slate-900 flex items-center gap-1.5">
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
                    <p className="text-[11px] sm:text-xs text-slate-500 mb-2 leading-relaxed">{sysField.description}</p>

                    <select
                      value={currentMappedCol}
                      onChange={(e) => {
                        const val = e.target.value;
                        setColumnMapping((prev) => ({
                          ...prev,
                          [sysField.key]: val,
                        }));
                      }}
                      className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-xs sm:text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
            <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {t.upload.prevStep}
              </button>

              <button
                type="button"
                disabled={missingRequiredFields.length > 0}
                onClick={() => setStep(3)}
                className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-sm transition-all"
              >
                {t.upload.nextPreview}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Automated Cleansing & Live Preview */}
        {activeTab === "upload" && step === 3 && (
          <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
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

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 text-xs text-slate-700 hover:bg-slate-100 font-semibold transition-colors flex items-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  {t.upload.prevStep}
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={handleSubmitBatch}
                  className="min-h-[44px] inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md transition-all"
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
            <div className="w-full overflow-x-auto border border-slate-200 rounded-xl shadow-2xs">
              <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200 whitespace-nowrap">
                  <tr>
                    <th className="py-2.5 px-3">{t.upload.colRow}</th>
                    <th className="py-2.5 px-3">{t.upload.colName}</th>
                    <th className="py-2.5 px-3">{t.upload.colGuardian}</th>
                    <th className="py-2.5 px-3">{t.upload.colGender}</th>
                    <th className="py-2.5 px-3">{t.upload.colNid}</th>
                    <th className="py-2.5 px-3">{t.upload.colBrn}</th>
                    <th className="py-2.5 px-3">{t.upload.colDistrictUpazila || "জেলা ও উপজেলা"}</th>
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
                        <span className="font-medium text-slate-800">{row.upazilaName || selectedUpazila}</span>
                        <span className="text-[10px] text-slate-400 block">{row.district || selectedDistrict}</span>
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
        {activeTab === "upload" && step === 4 && uploadResult && (
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

        {/* STAGING BUFFER TAB VIEW */}
        {activeTab === "staging" && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-800 mb-1.5">
                  <Database className="w-3.5 h-3.5 text-blue-600" />
                  <span>{language === "bn" ? "অস্থায়ী ডাটা স্টেজিং টেবিল বাফার" : "Temporary Staging Buffer"}</span>
                </div>
                <h2 className="text-xl font-bold text-slate-900">
                  {language === "bn" ? "সংরক্ষিত স্টেজিং ব্যাচ ও ড্রাফট তালিকা" : "Staged Batches & Raw Ingestion Buffer"}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === "bn"
                    ? "বিভিন্ন দপ্তরের আপলোডকৃত কাঁচা ডাটা এখানে নিরাপদে জমা থাকে। আপনি যেকোনো সময় ডাটা প্রিভিউ, কলাম ম্যাপিং পরিবর্তন বা মূল সিস্টেমে ডুপ্লিকেট যাচাইসহ ইমপোর্ট করতে পারবেন।"
                    : "Raw datasets from various department MIS exports are buffered here safely. Load any batch to map columns and ingest with deduplication checks."}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={fetchStagedBatches}
                  disabled={loadingStaged}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${loadingStaged ? "animate-spin" : ""}`} />
                  <span>{language === "bn" ? "রিফ্রেশ" : "Refresh"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("upload");
                    setStep(1);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>{language === "bn" ? "নতুন ফাইল আপলোড করুন" : "Upload New File"}</span>
                </button>
              </div>
            </div>

            {loadingStaged ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500 space-y-2">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <span className="text-xs">{language === "bn" ? "স্টেজিং ডাটা লোড হচ্ছে..." : "Loading staged batches..."}</span>
              </div>
            ) : stagedBatches.length === 0 ? (
              <div className="py-12 text-center border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50 p-8">
                <Database className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                <h3 className="text-sm font-bold text-slate-700 mb-1">
                  {language === "bn" ? "বর্তমানে কোনো অস্থায়ী স্টেজিং ডাটা নেই" : "No Staged Batches Found"}
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                  {language === "bn"
                    ? "যেকোনো দপ্তরের (সমাজসেবা, মহিলা বিষয়ক, খাদ্য, ত্রাণ ইত্যাদি) এক্সেল বা সিএসভি ফাইল আপলোড করে স্টেপ-২ এ 'অস্থায়ী স্টেজিংয়ে সংরক্ষণ' বাটনে ক্লিক করলে তা এখানে জমা থাকবে।"
                    : "Upload any roster file from Step 1 and click 'Save to Staging' in Step 2 to buffer it here before committing."}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab("upload");
                    setStep(1);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-800 text-white text-xs font-bold hover:bg-emerald-900 shadow-sm cursor-pointer"
                >
                  <UploadCloud className="w-4 h-4" />
                  <span>{language === "bn" ? "এখনই ফাইল আপলোড করুন" : "Upload A File Now"}</span>
                </button>
              </div>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 uppercase font-bold border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">{language === "bn" ? "ফাইল ও স্টেজিং আইডি" : "File & Stage ID"}</th>
                      <th className="py-3 px-4">{language === "bn" ? "দপ্তর ও কর্মসূচি" : "Dept & Scheme"}</th>
                      <th className="py-3 px-4">{language === "bn" ? "এলাকা" : "Location"}</th>
                      <th className="py-3 px-4 text-center">{language === "bn" ? "মোট সারি" : "Total Rows"}</th>
                      <th className="py-3 px-4">{language === "bn" ? "আপলোডের সময়" : "Uploaded At"}</th>
                      <th className="py-3 px-4 text-center">{language === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                      <th className="py-3 px-4 text-right">{language === "bn" ? "অ্যাকশন" : "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {stagedBatches.map((batch) => (
                      <tr key={batch.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 flex items-center gap-1.5">
                            <FileSpreadsheet className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span>{batch.fileName}</span>
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{batch.id}</div>
                        </td>
                        <td className="py-3 px-4">
                          <div className="text-slate-900 font-semibold">{batch.departmentName || "দপ্তর"}</div>
                          <div className="text-[11px] text-emerald-800">{batch.schemeName || "কর্মসূচি"}</div>
                        </td>
                        <td className="py-3 px-4 text-slate-600">
                          {batch.upazilaName || "সদর"}, {batch.district || "নেত্রকোণা"}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-slate-900">
                          {formatNumber(batch.rowCount || 0, language)}
                        </td>
                        <td className="py-3 px-4 text-slate-500 text-[11px]">
                          {new Date(batch.stagedAt).toLocaleString("bn-BD")}
                        </td>
                        <td className="py-3 px-4 text-center">
                          {batch.status === "COMMITTED" ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              {language === "bn" ? "ইমপোর্ট সম্পন্ন" : "COMMITTED"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              {language === "bn" ? "অস্থায়ী স্টেজিং" : "STAGED"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => handleLoadStagedBatch(batch)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold transition-all shadow-xs cursor-pointer"
                              title={language === "bn" ? "উইজার্ডে লোড করে কলাম ম্যাপিং ও ইমপোর্ট করুন" : "Load into wizard to map & ingest"}
                            >
                              <Play className="w-3 h-3" />
                              <span>{language === "bn" ? "ম্যাপিং ও ইমপোর্ট" : "Load & Ingest"}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteStagedBatch(batch.id)}
                              className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors cursor-pointer"
                              title={language === "bn" ? "মুছে ফেলুন" : "Delete"}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
