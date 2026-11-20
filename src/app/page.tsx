"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  UploadCloud,
  ShieldAlert,
  Users,
  Layers,
  Building2,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Database,
  Sparkles,
  Loader2,
  RefreshCw,
  MapPin,
  Search,
  Filter,
  FileSpreadsheet,
  Printer,
  Ban,
  UserCheck,
  CreditCard,
  Phone,
  Check,
  ExternalLink,
  History,
  HeartHandshake,
  DollarSign,
  Info,
  Clock,
  Send,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";

import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatDepartmentName, formatSchemeName } from "@/lib/translations";
import { ROLE_CONFIG } from "@/lib/auth";
import { NETROKONA_UPAZILAS, NETROKONA_DISTRICT } from "@/lib/netrokona";

interface SchemeItem {
  enrollmentId: string;
  schemeId: string;
  schemeName: string;
  schemeNameBn?: string | null;
  schemeNameEn?: string | null;
  departmentId: string;
  departmentName: string;
  departmentNameBn?: string | null;
  departmentNameEn?: string | null;
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
  cardNumber?: string | null;
  startDate: string;
  status: string;
}

interface DuplicateBeneficiary {
  identityKey: string;
  beneficiaryId: string;
  fullName: string;
  guardianName: string;
  gender: string;
  nid?: string | null;
  brn?: string | null;
  mobile?: string | null;
  district?: string | null;
  upazilaName?: string | null;
  unionName: string;
  wardNo: string;
  activeEnrollmentCount: number;
  primaryScheme: SchemeItem;
  excessSchemes: SchemeItem[];
  excessMonthlyAmount: number;
  excessYearlyAmount: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  isCrossDepartment: boolean;
  overlappingDepartments?: string[];
  conflictingDepartmentNames?: string;
}

interface RedundancyApiResponse {
  success: boolean;
  summary: {
    totalDuplicateBeneficiaries: number;
    totalRedundantEnrollments: number;
    totalMonthlyLeakAmount: number;
    totalYearlyLeakAmount: number;
  };
  filters: {
    unions: string[];
    wards: string[];
  };
  duplicates: DuplicateBeneficiary[];
  breakdownByDepartment: Array<{
    departmentName: string;
    excessAmount: number;
    duplicateCount: number;
  }>;
  breakdownByUnion: Array<{
    unionName: string;
    duplicateCount: number;
    excessMonthlyAmount: number;
  }>;
  breakdownByUnionWard: Array<{
    unionName: string;
    wardNo: string;
    label: string;
    duplicateCount: number;
    excessMonthlyAmount: number;
  }>;
  breakdownByScheme: Array<{
    schemeName: string;
    departmentName: string;
    redundantCount: number;
    excessAmount: number;
  }>;
}

interface DashboardStats {
  district?: { nameBn: string; nameEn: string };
  selectedUpazila?: string | null;
  summary: {
    totalBeneficiaries: number;
    totalEnrollments: number;
    activeEnrollments: number;
    flaggedEnrollments: number;
    suspendedEnrollments: number;
    totalDepartments: number;
    totalSchemes: number;
  };
  upazilaStats?: Array<{
    upazilaName: string;
    total: number;
    active: number;
    flagged: number;
    suspended: number;
  }>;
}

export default function ExecutiveDashboard() {
  const { currentUser, permissions, isSuperAdmin, isUpazilaAdmin, isDeptOfficer, isUnionViewer } = useAuth();
  const {
    language,
    t,
    formatNumber,
    formatCurrency,
    getDepartmentName,
    getSchemeName,
    getCommodityName,
    getCommodityUnit,
  } = useLanguage();
  const [isMounted, setIsMounted] = useState(false);
  const [currentDate, setCurrentDate] = useState("");
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [redundancyData, setRedundancyData] = useState<RedundancyApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [seedingDemo, setSeedingDemo] = useState(false);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Department Officer Suspension Request Modal State
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);
  const [targetForRequest, setTargetForRequest] = useState<{
    enrollmentId: string;
    beneficiaryName: string;
    schemeName: string;
    departmentName: string;
    monthlyAmount: number;
    beneficiaryRecord?: DuplicateBeneficiary;
  } | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  // Table & Upazila Filters
  const [search, setSearch] = useState("");
  const [selectedUpazila, setSelectedUpazila] = useState<string>(currentUser.upazilaName || "");
  const [selectedUnion, setSelectedUnion] = useState("");
  const [selectedDept, setSelectedDept] = useState("");
  const [selectedRisk, setSelectedRisk] = useState("ALL");

  useEffect(() => {
    if (currentUser.upazilaName) {
      setSelectedUpazila(currentUser.upazilaName);
    }
  }, [currentUser.upazilaName]);

  useEffect(() => {
    setIsMounted(true);
    setCurrentDate(new Date().toLocaleDateString("bn-BD"));
  }, []);

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const upzParam = selectedUpazila && selectedUpazila !== "ALL" && selectedUpazila !== "সমগ্র জেলা"
        ? `?upazila=${encodeURIComponent(selectedUpazila)}`
        : "";

      const [statsRes, redundancyRes] = await Promise.all([
        fetch(`/api/dashboard/stats${upzParam}`),
        fetch(`/api/redundancy${upzParam}`),
      ]);

      const statsJson = await statsRes.json();
      const redundancyJson = await redundancyRes.json();

      if (statsJson.success) setStats(statsJson);
      if (redundancyJson.success) setRedundancyData(redundancyJson);
    } catch (err) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedUpazila]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // Handle Seed Demo Data
  const handleSeedDemoData = async () => {
    try {
      setSeedingDemo(true);
      const res = await fetch("/api/demo-seed", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        await loadAllData();
        setActionSuccessMessage(
          `সফলভাবে ডেমো ডাটা লোড হয়েছে: ${data.createdBeneficiaries} জন সুবিধাভোগী ও ${data.createdEnrollments}টি অন্তর্ভুক্তি তৈরি হয়েছে।`
        );
        setTimeout(() => setActionSuccessMessage(null), 5000);
      }
    } catch (err) {
      console.error(err);
      alert("Error generating sample data");
    } finally {
      setSeedingDemo(false);
    }
  };

  // Action: Mark Verified Duplicate
  const handleMarkVerified = async (beneficiaryId: string, fullName: string) => {
    try {
      setActionLoadingId(beneficiaryId);
      const res = await fetch("/api/redundancy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId,
          action: "verify_duplicate",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMessage(
          `যাচাইকৃত ডুপ্লিকেট হিসেবে চিহ্নিত: ${fullName} এর অতিরিক্ত ভাতার ফাইল ফ্ল্যাগ করা হয়েছে।`
        );
        setTimeout(() => setActionSuccessMessage(null), 5000);
        await loadAllData();
      } else {
        alert(data.error || "Action failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error marking duplicate");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Action: Suspend Extra Scheme
  const handleSuspendExtra = async (beneficiaryId: string, fullName: string) => {
    if (
      !confirm(
        `আপনি কি নিশ্চিত যে ${fullName} এর অতিরিক্ত (অযৌক্তিক) ভাতার অন্তর্ভুক্তি স্থগিত করতে চান?`
      )
    ) {
      return;
    }

    try {
      setActionLoadingId(beneficiaryId);
      const res = await fetch("/api/redundancy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId,
          action: "suspend_extra",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setActionSuccessMessage(
          `সফলভাবে অতিরিক্ত ভাতা স্থগিত করা হয়েছে: ${fullName} এর অতিরিক্ত ভাতার অর্থ অপচয় বন্ধ করা হয়েছে।`
        );
        setTimeout(() => setActionSuccessMessage(null), 5000);
        await loadAllData();
      } else {
        alert(data.error || "Action failed");
      }
    } catch (err) {
      console.error(err);
      alert("Error suspending extra scheme");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Department Officer Submit Suspension Request
  const handleOpenSuspensionRequest = (
    enrollmentId: string,
    beneficiaryName: string,
    schemeName: string,
    departmentName: string,
    monthlyAmount: number,
    beneficiaryRecord?: DuplicateBeneficiary
  ) => {
    setTargetForRequest({
      enrollmentId,
      beneficiaryName,
      schemeName,
      departmentName,
      monthlyAmount,
      beneficiaryRecord,
    });
    setSuspensionReason(
      language === "bn"
        ? `দপ্তর নিরীক্ষায় দেখা গেছে নাগরিক একই সাথে দ্বৈত সুবিধা গ্রহণ করছেন বিধায় ${formatSchemeName(schemeName, "bn")} স্থগিতের সুপারিশ করা হলো।`
        : `Audit reveals beneficiary is receiving dual benefits; recommending suspension of ${formatSchemeName(schemeName, "en")}.`
    );
    setShowSuspensionModal(true);
  };

  const handleSubmitSuspensionRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetForRequest || !suspensionReason.trim()) return;

    try {
      setSubmittingRequest(true);
      const res = await fetch("/api/removal-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enrollmentId: targetForRequest.enrollmentId,
          requestedByUserId: currentUser.id,
          requestReason: suspensionReason.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowSuspensionModal(false);
        setActionSuccessMessage(
          language === "bn"
            ? "ভাতা বাদ দেওয়ার আবেদন সফলভাবে জমা হয়েছে। উপজেলা নির্বাহী কর্মকর্তা (ইউএনও) এটি অনুমোদন করবেন।"
            : "Removal request submitted successfully. Upazila Admin (UNO) will review and approve."
        );
        setTimeout(() => setActionSuccessMessage(null), 5000);
      } else {
        alert(data.error || "Failed to submit request");
      }
    } catch (err) {
      console.error(err);
      alert("Error submitting request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Filter duplicates for table & metrics based on Role
  const roleScopedDuplicates = useMemo(() => {
    if (!redundancyData?.duplicates) return [];
    let list = redundancyData.duplicates;

    // Role-based scoping
    if (isDeptOfficer && currentUser.departmentName) {
      // Scoped: only show duplicates that involve this officer's department
      list = list.filter(
        (item) =>
          item.primaryScheme.departmentName === currentUser.departmentName ||
          item.excessSchemes.some(
            (s) => s.departmentName === currentUser.departmentName
          )
      );
    } else if (isUnionViewer && currentUser.unionName) {
      // Scoped: only show duplicates in this union
      list = list.filter((item) =>
        item.unionName.toLowerCase().includes(currentUser.unionName!.toLowerCase().split(" ")[0])
      );
    }

    return list;
  }, [redundancyData, isDeptOfficer, isUnionViewer, currentUser]);

  const filteredDuplicates = useMemo(() => {
    return roleScopedDuplicates.filter((item) => {
      // Search
      if (search) {
        const q = search.toLowerCase();
        const matches =
          item.fullName.toLowerCase().includes(q) ||
          item.guardianName.toLowerCase().includes(q) ||
          (item.nid && item.nid.includes(q)) ||
          (item.brn && item.brn.includes(q)) ||
          (item.mobile && item.mobile.includes(q)) ||
          item.unionName.toLowerCase().includes(q);
        if (!matches) return false;
      }
      // Union Filter
      if (selectedUnion && item.unionName !== selectedUnion) {
        return false;
      }
      // Dept Filter
      if (selectedDept) {
        const hasDept =
          item.primaryScheme.departmentName === selectedDept ||
          item.excessSchemes.some((s) => s.departmentName === selectedDept);
        if (!hasDept) return false;
      }
      // Risk Filter
      if (selectedRisk !== "ALL" && item.riskLevel !== selectedRisk) {
        return false;
      }
      return true;
    });
  }, [roleScopedDuplicates, search, selectedUnion, selectedDept, selectedRisk]);

  // Export to Excel
  const handleExportExcel = () => {
    if (!filteredDuplicates || filteredDuplicates.length === 0) {
      alert("রপ্তানির জন্য কোনো ডুপ্লিকেট রেকর্ড পাওয়া যায়নি।");
      return;
    }

    const rows = filteredDuplicates.map((dup, idx) => {
      const totalReceived =
        dup.primaryScheme.monthlyAmount + dup.excessMonthlyAmount;
      const allSchemes = [
        `${getSchemeName(dup.primaryScheme, language)} (${language === "bn" ? "মূল" : "Primary"} - ${formatCurrency(dup.primaryScheme.monthlyAmount, language)})`,
        ...dup.excessSchemes.map(
          (s) => `${getSchemeName(s, language)} (${language === "bn" ? "অতিরিক্ত" : "Excess"} - ${formatCurrency(s.monthlyAmount, language)})`
        ),
      ].join("; ");

      return {
        "ক্রমিক (SL)": idx + 1,
        "সুবিধাভোগীর নাম (Name)": dup.fullName,
        "অভিভাবক (Guardian)": dup.guardianName,
        "লিঙ্গ (Gender)": dup.gender,
        "জাতীয় পরিচয়পত্র (NID)": dup.nid || "N/A",
        "জন্ম নিবন্ধন (BRN)": dup.brn || "N/A",
        "মোবাইল (Mobile)": dup.mobile || "N/A",
        "ইউনিয়ন (Union)": dup.unionName,
        "ওয়ার্ড (Ward)": dup.wardNo,
        "সক্রিয় কর্মসূচিসমূহ (Active Schemes)": allSchemes,
        "মোট মাসিক প্রাপ্ত অর্থ (Total Received ৳)": totalReceived,
        "অনুমোদিত মূল ভাতা (Primary Allowed ৳)": dup.primaryScheme.monthlyAmount,
        "অতিরিক্ত উত্তোলিত অর্থ (Excess Monthly Leak ৳)": dup.excessMonthlyAmount,
        "বার্ষিক অতিরিক্ত অপচয় (Excess Yearly Leak ৳)": dup.excessYearlyAmount,
        "ঝুঁকির মাত্রা (Risk)": dup.riskLevel,
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Deduplication_Audit_Report"
    );

    // Styling column widths
    worksheet["!cols"] = [
      { wch: 8 },
      { wch: 28 },
      { wch: 22 },
      { wch: 10 },
      { wch: 20 },
      { wch: 20 },
      { wch: 14 },
      { wch: 20 },
      { wch: 10 },
      { wch: 45 },
      { wch: 18 },
      { wch: 18 },
      { wch: 20 },
      { wch: 20 },
      { wch: 12 },
    ];

    XLSX.writeFile(
      workbook,
      `SSNP_Deduplication_Audit_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  // Export to PDF / Print Report
  const handlePrintPdf = () => {
    window.print();
  };

  // Standard Base Allowance in Bangladesh (Old Age / Widow is ~৳600/mo)
  const baseMonthlyRate = 600;
  const displayedMonthlyLeak = isSuperAdmin
    ? redundancyData?.summary.totalMonthlyLeakAmount || 0
    : roleScopedDuplicates.reduce((sum, d) => sum + d.excessMonthlyAmount, 0);

  const displayedDuplicateCount = isSuperAdmin
    ? redundancyData?.summary.totalDuplicateBeneficiaries || 0
    : roleScopedDuplicates.length;

  const displayedRedundantCases = isSuperAdmin
    ? redundancyData?.summary.totalRedundantEnrollments || 0
    : roleScopedDuplicates.reduce((sum, d) => sum + d.excessSchemes.length, 0);

  const potentialNewBeneficiaries = Math.floor(displayedMonthlyLeak / baseMonthlyRate);

  const chartColors = [
    "#ef4444",
    "#059669",
    "#3b82f6",
    "#f59e0b",
    "#8b5cf6",
    "#ec4899",
  ];

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-3 sm:px-6 lg:px-8 print:p-0 print:bg-white w-full max-w-full min-w-0 overflow-x-clip">
      <div className="max-w-7xl mx-auto space-y-6 w-full min-w-0">
        {/* Printable Official Government Header (Only visible during print) */}
        <div className="hidden print:block text-center border-b-2 border-slate-900 pb-4 mb-6">
          <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
            {t.common.govtTopBar}
          </h1>
          <h2 className="text-base font-semibold text-slate-800 mt-1">
            {language === "bn"
              ? "উপজেলা সামাজিক নিরাপত্তা কর্মসূচি (SSNP) দ্বৈত ভাতা নিরোধ ও অপচয় নিরীক্ষা প্রতিবেদন"
              : "Upazila Social Safety Net Program (SSNP) Deduplication & Leakage Audit Report"}
          </h2>
          <div className="text-xs text-slate-600 mt-1">
            {language === "bn" ? `তারিখ: ${currentDate || "—"}` : `Date: ${currentDate || "—"}`}
          </div>
        </div>

        {/* Top Header Card (Screen Only) */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-6 sm:p-8 text-white shadow-lg border border-slate-700/50 print:hidden">
          {/* Subtle Ambient Glow */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>
          <div className="absolute bottom-0 left-1/3 w-64 h-64 bg-teal-500/10 rounded-full blur-2xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div className="space-y-2.5 max-w-3xl">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-xs font-semibold text-emerald-300 backdrop-blur-md">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>{t.dashboard.badge}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white">
                {t.dashboard.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed font-normal">
                {t.dashboard.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              <Link
                href="/upload"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-900/30 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <UploadCloud className="w-4 h-4" />
                {t.nav.upload}
              </Link>

              <Link
                href="/admin/audit-logs"
                className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-bold transition-all backdrop-blur-md hover:scale-[1.02] active:scale-[0.98]"
              >
                <History className="w-4 h-4 text-emerald-300" />
                {language === "bn" ? "ব্যাচ ও অডিট হিস্ট্রি" : "Batch History & Logs"}
              </Link>

              {/* Sample Data Loader (Discrete / Secondary for Super Admin) */}
              {isSuperAdmin && (
                <button
                  onClick={handleSeedDemoData}
                  disabled={seedingDemo}
                  title={language === "bn" ? "নমুনা ডাটা লোড করুন (পরীক্ষামূলক)" : "Load Sample Data (Testing)"}
                  className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/90 text-slate-300 hover:text-white text-xs font-medium border border-slate-600/50 transition-all backdrop-blur-xs"
                >
                  {seedingDemo ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  ) : (
                    <Database className="w-3.5 h-3.5 text-emerald-400" />
                  )}
                  <span className="hidden sm:inline">{language === "bn" ? "নমুনা ডাটা" : "Sample Data"}</span>
                </button>
              )}

              <button
                onClick={loadAllData}
                disabled={loading}
                className="p-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all backdrop-blur-md"
                title={language === "bn" ? "ড্যাশবোর্ড রিফ্রেশ করুন" : "Refresh Dashboard"}
              >
                <RefreshCw
                  className={`w-4 h-4 ${loading ? "animate-spin text-emerald-400" : ""}`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* District & Upazila Jurisdiction Selector Bar */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:shadow-sm">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-50 to-emerald-100/80 border border-emerald-200 flex items-center justify-center text-emerald-800 font-bold shrink-0 shadow-xs">
              <MapPin className="w-5 h-5 text-emerald-700" />
            </div>
            <div>
              <div className="text-xs sm:text-sm font-bold text-slate-900 flex flex-wrap items-center gap-2">
                <span>{language === "bn" ? "নেত্রকোণা জেলা প্রশাসন" : "District Administration, Netrokona"}</span>
                {currentUser.upazilaName ? (
                  <span className="text-[11px] bg-amber-50 text-amber-900 border border-amber-300/80 px-2.5 py-0.5 rounded-full font-bold shadow-2xs">
                    {language === "bn" ? `${currentUser.upazilaName} উপজেলা` : `${currentUser.upazilaName} Upazila`}
                  </span>
                ) : (
                  <span className="text-[11px] bg-emerald-50 text-emerald-900 border border-emerald-300/80 px-2.5 py-0.5 rounded-full font-bold shadow-2xs">
                    {language === "bn" ? "সমগ্র নেত্রকোণা জেলা মনিটরিং" : "District Wide Monitoring"}
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                {currentUser.upazilaName
                  ? (language === "bn" ? `অধিক্ষেত্র: শুধুমাত্র ${currentUser.upazilaName} উপজেলার ডাটা ও দ্বৈত ভাতা নিরীক্ষা সক্রিয়` : `Scoped strictly to ${currentUser.upazilaName} Upazila`)
                  : (language === "bn" ? "সকল ১০টি উপজেলার সামগ্রিক পরিসংখ্যান পর্যবেক্ষণ করুন অথবা নির্দিষ্ট উপজেলা নির্বাচন করুন" : "View aggregated data across all 10 Upazilas or select a specific Upazila")}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full md:w-auto">
            <label className="text-xs font-bold text-slate-600 whitespace-nowrap hidden sm:inline">
              {language === "bn" ? "উপজেলা ফিল্টার:" : "Filter Upazila:"}
            </label>
            <select
              value={selectedUpazila}
              onChange={(e) => setSelectedUpazila(e.target.value)}
              disabled={Boolean(currentUser.upazilaName)}
              className={`w-full md:w-64 px-3.5 py-2.5 rounded-xl border text-xs font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                currentUser.upazilaName
                  ? "bg-slate-100 border-slate-200 text-slate-600 cursor-not-allowed"
                  : "bg-slate-50/60 hover:bg-white border-slate-200 text-slate-900 shadow-2xs focus:bg-white"
              }`}
            >
              <option value="">{language === "bn" ? "সমগ্র নেত্রকোণা জেলা (সকল ১০টি উপজেলা)" : "All 10 Upazilas (Whole District)"}</option>
              {NETROKONA_UPAZILAS.map((upz) => (
                <option key={upz.key} value={upz.nameBn}>
                  {upz.nameBn} ({upz.nameEn})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Global Toast Success Message */}
        {actionSuccessMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2.5 text-xs sm:text-sm font-semibold">
              <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button
              onClick={() => setActionSuccessMessage(null)}
              className="text-xs text-emerald-700 font-bold hover:text-emerald-900 px-2 py-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* TOP SUMMARY KPI CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Beneficiaries */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-md hover:border-emerald-300 transition-all duration-300 relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  {t.dashboard.kpiTotalBeneficiaries}
                </span>
                <span className="text-[11px] text-slate-400 block mt-0.5">
                  {t.dashboard.kpiTotalSub}
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-700 flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shadow-2xs">
                <Users className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
                {formatNumber(stats?.summary.totalBeneficiaries || 0)}
                <span className="text-sm font-medium text-slate-500 ml-1.5">
                  {language === "bn" ? "জন" : "recipients"}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-2.5 text-xs text-slate-600 font-medium">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>
                  {language === "bn" ? "সক্রিয় বিতরণ: " : "Active Disbursements: "}
                  <strong className="text-slate-800">{formatNumber(stats?.summary.activeEnrollments || 0)}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Duplicate Beneficiaries Found */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-red-200/80 shadow-xs hover:shadow-md hover:border-red-300 transition-all duration-300 relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-red-600 uppercase tracking-wider block">
                  {t.dashboard.kpiDuplicatesFound}
                </span>
                <span className="text-[11px] text-red-400 block mt-0.5">
                  {t.dashboard.kpiDuplicatesSub}
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-red-50 border border-red-100 text-red-600 flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shadow-2xs">
                <ShieldAlert className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4">
              <div className="text-3xl sm:text-4xl font-extrabold text-red-600 tracking-tight">
                {formatNumber(displayedDuplicateCount)}
                <span className="text-sm font-medium text-red-800/70 ml-1.5">
                  {language === "bn" ? "জন চিহ্নিত" : "identified"}
                </span>
              </div>
              <div className="flex items-center gap-1.5 mt-2.5 text-xs text-red-700 font-semibold">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                <span>
                  {language === "bn"
                    ? `${formatNumber(displayedRedundantCases)}টি অতিরিক্ত ভাতার কেস`
                    : `${formatNumber(displayedRedundantCases)} redundant cases`}
                </span>
              </div>
            </div>
          </div>

          {/* Card 3: Monthly Financial Leakage */}
          <div className="bg-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-amber-200/80 shadow-xs hover:shadow-md hover:border-amber-300 transition-all duration-300 relative overflow-hidden group">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[11px] font-bold text-amber-700 uppercase tracking-wider block">
                  {t.dashboard.kpiMonthlyLeak}
                </span>
                <span className="text-[11px] text-amber-500 block mt-0.5">
                  {t.dashboard.kpiMonthlyLeakSub}
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-100 text-amber-700 flex items-center justify-center group-hover:scale-105 transition-transform duration-300 font-black text-lg shadow-2xs">
                ৳
              </div>
            </div>

            <div className="mt-4">
              <div className="text-3xl sm:text-4xl font-extrabold text-amber-900 tracking-tight">
                {formatCurrency(displayedMonthlyLeak)}
                <span className="text-xs font-semibold text-amber-700 ml-1">
                  {t.common.perMonth}
                </span>
              </div>
              <div className="mt-2.5 text-xs text-amber-800 font-semibold flex items-center gap-1">
                <TrendingUp className="w-3.5 h-3.5 text-amber-600" />
                <span>
                  {language === "bn"
                    ? `বার্ষিক অপচয়: ${formatCurrency(displayedMonthlyLeak * 12)}`
                    : `Annual Leakage: ${formatCurrency(displayedMonthlyLeak * 12)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Card 4: Potential New Beneficiaries Covered */}
          <div className="bg-gradient-to-br from-emerald-800 via-teal-900 to-slate-900 text-white p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-400/10 rounded-full blur-2xl pointer-events-none"></div>
            <div className="flex items-start justify-between relative z-10">
              <div>
                <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-wider block">
                  {t.dashboard.kpiPotentialCovered}
                </span>
                <span className="text-[11px] text-emerald-300/80 block mt-0.5">
                  {t.dashboard.kpiPotentialCoveredSub}
                </span>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-white/10 text-emerald-200 flex items-center justify-center group-hover:scale-105 transition-transform duration-300 backdrop-blur-xs border border-white/10">
                <HeartHandshake className="w-5 h-5" />
              </div>
            </div>

            <div className="mt-4 relative z-10">
              <div className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                ~{formatNumber(potentialNewBeneficiaries)}
                <span className="text-sm font-semibold text-emerald-200 ml-1.5">
                  {language === "bn" ? "জন নতুন নাগরিক" : "new citizens"}
                </span>
              </div>
              <div className="mt-2.5 text-xs text-emerald-200/90 leading-snug font-normal">
                {language === "bn"
                  ? "মাসিক ৬০০ টাকা হারে প্রকৃত দুস্থদের মাঝে পুনঃবন্টন সম্ভব।"
                  : "Reallocable to eligible poor citizens at BDT 600 monthly rate."}
              </div>
            </div>
          </div>
        </div>

        {/* Netrokona 10 Upazilas Overview Grid */}
        {stats?.upazilaStats && stats.upazilaStats.length > 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-xs border border-slate-200/90 print:hidden space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    {language === "bn" ? "নেত্রকোণা জেলার ১০টি উপজেলার চিত্র" : "Netrokona District 10 Upazilas Overview"}
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    {language === "bn" ? "উপজেলায় ক্লিক করে নির্দিষ্ট এলাকার ড্যাশবোর্ড ও ডুপ্লিকেট তালিকা ফিল্টার করুন" : "Click an Upazila tile to filter dashboard and duplicate listings"}
                  </p>
                </div>
              </div>
              <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50/80 px-2.5 py-1 rounded-full border border-emerald-200/70 self-start sm:self-auto">
                {language === "bn" ? "১০টি প্রশাসনিক উপজেলা" : "10 Administrative Upazilas"}
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 w-full min-w-0">
              {stats.upazilaStats.map((upz) => {
                const isSelected = selectedUpazila === upz.upazilaName;
                const hasDuplicates = upz.flagged > 0;

                return (
                  <button
                    key={upz.upazilaName}
                    type="button"
                    disabled={Boolean(currentUser.upazilaName)}
                    onClick={() => setSelectedUpazila(isSelected ? "" : upz.upazilaName)}
                    className={`p-3.5 rounded-2xl border text-left transition-all duration-200 relative overflow-hidden group ${
                      isSelected
                        ? "bg-emerald-50/90 border-emerald-500 shadow-xs ring-2 ring-emerald-500/20"
                        : "bg-slate-50/60 hover:bg-slate-100/80 border-slate-200/80 hover:border-slate-300 hover:shadow-2xs"
                    } ${currentUser.upazilaName && !isSelected ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <div className="text-xs font-bold text-slate-900 truncate flex items-center justify-between">
                      <span className="group-hover:text-emerald-800 transition-colors">{upz.upazilaName}</span>
                      {isSelected ? (
                        <span className="w-2 h-2 rounded-full bg-emerald-600"></span>
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-300 group-hover:bg-emerald-400 transition-colors"></span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-2.5 text-[11px]">
                      <span className="text-slate-500">{language === "bn" ? "নাগরিক:" : "Citizens:"}</span>
                      <span className="font-bold text-slate-800">{formatNumber(upz.total)}</span>
                    </div>
                    <div className="flex items-center justify-between text-[11px] mt-1">
                      <span className={hasDuplicates ? "text-red-600 font-semibold" : "text-slate-500 font-medium"}>
                        {language === "bn" ? "ডুপ্লিকেট:" : "Duplicates:"}
                      </span>
                      <span
                        className={`font-bold px-1.5 py-0.2 rounded-md ${
                          hasDuplicates
                            ? "bg-red-100 text-red-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {formatNumber(upz.flagged)}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* CHARTS ROW (RECHARTS) */}
        {isMounted && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 print:hidden w-full min-w-0">
            {/* Chart 1: Union & Ward-wise Duplicate Distribution */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-sm transition-shadow min-w-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-emerald-700" />
                    {t.dashboard.chartUnionTitle}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === "bn"
                      ? "ইউনিয়ন ও ওয়ার্ডভিত্তিক শনাক্তকৃত ডুপ্লিকেট সুবিধাভোগী"
                      : "Identified duplicate beneficiaries across unions and wards"}
                  </p>
                </div>
                <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-800 px-2.5 py-1 rounded-full border border-emerald-200/80 shrink-0 self-start sm:self-auto">
                  {language === "bn" ? "ইউনিয়ন ও ওয়ার্ড" : "By Union & Ward"}
                </span>
              </div>

              <div className="h-72 w-full min-w-0 overflow-hidden">
                {redundancyData?.breakdownByUnionWard &&
                redundancyData.breakdownByUnionWard.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={redundancyData.breakdownByUnionWard.slice(0, 7)}
                      margin={{ top: 15, right: 15, left: -15, bottom: 25 }}
                    >
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        interval={0}
                        angle={-15}
                        textAnchor="end"
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                      <Tooltip
                        formatter={(val: any) => [
                          `${formatNumber(Number(val ?? 0))} ${language === "bn" ? "জন" : "recipients"}`,
                          language === "bn" ? "ডুপ্লিকেট সুবিধাভোগী" : "Duplicate Beneficiaries",
                        ]}
                        labelFormatter={(lbl) => `${language === "bn" ? "এলাকা" : "Area"}: ${lbl}`}
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          color: "#fff",
                          borderRadius: "14px",
                          fontSize: "12px",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
                        }}
                      />
                      <Bar
                        dataKey="duplicateCount"
                        name={language === "bn" ? "ডুপ্লিকেট সংখ্যা" : "Duplicate Count"}
                        fill="#ef4444"
                        radius={[8, 8, 0, 0]}
                      >
                        {redundancyData.breakdownByUnionWard.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              index === 0
                                ? "#dc2626"
                                : index % 2 === 0
                                ? "#f97316"
                                : "#ef4444"
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400">
                    <MapPin className="w-8 h-8 text-slate-300 mb-1" />
                    <span>{language === "bn" ? "কোনো ইউনিয়ন ডুপ্লিকেট ডাটা পাওয়া যায়নি।" : "No duplicate union data found."}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Chart 2: Department-wise Overlap Breakdown */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-sm transition-shadow min-w-0 overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-emerald-700" />
                    {t.dashboard.chartDeptTitle}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === "bn"
                      ? "মন্ত্রণালয় ও অধিদপ্তরভিত্তিক অতিরিক্ত আর্থিক অপচয়"
                      : "Redundant financial leakage by line ministry & department"}
                  </p>
                </div>
                <span className="text-[11px] font-semibold bg-blue-50 text-blue-800 px-2.5 py-1 rounded-full border border-blue-200/80 shrink-0 self-start sm:self-auto">
                  {language === "bn" ? "আর্থিক অপচয় ৳" : "Financial Leakage ৳"}
                </span>
              </div>

              <div className="h-72 w-full min-w-0 overflow-hidden">
                {redundancyData?.breakdownByDepartment &&
                redundancyData.breakdownByDepartment.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={redundancyData.breakdownByDepartment}
                      margin={{ top: 15, right: 15, left: -10, bottom: 25 }}
                    >
                      <XAxis
                        dataKey="departmentName"
                        tick={{ fontSize: 10, fill: "#64748b" }}
                        interval={0}
                        tickFormatter={(val: string) => {
                          const localized = formatDepartmentName(val, language);
                          const parts = localized.split(" ");
                          return parts.slice(0, 2).join(" ");
                        }}
                      />
                      <YAxis tick={{ fontSize: 10, fill: "#64748b" }} />
                      <Tooltip
                        formatter={(val: any) => [
                          `${formatCurrency(Number(val ?? 0))} ${t.common.perMonth}`,
                          language === "bn" ? "অতিরিক্ত অপচয়" : "Redundant Leak",
                        ]}
                        labelFormatter={(lbl) => `${language === "bn" ? "দপ্তর" : "Department"}: ${formatDepartmentName(String(lbl || ""), language)}`}
                        contentStyle={{
                          backgroundColor: "#0f172a",
                          color: "#fff",
                          borderRadius: "14px",
                          fontSize: "12px",
                          boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.2)",
                        }}
                      />
                      <Bar
                        dataKey="excessAmount"
                        name={language === "bn" ? "অপচয় (৳)" : "Leakage (BDT)"}
                        fill="#059669"
                        radius={[8, 8, 0, 0]}
                      >
                        {redundancyData.breakdownByDepartment.map((_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={chartColors[index % chartColors.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-xs text-slate-400">
                    <Building2 className="w-8 h-8 text-slate-300 mb-1" />
                    <span>{language === "bn" ? "কোনো দপ্তরভিত্তিক অপচয় ডাটা পাওয়া যায়নি।" : "No department-wise leakage data found."}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* INTERACTIVE REDUNDANCY TABLE CARD */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200/90 space-y-6">
          {/* Table Header & Controls Bar */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-red-600 animate-pulse"></span>
                <h2 className="text-lg font-bold text-slate-900 tracking-tight">
                  {t.dashboard.tableTitle}
                </h2>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                {t.dashboard.tableSubtitle}
              </p>
            </div>

            {/* Export & Action Buttons */}
            <div className="flex flex-wrap items-center gap-2.5 print:hidden">
              <button
                onClick={handleExportExcel}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                title={t.dashboard.btnExportExcel}
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>{t.dashboard.btnExportExcel}</span>
              </button>

              <button
                onClick={handlePrintPdf}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-200 transition-all hover:scale-[1.02] active:scale-[0.98]"
                title={t.dashboard.btnExportPdf}
              >
                <Printer className="w-4 h-4 text-slate-600" />
                <span>{t.dashboard.btnExportPdf}</span>
              </button>
            </div>
          </div>

          {/* Search & Filter Toolbar (Screen Only) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 print:hidden">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={t.duplicatesPage.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[44px] pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-all shadow-2xs"
              />
            </div>

            {/* Union Filter */}
            <select
              value={selectedUnion}
              onChange={(e) => setSelectedUnion(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-all shadow-2xs"
            >
              <option value="">{t.common.allUnions}</option>
              {redundancyData?.filters.unions.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>

            {/* Department Filter */}
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-all shadow-2xs"
            >
              <option value="">{t.common.allDepartments}</option>
              {redundancyData?.breakdownByDepartment.map((d) => (
                <option key={d.departmentName} value={d.departmentName}>
                  {formatDepartmentName(d.departmentName, language)}
                </option>
              ))}
            </select>

            {/* Risk Severity Filter */}
            <select
              value={selectedRisk}
              onChange={(e) => setSelectedRisk(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-slate-800 bg-slate-50/50 hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600 transition-all shadow-2xs"
            >
              <option value="ALL">{language === "bn" ? "সকল ঝুঁকির মাত্রা" : "All Risk Levels"}</option>
              <option value="HIGH">{language === "bn" ? "উচ্চ ঝুঁকি (৳১,৫০০+ অপচয়)" : "High Risk (BDT 1,500+ leak)"}</option>
              <option value="MEDIUM">{language === "bn" ? "মধ্যম ঝুঁকি (৳৮০০ - ৳১,৫০০)" : "Medium Risk (BDT 800 - 1,500)"}</option>
              <option value="LOW">{language === "bn" ? "স্বল্প ঝুঁকি (৳৮০০ এর নিচে)" : "Low Risk (Under BDT 800)"}</option>
            </select>
          </div>

          {/* The Redundancy Table */}
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">
                {language === "bn"
                  ? "ডুপ্লিকেট সুবিধাভোগীদের তালিকা ও আর্থিক অপচয় হিসাব লোড হচ্ছে..."
                  : "Loading duplicate beneficiaries and calculating fiscal leakages..."}
              </p>
            </div>
          ) : filteredDuplicates.length === 0 ? (
            <div className="p-12 text-center border-2 border-dashed border-slate-200 rounded-2xl">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
              <h3 className="font-bold text-slate-800 text-base">
                {language === "bn"
                  ? "কোনো ডুপ্লিকেট সুবিধাভোগী পাওয়া যায়নি"
                  : "No Duplicate Cases Found Matching Criteria"}
              </h3>
              <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
                {language === "bn"
                  ? "বর্তমান ফিল্টারের অধীনে কোনো ডুপ্লিকেট সুবিধাভোগী নেই। নতুন ডাটা আপলোড করতে বাল্ক আপলোড পেইজে যান।"
                  : "No duplicate beneficiaries found matching current criteria. Visit Bulk Upload to ingest rosters."}
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs w-full max-w-full">
              <div className="w-full max-w-full overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                  <thead className="bg-slate-100/80 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200 whitespace-nowrap">
                  <tr>
                    <th className="py-3 px-4">{t.dashboard.colBeneficiary}</th>
                    <th className="py-3 px-4">{language === "bn" ? "জাতীয় পরিচয়পত্র / জন্ম নিবন্ধন" : "NID / BRN"}</th>
                    <th className="py-3 px-4">{language === "bn" ? "ঠিকানা (উপজেলা ও ইউনিয়ন)" : "Address (Upazila & Union)"}</th>
                    <th className="py-3 px-4">{t.dashboard.colActiveSchemes}</th>
                    <th className="py-3 px-4">{t.dashboard.colTotalReceived}</th>
                    <th className="py-3 px-4 text-red-700 bg-red-50/70">
                      {t.dashboard.colExcessAmount}
                    </th>
                    <th className="py-3 px-4 text-center print:hidden">
                      {t.dashboard.colActions}
                    </th>
                  </tr>
                </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-800 font-normal">
                    {filteredDuplicates.map((dup) => {
                      const totalReceived =
                        dup.primaryScheme.monthlyAmount + dup.excessMonthlyAmount;
                      const isProcessing = actionLoadingId === dup.beneficiaryId;

                      return (
                        <tr
                          key={dup.identityKey}
                          className="hover:bg-slate-50/80 transition-colors"
                        >
                          {/* 1. Name & Guardian */}
                          <td className="py-3.5 px-4">
                            <div className="font-bold text-slate-900 text-sm">
                              {dup.fullName}
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {language === "bn" ? "অভিভাবক: " : "Guardian: "}
                              {dup.guardianName} ({dup.gender === "Female" ? (language === "bn" ? "নারী" : "Female") : dup.gender === "Male" ? (language === "bn" ? "পুরুষ" : "Male") : dup.gender})
                            </div>
                            {dup.mobile && (
                              <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3 text-slate-400" />
                                {formatNumber(dup.mobile)}
                              </div>
                            )}
                            {dup.isCrossDepartment && (
                              <div className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-100 text-purple-900 text-[10px] font-bold border border-purple-200">
                                <span>{language === "bn" ? "ওভারল্যাপ:" : "Overlap:"}</span>
                                <span className="font-semibold">{dup.conflictingDepartmentNames || (language === "bn" ? "একাধিক দপ্তর" : "Multiple Departments")}</span>
                              </div>
                            )}
                          </td>

                          {/* 2. NID / BRN */}
                          <td className="py-3.5 px-4 font-mono">
                            {dup.nid ? (
                              <div>
                                <span className="font-semibold text-slate-900">
                                  {formatNumber(dup.nid)}
                                </span>
                                <div className="text-[10px] text-slate-400">
                                  {dup.nid.length === 10
                                    ? (language === "bn" ? "১০-ডিজিট স্মার্ট কার্ড" : "10-digit Smart Card")
                                    : dup.nid.length === 17
                                    ? (language === "bn" ? "১৭-ডিজিট বারকোড" : "17-digit Barcode")
                                    : (language === "bn" ? "পুরাতন এনআইডি" : "Legacy NID")}
                                </div>
                              </div>
                            ) : dup.brn ? (
                              <div>
                                <span className="font-semibold text-blue-800">
                                  {formatNumber(dup.brn)}
                                </span>
                                <div className="text-[10px] text-blue-600">
                                  {language === "bn" ? "ডিজিটাল জন্ম নিবন্ধন" : "Digital Birth Certificate"}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">{language === "bn" ? "নেই" : "None"}</span>
                            )}
                          </td>

                          {/* 3. Address: Upazila, Union & Ward */}
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">
                              {dup.upazilaName || "উপজেলা নির্ধারিত নেই"}, {dup.unionName}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {language === "bn" ? "ওয়ার্ড নং: " : "Ward: "}
                              {formatNumber(dup.wardNo)}
                              <span className="text-slate-400"> • {dup.district || "নেত্রকোণা"}</span>
                            </div>
                          </td>

                          {/* 4. Active Schemes List */}
                          <td className="py-3.5 px-4 space-y-1.5 max-w-xs">
                            {/* Primary Entitled Scheme (Legitimate) */}
                            <div className="p-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-[11px]">
                              <div className="flex items-center justify-between gap-1 font-semibold text-emerald-900">
                                <span className="truncate">
                                  ✓ {getSchemeName(dup.primaryScheme, language)}
                                </span>
                                <span className="font-black text-emerald-800 shrink-0">
                                  {formatCurrency(dup.primaryScheme.monthlyAmount)}
                                </span>
                              </div>
                              {dup.primaryScheme.commodityName && (
                                <div className="text-[10px] text-amber-800 font-medium">
                                  🌾 {formatNumber(dup.primaryScheme.commodityQuantity)} {getCommodityUnit(dup.primaryScheme, language)} {getCommodityName(dup.primaryScheme, language)}
                                </div>
                              )}
                              <div className="text-[10px] text-emerald-700 truncate mt-0.5">
                                {getDepartmentName(dup.primaryScheme, language)} ({t.dashboard.primarySchemeTag})
                              </div>
                            </div>

                            {/* Redundant Excess Schemes */}
                            {dup.excessSchemes.map((exc) => (
                              <div
                                key={exc.enrollmentId}
                                className={`p-1.5 rounded-lg border text-[11px] ${
                                  exc.status === "Suspended"
                                    ? "bg-slate-100 border-slate-300 text-slate-500"
                                    : "bg-red-50 border-red-200 text-red-900"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-1 font-semibold">
                                  <span className="truncate">
                                    ✗ {getSchemeName(exc, language)}
                                  </span>
                                  <span className="font-black text-red-700 shrink-0">
                                    {formatCurrency(exc.monthlyAmount)}
                                  </span>
                                </div>
                                {exc.commodityName && (
                                  <div className="text-[10px] text-amber-800 font-medium">
                                    🌾 {formatNumber(exc.commodityQuantity)} {getCommodityUnit(exc, language)} {getCommodityName(exc, language)}
                                  </div>
                                )}
                                <div className="text-[10px] text-red-700 truncate mt-0.5 flex items-center justify-between">
                                  <span>{getDepartmentName(exc, language)}</span>
                                  {exc.status === "Suspended" && (
                                    <span className="font-bold text-[9px] bg-slate-200 text-slate-700 px-1 rounded">
                                      {t.dashboard.suspendedTag}
                                    </span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </td>

                          {/* 5. Total Monthly Received */}
                          <td className="py-3.5 px-4 font-black text-slate-900 text-sm">
                            {formatCurrency(totalReceived)}
                            <div className="text-[10px] text-slate-400 font-normal">
                              {formatNumber(dup.activeEnrollmentCount)} {language === "bn" ? "টি কর্মসূচিতে" : "programs"}
                            </div>
                          </td>

                          {/* 6. Excess Amount (Highlighted in Red) */}
                          <td className="py-3.5 px-4 bg-red-50/70 border-x border-red-100">
                            <div className="text-base font-black text-red-700">
                              +{formatCurrency(dup.excessMonthlyAmount)}
                              <span className="text-[10px] font-medium text-red-600 block sm:inline sm:ml-1">
                                {t.common.perMonth}
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold text-red-900/80 mt-0.5">
                              {language === "bn" ? "বার্ষিক: " : "Yearly: "}
                              {formatCurrency(dup.excessYearlyAmount)}
                            </div>
                            <span
                              className={`inline-block mt-1 text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                dup.riskLevel === "HIGH"
                                  ? "bg-red-600 text-white"
                                  : dup.riskLevel === "MEDIUM"
                                  ? "bg-amber-500 text-white"
                                  : "bg-blue-500 text-white"
                              }`}
                            >
                              {language === "bn"
                                ? (dup.riskLevel === "HIGH" ? t.dashboard.riskHigh : dup.riskLevel === "MEDIUM" ? t.dashboard.riskMedium : t.dashboard.riskLow)
                                : `${dup.riskLevel} Risk`}
                            </span>
                          </td>

                          {/* 7. Action Buttons */}
                          <td className="py-3.5 px-4 print:hidden">
                            <div className="flex flex-col gap-1.5 min-w-[150px]">
                              {/* Upazila Admin: Review requests & take administrative decision */}
                              {isUpazilaAdmin && (
                                <Link
                                  href="/admin/removal-requests"
                                  className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-xs transition-all"
                                  title={language === "bn" ? "ভাতা বাতিলের আবেদন পর্যালোচনা ও অনুমোদন" : "Review & Decide Removal"}
                                >
                                  <Clock className="w-3.5 h-3.5 text-amber-100" />
                                  <span>{language === "bn" ? "অনুমোদন ইনবক্স" : "Approval Inbox"}</span>
                                </Link>
                              )}

                              {/* Super Admin: Mark Verified Audit Flag (CANNOT directly suspend) */}
                              {isSuperAdmin && (
                                <button
                                  onClick={() =>
                                    handleMarkVerified(
                                      dup.beneficiaryId,
                                      dup.fullName
                                    )
                                  }
                                  disabled={isProcessing}
                                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold transition-all disabled:opacity-50"
                                  title={t.dashboard.btnMarkVerified}
                                >
                                  {isProcessing ? (
                                    <Loader2 className="w-3 h-3 animate-spin" />
                                  ) : (
                                    <UserCheck className="w-3 h-3 text-amber-700" />
                                  )}
                                  <span>{t.dashboard.btnMarkVerified}</span>
                                </button>
                              )}

                              {/* Department Officer: Cannot directly suspend, only submit request for own department */}
                              {isDeptOfficer && (
                                (() => {
                                  const deptTarget =
                                    dup.excessSchemes.find((s) => s.departmentId === currentUser.departmentId) ||
                                    (dup.primaryScheme.departmentId === currentUser.departmentId ? dup.primaryScheme : null);

                                  if (deptTarget) {
                                    if (deptTarget.status === "Suspended" || (deptTarget as any).status === "SUSPENDED") {
                                      return (
                                        <span className="px-2 py-1 rounded bg-slate-200 text-slate-600 font-bold text-[10px] text-center flex items-center justify-center gap-1">
                                          <Ban className="w-3 h-3 text-slate-500" />
                                          {language === "bn" ? "স্থগিত / বাতিলকৃত" : "Suspended"}
                                        </span>
                                      );
                                    }
                                    if ((deptTarget as any).removalRequestStatus === "PENDING") {
                                      return (
                                        <span className="px-2 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[10px] text-center flex items-center justify-center gap-1">
                                          <Clock className="w-3 h-3 text-amber-700 animate-pulse" />
                                          {language === "bn" ? "অনুমোদনের অপেক্ষায়" : "Pending UNO"}
                                        </span>
                                      );
                                    }
                                    return (
                                      <button
                                        onClick={() => {
                                          handleOpenSuspensionRequest(
                                            deptTarget.enrollmentId,
                                            dup.fullName,
                                            deptTarget.schemeName,
                                            deptTarget.departmentName,
                                            deptTarget.monthlyAmount,
                                            dup
                                          );
                                        }}
                                        className="inline-flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold shadow-xs transition-all"
                                        title={language === "bn" ? "ভাতা বাদ দেওয়ার আবেদন পাঠান" : "Submit Removal Request"}
                                      >
                                        <Send className="w-3.5 h-3.5 text-blue-200" />
                                        <span>{language === "bn" ? "বাদ দেওয়ার আবেদন" : "Request Removal"}</span>
                                      </button>
                                    );
                                  }
                                  return (
                                    <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 font-medium text-[10px] border border-slate-200 text-center">
                                      {language === "bn" ? "অন্য দপ্তরের কর্মসূচি" : "Other Dept"}
                                    </span>
                                  );
                                })()
                              )}

                              {/* Union/Ward Viewer: Read-only observation */}
                              {isUnionViewer && (
                                <span className="text-[10px] bg-slate-100 text-slate-500 font-medium px-2 py-1.5 rounded-lg text-center border border-slate-200">
                                  {language === "bn" ? "শুধুমাত্র পর্যবেক্ষণের অনুমতি" : "Observation Access Only"}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer info */}
              <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-xs text-slate-500 gap-2">
                <span>
                  {language === "bn"
                    ? `${formatNumber(redundancyData?.duplicates.length || 0)}টি ডুপ্লিকেট কেসের মধ্যে ${formatNumber(filteredDuplicates.length)}টি প্রদর্শিত`
                    : `Showing ${formatNumber(filteredDuplicates.length)} of ${formatNumber(redundancyData?.duplicates.length || 0)} duplicate cases`}
                </span>
                <span className="font-semibold text-slate-700">
                  {language === "bn" ? "সম্ভাব্য মাসিক উদ্ধার: " : "Total Monthly Recovery Potential: "}
                  {formatCurrency(filteredDuplicates.reduce((sum, d) => sum + d.excessMonthlyAmount, 0))}
                  <span className="text-xs font-normal"> {t.common.perMonth}</span>
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Printable Official Signatory Block (Only visible during print) */}
        <div className="hidden print:grid grid-cols-3 gap-8 pt-16 mt-16 text-center text-xs text-slate-800 border-t border-slate-300">
          <div>
            <div className="border-t border-slate-900 w-40 mx-auto mb-1"></div>
            <p className="font-bold">{language === "bn" ? "উপজেলা সমাজসেবা কর্মকর্তা" : "Upazila Social Services Officer"}</p>
            <p className="text-[10px] text-slate-500">{language === "bn" ? "সমাজসেবা অধিদপ্তর" : "Department of Social Services"}</p>
          </div>
          <div>
            <div className="border-t border-slate-900 w-40 mx-auto mb-1"></div>
            <p className="font-bold">{language === "bn" ? "উপজেলা মহিলা বিষয়ক কর্মকর্তা" : "Upazila Women Affairs Officer"}</p>
            <p className="text-[10px] text-slate-500">{language === "bn" ? "মহিলা বিষয়ক অধিদপ্তর" : "Department of Women Affairs"}</p>
          </div>
          <div>
            <div className="border-t border-slate-900 w-40 mx-auto mb-1"></div>
            <p className="font-bold">{language === "bn" ? "উপজেলা নির্বাহী অফিসার (ইউএনও)" : "Upazila Nirbahi Officer (UNO)"}</p>
            <p className="text-[10px] text-slate-500">{language === "bn" ? "উপজেলা প্রশাসন" : "Upazila Administration"}</p>
          </div>
        </div>

        {/* Department Officer: Suspension Request Modal */}
        {showSuspensionModal && targetForRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-700" />
                  {language === "bn" ? "ভাতা স্থগিতের আবেদন" : "Allowance Suspension Request"}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowSuspensionModal(false)}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 text-sm font-bold transition-colors cursor-pointer"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              {/* Beneficiary Header Info */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <div>
                    {language === "bn" ? "সুবিধাভোগী: " : "Beneficiary: "}
                    <strong className="text-slate-900 font-bold">{targetForRequest.beneficiaryName}</strong>
                  </div>
                  {targetForRequest.beneficiaryRecord?.nid && (
                    <span className="text-[10px] font-mono text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                      NID: {targetForRequest.beneficiaryRecord.nid}
                    </span>
                  )}
                </div>
                {targetForRequest.beneficiaryRecord && (
                  <div className="text-[11px] text-slate-500">
                    {language === "bn" ? "ঠিকানা: " : "Address: "}
                    {targetForRequest.beneficiaryRecord.unionName}, ওয়ার্ড {targetForRequest.beneficiaryRecord.wardNo}, {targetForRequest.beneficiaryRecord.upazilaName || "নেত্রকোণা সদর"}
                  </div>
                )}
              </div>

              {/* Interactive Scheme Selector for Department Officer */}
              {targetForRequest.beneficiaryRecord && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-slate-800 text-xs">
                      {language === "bn"
                        ? "কোন ভাতাটি বাতিলের সুপারিশ করছেন তা সিলেক্ট করুন:"
                        : "Select which allowance to recommend for suspension:"}
                    </label>
                    <span className="text-[10px] text-slate-500 font-medium">
                      {language === "bn" ? "মোট ভাতা: " : "Total: "}
                      {targetForRequest.beneficiaryRecord.activeEnrollmentCount} টি
                    </span>
                  </div>

                  <div className="space-y-2 max-h-60 overflow-y-auto pr-0.5">
                    {[
                      { item: targetForRequest.beneficiaryRecord.primaryScheme, isPrimary: true },
                      ...targetForRequest.beneficiaryRecord.excessSchemes.map((s) => ({
                        item: s,
                        isPrimary: false,
                      })),
                    ].map(({ item, isPrimary }) => {
                      const isSelected = targetForRequest.enrollmentId === item.enrollmentId;
                      return (
                        <div
                          key={item.enrollmentId}
                          onClick={() => {
                            setTargetForRequest({
                              ...targetForRequest,
                              enrollmentId: item.enrollmentId,
                              schemeName: item.schemeName,
                              departmentName: item.departmentName,
                              monthlyAmount: item.monthlyAmount,
                            });
                            setSuspensionReason(
                              language === "bn"
                                ? `দপ্তর নিরীক্ষায় দেখা গেছে নাগরিক একই সাথে দ্বৈত সুবিধা গ্রহণ করছেন বিধায় ${formatSchemeName(item.schemeName, "bn")} স্থগিতের সুপারিশ করা হলো।`
                                : `Audit reveals beneficiary is receiving dual benefits; recommending suspension of ${formatSchemeName(item.schemeName, "en")}.`
                            );
                          }}
                          className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-2.5 ${
                            isSelected
                              ? "border-blue-600 bg-blue-50/80 shadow-xs ring-1 ring-blue-500/20"
                              : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50/70"
                          }`}
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <input
                              type="radio"
                              name="selected_suspension_scheme"
                              checked={isSelected}
                              onChange={() => {}}
                              className="mt-1 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                            />
                            <div className="min-w-0">
                              <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5 flex-wrap">
                                <span>{formatSchemeName(item.schemeName, language)}</span>
                                {isPrimary ? (
                                  <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300 shrink-0">
                                    {language === "bn" ? "মূল ভাতা (আগে চালু)" : "Primary (Earlier)"}
                                  </span>
                                ) : (
                                  <span className="bg-amber-100 text-amber-900 text-[10px] font-bold px-2 py-0.5 rounded-full border border-amber-300 shrink-0">
                                    {language === "bn" ? "অতিরিক্ত ভাতা (পরে চালু)" : "Excess (Later)"}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-slate-600 mt-0.5 flex items-center gap-1.5 flex-wrap">
                                <span>{formatDepartmentName(item.departmentName, language)}</span>
                                <span>•</span>
                                <span className="font-semibold text-slate-800">
                                  {formatCurrency(item.monthlyAmount)}{t.common.perMonth}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                                <span>{language === "bn" ? "ভাতা শুরুর তারিখ:" : "Enrolled:"}</span>
                                <span className="font-mono text-slate-700 font-medium">
                                  {item.startDate ? new Date(item.startDate).toLocaleDateString(language === "bn" ? "bn-BD" : "en-US") : "N/A"}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="shrink-0 text-right">
                            {isSelected ? (
                              <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-1 rounded-lg">
                                {language === "bn" ? "নির্বাচিত" : "Selected"}
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-400 font-medium">
                                {language === "bn" ? "বাছুন" : "Choose"}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-200 text-xs space-y-1">
                <div>
                  {language === "bn" ? "স্থগিতের জন্য প্রস্তাবিত ভাতা: " : "Target Scheme for Suspension: "}
                  <strong className="text-blue-900 font-bold">{formatSchemeName(targetForRequest.schemeName, language)}</strong> (
                  {formatCurrency(targetForRequest.monthlyAmount)}{t.common.perMonth})
                </div>
                <div className="text-[11px] text-slate-500">
                  {language === "bn" ? "দপ্তর: " : "Department: "}
                  {formatDepartmentName(targetForRequest.departmentName, language)}
                </div>
              </div>

              <form onSubmit={handleSubmitSuspensionRequest} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {language === "bn" ? "স্থগিত সুপারিশের কারণ *" : "Reason / Justification for Suspension *"}
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={suspensionReason}
                    onChange={(e) => setSuspensionReason(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 text-xs sm:text-sm"
                    placeholder={language === "bn" ? "স্থগিতের যৌক্তিক কারণ উল্লেখ করুন..." : "Enter justification for suspension..."}
                  />
                </div>

                <div className="text-[11px] text-slate-500 italic">
                  {language === "bn"
                    ? "* দপ্তর কর্মকর্তা সরাসরি স্থগিত করতে পারবেন না। আবেদনটি সুপার অ্যাডমিনের (ইউএনও) অনুমোদনের পর কার্যকর হবে।"
                    : "* Department officers submit recommendations. Suspension will be enforced upon Super Admin approval."}
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowSuspensionModal(false)}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 transition-colors flex items-center justify-center cursor-pointer"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRequest}
                    className="w-full sm:w-auto min-h-[44px] px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-bold disabled:opacity-50 flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  >
                    {submittingRequest
                      ? (language === "bn" ? "আবেদন পাঠানো হচ্ছে..." : "Submitting...")
                      : (language === "bn" ? "আবেদন পাঠান" : "Submit Request")}
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
