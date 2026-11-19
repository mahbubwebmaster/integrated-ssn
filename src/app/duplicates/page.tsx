"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  ShieldAlert,
  AlertTriangle,
  Search,
  Filter,
  Building2,
  MapPin,
  TrendingUp,
  Download,
  Ban,
  CheckCircle2,
  Layers,
  ChevronDown,
  Loader2,
  RefreshCw,
  Calendar,
  CreditCard,
  Phone,
  UserCheck,
  FileSpreadsheet,
  Lock,
  Send,
  Eye,
  ShieldCheck,
  X,
  Printer,
  Clock,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatDepartmentName, formatSchemeName } from "@/lib/translations";
import { NETROKONA_UPAZILAS } from "@/lib/netrokona";

interface RedundantScheme {
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
  cardNumber?: string | null;
  startDate: string;
  status: string;
  removalRequestStatus?: string | null;
  removalRequestId?: string | null;
}

interface DuplicateItem {
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
  primaryScheme: RedundantScheme;
  excessSchemes: RedundantScheme[];
  excessMonthlyAmount: number;
  excessYearlyAmount: number;
  riskLevel: "HIGH" | "MEDIUM" | "LOW";
  isCrossDepartment: boolean;
}

interface RedundancyData {
  success: boolean;
  summary: {
    totalDuplicateBeneficiaries: number;
    totalRedundantEnrollments: number;
    totalMonthlyLeakAmount: number;
    totalYearlyLeakAmount: number;
  };
  filters: {
    upazilas?: string[];
    unions: string[];
    wards: string[];
  };
  duplicates: DuplicateItem[];
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
  breakdownByScheme: Array<{
    schemeName: string;
    departmentName: string;
    redundantCount: number;
    excessAmount: number;
  }>;
}

interface Department {
  id: string;
  name: string;
  nameBn?: string | null;
  nameEn?: string | null;
}

export default function DuplicatesPage() {
  const { currentUser, isSuperAdmin, isUpazilaAdmin, isDeptOfficer, isUnionViewer } = useAuth();
  const { language, t, formatNumber, formatCurrency, getDepartmentName, getSchemeName } = useLanguage();

  const [data, setData] = useState<RedundancyData | null>(null);
  const [loading, setLoading] = useState(true);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [todayString, setTodayString] = useState("");

  useEffect(() => {
    setTodayString(new Date().toLocaleDateString(language === "bn" ? "bn-BD" : "en-US"));
  }, [language]);

  // Filter States
  const [search, setSearch] = useState("");
  const [selectedUpazila, setSelectedUpazila] = useState<string>(currentUser.upazilaName || "");
  const [selectedUnion, setSelectedUnion] = useState("");
  const [selectedWard, setSelectedWard] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedGender, setSelectedGender] = useState("");
  const [selectedRisk, setSelectedRisk] = useState<string>("ALL");

  useEffect(() => {
    if (currentUser.upazilaName) {
      setSelectedUpazila(currentUser.upazilaName);
    }
  }, [currentUser.upazilaName]);

  // Action State
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  // Suspension Request Modal State (for Department Officers)
  const [showSuspensionModal, setShowSuspensionModal] = useState(false);
  const [targetForRequest, setTargetForRequest] = useState<{
    enrollmentId: string;
    beneficiaryName: string;
    beneficiaryNid?: string | null;
    beneficiaryGuardian?: string | null;
    district?: string | null;
    upazilaName?: string | null;
    unionName: string;
    wardNo: string;
    schemeName: string;
    departmentName: string;
    monthlyAmount: number;
    primaryScheme: RedundantScheme;
    excessSchemes: RedundantScheme[];
  } | null>(null);
  const [suspensionReason, setSuspensionReason] = useState("");
  const [submittingRequest, setSubmittingRequest] = useState(false);

  const PRESET_REMOVAL_REASONS = [
    "নাগরিক একাধিক মন্ত্রণালয়/দপ্তরের সমজাতীয় নগদ/খাদ্য সহায়তা একই সাথে গ্রহণ করছেন (দ্বৈত সুবিধা গ্রহণ আইনত নিষিদ্ধ)।",
    "সমাজসেবা অধিদপ্তরের সামাজিক নিরাপত্তা বেষ্টনী কর্মসূচিতে সক্রিয় থাকায় অত্র দপ্তরের ভাতা বাতিলের সুপারিশ করা হলো।",
    "মহিলা বিষয়ক অধিদপ্তরের ভালনারেবল উইমেন বেনিফিট (ভিডব্লিউবি) পাওয়ায় খাদ্যবান্ধব কর্মসূচি থেকে অপসারণের আবেদন।",
    "দপ্তর পর্যায়ে সরেজমিনে তদন্ত ও ভোটার তালিকা নিরীক্ষায় অননুমোদিত দ্বৈত অন্তর্ভুক্তি নিশ্চিত হওয়া গেছে।",
  ];

  // Fetch departments for filter
  useEffect(() => {
    fetch("/api/departments")
      .then((res) => res.json())
      .then((res) => {
        if (res.success && res.departments) {
          setDepartments(res.departments);
        }
      })
      .catch((err) => console.error("Error loading departments:", err));
  }, []);

  // Pre-set department or union filter based on role
  useEffect(() => {
    if (isDeptOfficer && currentUser.departmentId) {
      setSelectedDeptId(currentUser.departmentId);
    } else if (isUnionViewer && currentUser.unionName) {
      setSelectedUnion(currentUser.unionName);
    }
  }, [currentUser, isDeptOfficer, isUnionViewer]);

  const fetchRedundancyData = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (selectedUpazila && selectedUpazila !== "all" && selectedUpazila !== "সমগ্র জেলা") {
        params.set("upazila", selectedUpazila);
      }
      if (selectedUnion) params.set("union", selectedUnion);
      if (selectedWard) params.set("ward", selectedWard);
      if (selectedDeptId) params.set("departmentId", selectedDeptId);
      if (selectedGender) params.set("gender", selectedGender);

      const res = await fetch(`/api/redundancy?${params.toString()}`);
      const json: RedundancyData = await res.json();
      if (json.success) {
        setData(json);
      }
    } catch (err) {
      console.error("Error fetching redundancy data:", err);
    } finally {
      setLoading(false);
    }
  }, [search, selectedUpazila, selectedUnion, selectedWard, selectedDeptId, selectedGender]);

  useEffect(() => {
    fetchRedundancyData();
  }, [fetchRedundancyData]);

  // Action: Suspend Redundant Enrollment (Super Admin only)
  const handleUpdateStatus = async (enrollmentId: string, status: "Suspended" | "Active") => {
    if (!confirm(t.duplicatesPage.confirmSuspend)) {
      return;
    }
    try {
      setActionLoadingId(enrollmentId);
      const res = await fetch("/api/redundancy", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enrollmentId, status }),
      });
      const resJson = await res.json();
      if (resJson.success) {
        setActionSuccessMessage(t.duplicatesPage.suspendSuccess);
        setTimeout(() => setActionSuccessMessage(null), 5000);
        await fetchRedundancyData();
      } else {
        alert(resJson.error || (language === "bn" ? "ভাতা স্থগিত করা সম্ভব হয়নি" : "Failed to update enrollment"));
      }
    } catch (err) {
      console.error(err);
      alert(language === "bn" ? "ত্রুটি ঘটেছে" : "Error updating status");
    } finally {
      setActionLoadingId(null);
    }
  };

  // Open Removal Request Modal (Department Officer)
  const handleOpenSuspensionRequest = (
    exc: RedundantScheme,
    item: DuplicateItem
  ) => {
    setTargetForRequest({
      enrollmentId: exc.enrollmentId,
      beneficiaryName: item.fullName,
      beneficiaryNid: item.nid,
      beneficiaryGuardian: item.guardianName,
      unionName: item.unionName,
      wardNo: item.wardNo,
      schemeName: exc.schemeName,
      departmentName: exc.departmentName,
      monthlyAmount: exc.monthlyAmount,
      primaryScheme: item.primaryScheme,
      excessSchemes: item.excessSchemes,
    });
    setSuspensionReason(PRESET_REMOVAL_REASONS[0]);
    setShowSuspensionModal(true);
  };

  // Submit Suspension / Removal Request
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

      const resData = await res.json();
      if (resData.success) {
        setShowSuspensionModal(false);

        // Optimistically update local duplicate item's removalRequestStatus to PENDING
        setData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            duplicates: prev.duplicates.map((dup) => ({
              ...dup,
              excessSchemes: dup.excessSchemes.map((s) =>
                s.enrollmentId === targetForRequest.enrollmentId
                  ? { ...s, removalRequestStatus: "PENDING" }
                  : s
              ),
            })),
          };
        });

        setActionSuccessMessage(
          language === "bn"
            ? `ভাতা বাদ দেওয়ার আবেদন সফলভাবে পাঠানো হয়েছে: ${targetForRequest.beneficiaryName} এর জন্য আবেদনটি উপজেলা নির্বাহী অফিসারের (ইউএনও) অনুমোদনের অপেক্ষায় রয়েছে।`
            : `Removal request submitted successfully for ${targetForRequest.beneficiaryName}. Awaiting approval from Upazila Admin (UNO).`
        );
        setTimeout(() => setActionSuccessMessage(null), 6000);
        // Also refetch in background
        fetchRedundancyData();
      } else {
        alert(resData.error || (language === "bn" ? "আবেদন প্রেরণ ব্যর্থ হয়েছে" : "Failed to submit request"));
      }
    } catch (err) {
      console.error(err);
      alert(language === "bn" ? "আবেদন প্রেরণ ব্যর্থ হয়েছে" : "Error submitting suspension request");
    } finally {
      setSubmittingRequest(false);
    }
  };

  // Role-scoped & risk-filtered duplicate list
  const filteredDuplicates = useMemo(() => {
    if (!data?.duplicates) return [];

    let list = data.duplicates;

    if (isDeptOfficer && currentUser.departmentId) {
      list = list.filter((item) => {
        const matchesPrimary = item.primaryScheme.departmentId === currentUser.departmentId;
        const matchesExcess = item.excessSchemes.some(
          (s) => s.departmentId === currentUser.departmentId
        );
        return matchesPrimary || matchesExcess;
      });
    }

    if (isUnionViewer && currentUser.unionName) {
      const uName = currentUser.unionName.toLowerCase();
      list = list.filter((item) => item.unionName.toLowerCase().includes(uName));
    }

    if (selectedRisk !== "ALL") {
      list = list.filter((item) => item.riskLevel === selectedRisk);
    }

    return list;
  }, [data, isDeptOfficer, isUnionViewer, currentUser, selectedRisk]);

  const scopedSummary = useMemo(() => {
    const totalDups = filteredDuplicates.length;
    const totalExcessMonthly = filteredDuplicates.reduce(
      (sum, item) => sum + item.excessMonthlyAmount,
      0
    );
    const totalExcessYearly = filteredDuplicates.reduce(
      (sum, item) => sum + item.excessYearlyAmount,
      0
    );
    const totalRedundantCount = filteredDuplicates.reduce(
      (sum, item) => sum + item.excessSchemes.length,
      0
    );

    return {
      totalDuplicates: totalDups,
      totalExcessMonthly,
      totalExcessYearly,
      totalRedundantCount,
    };
  }, [filteredDuplicates]);

  // Export Audit Report to Excel
  const handleExportExcel = () => {
    if (filteredDuplicates.length === 0) {
      alert(language === "bn" ? "এক্সপোর্ট করার জন্য কোনো তথ্য নেই।" : "No duplicate records to export.");
      return;
    }

    const isBn = language === "bn";
    const exportRows = filteredDuplicates.map((dup, idx) =>
      isBn
        ? {
            "ক্রমিক নং": idx + 1,
            "সুবিধাভোগীর নাম": dup.fullName,
            "পিতা / স্বামীর নাম": dup.guardianName,
            লিঙ্গ: dup.gender,
            এনআইডি: dup.nid || "-",
            "জন্ম নিবন্ধন": dup.brn || "-",
            ইউনিয়ন: dup.unionName,
            "ওয়ার্ড নং": dup.wardNo,
            মোবাইল: dup.mobile || "-",
            "মোট সক্রিয় কর্মসূচি": dup.activeEnrollmentCount,
            "মূল অনুমোদিত কর্মসূচি": `${getSchemeName(dup.primaryScheme, language)} (${getDepartmentName(dup.primaryScheme, language)})`,
            "মূল মাসিক ভাতা": dup.primaryScheme.monthlyAmount,
            "অতিরিক্ত কর্মসূচি": dup.excessSchemes
              .map((s) => `${getSchemeName(s, language)} (৳${s.monthlyAmount})`)
              .join("; "),
            "মাসিক রাজস্ব অপচয় (টাকা)": dup.excessMonthlyAmount,
            "বার্ষিক রাজস্ব অপচয় (টাকা)": dup.excessYearlyAmount,
            "আন্তঃদপ্তর ডুপ্লিকেট": dup.isCrossDepartment ? "হ্যাঁ (একাধিক দপ্তর)" : "না (একই দপ্তর)",
            "ঝুঁকি স্তর": dup.riskLevel,
          }
        : {
            "SL No": idx + 1,
            "Beneficiary Name": dup.fullName,
            "Guardian Name": dup.guardianName,
            Gender: dup.gender,
            NID: dup.nid || "N/A",
            BRN: dup.brn || "N/A",
            Union: dup.unionName,
            "Ward No": dup.wardNo,
            Mobile: dup.mobile || "N/A",
            "Total Active Programs": dup.activeEnrollmentCount,
            "Primary Entitled Scheme": `${getSchemeName(dup.primaryScheme, language)} (${getDepartmentName(dup.primaryScheme, language)})`,
            "Primary Allowance (BDT/mo)": dup.primaryScheme.monthlyAmount,
            "Redundant Schemes": dup.excessSchemes
              .map((s) => `${getSchemeName(s, language)} (BDT ${s.monthlyAmount})`)
              .join("; "),
            "Excess Monthly Leak (BDT)": dup.excessMonthlyAmount,
            "Excess Yearly Leak (BDT)": dup.excessYearlyAmount,
            "Cross-Department Flag": dup.isCrossDepartment ? "YES (Multi-Ministry)" : "NO (Same Ministry)",
            "Risk Severity": dup.riskLevel,
          }
    );

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, isBn ? "ডুপ্লিকেট_নিরীক্ষা" : "SSNP_Duplicates_Audit");
    XLSX.writeFile(
      workbook,
      isBn
        ? `উপজেলা_ডুপ্লিকেট_নিরীক্ষা_রিপোর্ট_${new Date().toISOString().split("T")[0]}.xlsx`
        : `SSNP_Redundancy_Audit_Report_${new Date().toISOString().split("T")[0]}.xlsx`
    );
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      {/* Printable Report Header (Visible only on window.print()) */}
      <div className="hidden print:block mb-6 text-center border-b-2 border-slate-900 pb-4">
        <h2 className="text-xl font-bold text-slate-900 uppercase">
          {language === "bn"
            ? "গণপ্রজাতন্ত্রী বাংলাদেশ সরকার"
            : "Government of the People's Republic of Bangladesh"}
        </h2>
        <h3 className="text-base font-semibold text-slate-800">
          {language === "bn"
            ? "জেলা প্রশাসন ও উপজেলা প্রশাসন, নেত্রকোণা"
            : "District Administration & Upazila Administration, Netrokona"}
        </h3>
        <p className="text-sm font-bold text-slate-900 mt-1">
          {language === "bn"
            ? "সমন্বিত সামাজিক নিরাপত্তা ডাটাবেস - ডুপ্লিকেট ভাতা নিরীক্ষা রিপোর্ট"
            : "Integrated Social Safety Net Registry - Duplication Audit Report"}
        </p>
        <div className="flex justify-between items-center text-xs text-slate-700 mt-3 pt-2 border-t border-slate-300">
          <span>
            {language === "bn" ? "রিপোর্ট প্রস্তুতকারক:" : "Generated By:"}{" "}
            {currentUser.name} (
            {language === "bn" ? currentUser.roleTitleBn : currentUser.roleTitleEn})
          </span>
          <span>
            {language === "bn" ? "তারিখ:" : "Date:"} {todayString}
          </span>
          <span>
            {language === "bn" ? "মোট চিহ্নিত ডুপ্লিকেট:" : "Identified Duplicates:"}{" "}
            {formatNumber(filteredDuplicates.length, language)}
          </span>
        </div>
      </div>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Role Scoped Banner */}
        <div className="no-print bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${
                isSuperAdmin
                  ? "bg-purple-100 text-purple-700"
                  : isDeptOfficer
                  ? "bg-blue-100 text-blue-700"
                  : "bg-emerald-100 text-emerald-700"
              }`}
            >
              {isSuperAdmin ? (
                <ShieldCheck className="w-5 h-5" />
              ) : isDeptOfficer ? (
                <Building2 className="w-5 h-5" />
              ) : (
                <Eye className="w-5 h-5" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  {t.common.activeRole}
                </span>
                <span
                  className={`text-xs font-extrabold px-2 py-0.5 rounded-full ${
                    isSuperAdmin
                      ? "bg-purple-100 text-purple-800 border border-purple-200"
                      : isDeptOfficer
                      ? "bg-blue-100 text-blue-800 border border-blue-200"
                      : "bg-emerald-100 text-emerald-800 border border-emerald-200"
                  }`}
                >
                  {language === "bn" ? currentUser.roleTitleBn : currentUser.roleTitleEn} ({currentUser.name})
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-0.5">
                {isSuperAdmin &&
                  (language === "bn"
                    ? "সকল দপ্তরের ডুপ্লিকেসি রিপোর্ট দেখা ও অতিরিক্ত ভাতা সরাসরি স্থগিত করার পূর্ণ এক্সেস রয়েছে।"
                    : "Full access to inspect overall duplicate audit reports and directly suspend unauthorized redundant entitlements.")}
                {isDeptOfficer &&
                  (language === "bn"
                    ? `সীমিত এক্সেস: কেবল আপনার দপ্তর (${currentUser.departmentName || "দপ্তর"}) ও অন্য দপ্তরের সাথে কনফ্লিক্টযুক্ত সুবিধাভোগী প্রদর্শিত হচ্ছে। ভাতা স্থগিতের জন্য আপনি আবেদন পাঠাতে পারবেন।`
                    : `Scoped Access: Viewing conflicts affecting your assigned department (${currentUser.departmentName || "Department"}). You may submit suspension requests for administrative approval.`)}
                {isUnionViewer &&
                  (language === "bn"
                    ? `সীমিত এক্সেস: শুধুমাত্র আপনার ইউনিয়ন (${currentUser.unionName || "ইউনিয়ন"}) এর ডুপ্লিকেট তালিকা প্রদর্শিত হচ্ছে (পর্যবেক্ষণ মোড - শুধুমাত্র পড়ার অনুমতি)।`
                    : `Scoped Access: Viewing duplicate records strictly within your assigned Union (${currentUser.unionName || "Union"}) in read-only observation mode.`)}
              </p>
            </div>
          </div>
        </div>

        {/* Global Success Notification */}
        {actionSuccessMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button
              onClick={() => setActionSuccessMessage(null)}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header Bar */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-xs font-semibold text-red-800 mb-2">
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                {t.duplicatesPage.badge}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {t.duplicatesPage.title}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {t.duplicatesPage.subtitle}
              </p>
            </div>

            <div className="no-print flex flex-wrap items-center gap-2">
              <button
                onClick={fetchRedundancyData}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                {language === "bn" ? "রিফ্রেশ" : "Refresh"}
              </button>
              <button
                onClick={handleExportExcel}
                disabled={loading || filteredDuplicates.length === 0}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {t.duplicatesPage.btnExportExcel}
              </button>
              <button
                onClick={handlePrint}
                disabled={loading || filteredDuplicates.length === 0}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                <Printer className="w-4 h-4" />
                {language === "bn" ? "পিডিএফ রিপোর্ট" : "Print / PDF Report"}
              </button>
            </div>
          </div>
        </div>

        {/* Financial KPI Summary Cards (Role Scoped) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-red-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-700 uppercase tracking-wider">
                {t.duplicatesPage.kpiMonthlyLeak}
              </span>
              <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
                ৳
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">
              {formatCurrency(scopedSummary.totalExcessMonthly, language)}
            </div>
            <p className="text-xs text-red-600 mt-1 font-medium">
              {t.common.perMonth}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs relative overflow-hidden">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-700 uppercase tracking-wider">
                {t.duplicatesPage.kpiYearlyLeak}
              </span>
              <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-700 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">
              {formatCurrency(scopedSummary.totalExcessYearly, language)}
            </div>
            <p className="text-xs text-amber-700 mt-1 font-medium">
              {language === "bn" ? "১২ মাসের হিসাব" : "Projected 12 Months"}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {t.duplicatesPage.kpiDuplicatesFound}
              </span>
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">
              {formatNumber(scopedSummary.totalDuplicates, language)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === "bn" ? "একাধিক সক্রিয় কর্মসূচি গ্রহণকারী" : "Holders of concurrent entitlements"}
            </p>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
                {t.duplicatesPage.kpiRedundantEnrollments}
              </span>
              <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center">
                <Layers className="w-4 h-4" />
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 mt-2">
              {formatNumber(scopedSummary.totalRedundantCount, language)}
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {language === "bn" ? "স্থগিতযোগ্য অতিরিক্ত অন্তর্ভুক্তি" : "Suspendable concurrent slots"}
            </p>
          </div>
        </div>

        {/* Charts & Analytics Row (Super Admin & Full Scopes) */}
        {data && data.duplicates.length > 0 && isSuperAdmin && (
          <div className="no-print grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Department-wise Leak BarChart */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-emerald-700" />
                {t.dashboard.chartDeptTitle}
              </h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.breakdownByDepartment.slice(0, 5)}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <XAxis
                      dataKey="departmentName"
                      tick={{ fontSize: 10 }}
                      interval={0}
                      tickFormatter={(val: string) => val.split(" ")[0] || val}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: any) => [
                        formatCurrency(Number(val ?? 0), language),
                        language === "bn" ? "মাসিক অপচয়" : "Monthly Leakage",
                      ]}
                    />
                    <Bar dataKey="excessAmount" radius={[6, 6, 0, 0]} fill="#ef4444" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Union-wise Duplicates Chart */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-emerald-700" />
                {t.dashboard.chartUnionTitle}
              </h3>
              <div className="h-60 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data.breakdownByUnion}
                    margin={{ top: 10, right: 10, left: -20, bottom: 20 }}
                  >
                    <XAxis
                      dataKey="unionName"
                      tick={{ fontSize: 10 }}
                      interval={0}
                    />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip
                      formatter={(val: any) => [
                        `${formatNumber(Number(val ?? 0), language)} ${language === "bn" ? "জন" : "citizens"}`,
                        language === "bn" ? "ডুপ্লিকেট সংখ্যা" : "Duplicate Count",
                      ]}
                    />
                    <Bar dataKey="duplicateCount" radius={[6, 6, 0, 0]} fill="#06b6d4" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Filter Controls */}
        <div className="no-print bg-white rounded-2xl p-4 shadow-sm border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-emerald-700" />
              {t.common.filter}
            </span>
            {(search || selectedUnion || selectedWard || selectedDeptId || selectedGender) && (
              <button
                onClick={() => {
                  setSearch("");
                  if (!isUnionViewer) setSelectedUnion("");
                  setSelectedWard("");
                  if (!isDeptOfficer) setSelectedDeptId("");
                  setSelectedGender("");
                }}
                className="text-[11px] font-semibold text-emerald-700 hover:text-emerald-800"
              >
                {language === "bn" ? "ফিল্টার রিসেট করুন" : "Reset Filters"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Search Input */}
            <div className="lg:col-span-1">
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                {t.common.search}
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                <input
                  type="text"
                  placeholder={t.duplicatesPage.searchPlaceholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>
            </div>

            {/* Upazila Filter */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase">
                  {language === "bn" ? "উপজেলা (নেত্রকোণা)" : "Upazila (Netrokona)"}
                </label>
                {(isUpazilaAdmin || isDeptOfficer) && currentUser.upazilaName && (
                  <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> {t.common.locked}
                  </span>
                )}
              </div>
              <select
                value={selectedUpazila}
                onChange={(e) => {
                  setSelectedUpazila(e.target.value);
                  setSelectedUnion("");
                }}
                disabled={(isUpazilaAdmin || isDeptOfficer) && Boolean(currentUser.upazilaName)}
                className={`w-full px-3 py-2 rounded-xl border text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  (isUpazilaAdmin || isDeptOfficer) && currentUser.upazilaName
                    ? "bg-slate-100 cursor-not-allowed font-semibold text-slate-700"
                    : "bg-white"
                }`}
              >
                <option value="">{language === "bn" ? "সকল উপজেলা (সমগ্র জেলা)" : "All Upazilas (Whole District)"}</option>
                {NETROKONA_UPAZILAS.map((upz) => (
                  <option key={upz.key} value={upz.nameBn}>
                    {upz.nameBn} ({upz.nameEn})
                  </option>
                ))}
              </select>
            </div>

            {/* Union Filter */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase">
                  {t.duplicatesPage.filterUnion}
                </label>
                {isUnionViewer && (
                  <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> {t.common.locked}
                  </span>
                )}
              </div>
              <select
                value={selectedUnion}
                onChange={(e) => setSelectedUnion(e.target.value)}
                disabled={isUnionViewer}
                className={`w-full px-3 py-2 rounded-xl border text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  isUnionViewer ? "bg-slate-100 cursor-not-allowed" : "bg-white"
                }`}
              >
                <option value="">{t.common.allUnions}</option>
                {data?.filters.unions.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>

            {/* Ward Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                {t.duplicatesPage.filterWard}
              </label>
              <select
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="">{language === "bn" ? "সকল ওয়ার্ড" : "All Wards"}</option>
                {data?.filters.wards.map((w) => (
                  <option key={w} value={w}>
                    {language === "bn" ? `ওয়ার্ড ${formatNumber(w, language)}` : `Ward ${w}`}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[11px] font-semibold text-slate-600 uppercase">
                  {t.duplicatesPage.filterDept}
                </label>
                {isDeptOfficer && (
                  <span className="text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                    <Lock className="w-2.5 h-2.5" /> {t.common.locked}
                  </span>
                )}
              </div>
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                disabled={isDeptOfficer}
                className={`w-full px-3 py-2 rounded-xl border text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  isDeptOfficer ? "bg-slate-100 cursor-not-allowed" : "bg-white"
                }`}
              >
                <option value="">{t.common.allDepartments}</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {getDepartmentName(d, language)}
                  </option>
                ))}
              </select>
            </div>

            {/* Gender Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 uppercase mb-1">
                {t.duplicatesPage.filterGender}
              </label>
              <select
                value={selectedGender}
                onChange={(e) => setSelectedGender(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="">{language === "bn" ? "সকল লিঙ্গ" : "All Genders"}</option>
                <option value="Female">{t.common.female}</option>
                <option value="Male">{t.common.male}</option>
                <option value="Other">{t.common.other}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Duplicate Beneficiary Audit Cards */}
        {loading ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-slate-800">
              {t.common.loading}
            </h3>
          </div>
        ) : filteredDuplicates.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200">
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-3" />
            <h3 className="text-base font-bold text-slate-900">
              {t.duplicatesPage.noDuplicates}
            </h3>
            <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
              {isDeptOfficer
                ? (language === "bn" ? "আপনার দপ্তরের সাথে কোন অবৈধ দ্বৈত সুবিধাভোগী শনাক্ত হয়নি।" : "No duplicate beneficiaries found involving your department.")
                : isUnionViewer
                ? (language === "bn" ? "আপনার ইউনিয়নের তালিকায় কোন ডুপ্লিকেট পাওয়া যায়নি।" : "No duplicate beneficiaries found within your assigned union.")
                : (language === "bn" ? "বর্তমান ফিল্টারের অধীনে কোনো ডুপ্লিকেট সুবিধাভোগী নেই।" : "No duplicate beneficiaries found matching current filters.")}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-semibold text-slate-600">
                {language === "bn"
                  ? `${formatNumber(filteredDuplicates.length, language)} জন ডুপ্লিকেট সুবিধাভোগী প্রদর্শিত হচ্ছে`
                  : `Displaying ${filteredDuplicates.length} Duplicate Citizen Cases`}
              </span>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">{t.duplicatesPage.filterRisk}:</span>
                {[
                  { r: "ALL", label: t.duplicatesPage.allRisks },
                  { r: "HIGH", label: t.duplicatesPage.highRisk },
                  { r: "MEDIUM", label: t.duplicatesPage.mediumRisk },
                  { r: "LOW", label: t.duplicatesPage.lowRisk },
                ].map((item) => (
                  <button
                    key={item.r}
                    onClick={() => setSelectedRisk(item.r)}
                    className={`px-2.5 py-1 rounded-lg font-semibold text-[11px] transition-all ${
                      selectedRisk === item.r
                        ? "bg-slate-900 text-white"
                        : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredDuplicates.map((item, idx) => {
              const conflictingDepts = Array.from(
                new Set(
                  [item.primaryScheme, ...item.excessSchemes]
                    .map((s) => s.departmentName)
                    .filter((d) => d !== currentUser.departmentName)
                )
              );

              return (
                <div
                  key={item.identityKey || idx}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-red-300 transition-all space-y-4"
                >
                  {/* Header: Citizen Info & Leak Badge */}
                  <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 text-[11px] font-bold uppercase tracking-wider">
                          {formatNumber(item.activeEnrollmentCount, language)} {language === "bn" ? "টি সক্রিয় কর্মসূচি" : "Active Programs"}
                        </span>
                        {item.isCrossDepartment && (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 text-[11px] font-semibold">
                            {t.duplicatesPage.crossDeptBadge}
                          </span>
                        )}
                        {isDeptOfficer && conflictingDepts.length > 0 && (
                          <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 text-[11px] font-bold border border-amber-300">
                            {language === "bn" ? "কনফ্লিক্টিং দপ্তর:" : "Conflicting Departments:"} {conflictingDepts.join(", ")}
                          </span>
                        )}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            item.riskLevel === "HIGH"
                              ? "bg-red-600 text-white"
                              : item.riskLevel === "MEDIUM"
                              ? "bg-amber-500 text-white"
                              : "bg-blue-500 text-white"
                          }`}
                        >
                          {item.riskLevel === "HIGH"
                            ? t.duplicatesPage.riskHigh
                            : item.riskLevel === "MEDIUM"
                            ? t.duplicatesPage.riskMedium
                            : t.duplicatesPage.riskLow}
                        </span>
                      </div>

                      <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        {item.fullName}
                        <span className="text-xs font-normal text-slate-500">
                          ({item.gender})
                        </span>
                      </h2>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 pt-0.5">
                        <span>
                          {language === "bn" ? "পিতা / স্বামী:" : "Guardian:"}{" "}
                          <strong className="text-slate-800">{item.guardianName}</strong>
                        </span>
                        <span>
                          {language === "bn" ? "ঠিকানা:" : "Address:"}{" "}
                          <strong className="text-slate-800">
                            {item.upazilaName ? `${item.upazilaName}, ` : ""}{item.unionName} ({language === "bn" ? `ওয়ার্ড ${formatNumber(item.wardNo, language)}` : `Ward ${item.wardNo}`})
                          </strong>
                          <span className="text-slate-500 font-normal ml-1">
                            • {item.district || "নেত্রকোণা"}
                          </span>
                        </span>
                        {item.nid && (
                          <span className="font-mono bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {language === "bn" ? "এনআইডি:" : "NID:"} {item.nid}
                          </span>
                        )}
                        {item.brn && (
                          <span className="font-mono bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
                            {language === "bn" ? "বিআরএন:" : "BRN:"} {item.brn}
                          </span>
                        )}
                        {item.mobile && (
                          <span className="flex items-center gap-1 font-mono text-slate-600">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {item.mobile}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Leak Amount Pill */}
                    <div className="bg-red-50 p-4 rounded-xl border border-red-200 text-right shrink-0 min-w-[200px]">
                      <div className="text-[11px] font-semibold text-red-700 uppercase tracking-wider">
                        {t.duplicatesPage.colExcessAmount}
                      </div>
                      <div className="text-2xl font-black text-red-700 mt-0.5">
                        +{formatCurrency(item.excessMonthlyAmount, language)}
                        <span className="text-xs font-medium text-red-600"> {t.common.perMonth}</span>
                      </div>
                      <div className="text-[11px] font-semibold text-slate-600 mt-1">
                        {formatCurrency(item.excessYearlyAmount, language)} {language === "bn" ? "/ বছর" : "/ year"}
                      </div>
                    </div>
                  </div>

                  {/* Schemes Matrix: Primary Legitimate vs Excess Redundant */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Legitimate Primary Scheme */}
                    <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-800 uppercase tracking-wide">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          {t.dashboard.primarySchemeTag}
                        </span>
                        <span className="text-xs font-bold text-emerald-900 bg-emerald-200/60 px-2 py-0.5 rounded">
                          {formatCurrency(item.primaryScheme.monthlyAmount, language)} {t.common.perMonth}
                        </span>
                      </div>
                      <div className="font-bold text-sm text-slate-900">
                        {getSchemeName(item.primaryScheme, language)}
                      </div>
                      <div className="text-xs text-slate-600 flex items-center justify-between">
                        <span>{getDepartmentName(item.primaryScheme, language)}</span>
                        <span className="font-mono text-slate-500">
                          {language === "bn" ? "কার্ড:" : "Card:"} {item.primaryScheme.cardNumber || "-"}
                        </span>
                      </div>
                    </div>

                    {/* Redundant Excess Schemes */}
                    <div className="space-y-2">
                      <span className="inline-flex items-center gap-1.5 text-xs font-bold text-red-800 uppercase tracking-wide">
                        <Ban className="w-4 h-4 text-red-600" />
                        {t.dashboard.excessSchemeTag} ({formatNumber(item.excessSchemes.length, language)})
                      </span>

                      <div className="space-y-2">
                        {item.excessSchemes.map((exc) => (
                          <div
                            key={exc.enrollmentId}
                            className="p-3 rounded-xl bg-red-50/60 border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <div className="font-bold text-slate-900 flex items-center gap-2">
                                {getSchemeName(exc, language)}
                                <span className="text-red-700 font-extrabold">
                                  ({formatCurrency(exc.monthlyAmount, language)} {t.common.perMonth})
                                </span>
                              </div>
                              <div className="text-slate-500 text-[11px] mt-0.5">
                                {getDepartmentName(exc, language)}
                                {exc.cardNumber && ` • ${language === "bn" ? "কার্ড:" : "Card:"} ${exc.cardNumber}`}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              {exc.status === "Suspended" || exc.status === "SUSPENDED" ? (
                                <span className="px-2.5 py-1 rounded bg-slate-200 text-slate-600 font-bold text-[11px] flex items-center gap-1">
                                  <Ban className="w-3 h-3 text-slate-500" />
                                  {language === "bn" ? "স্থগিত / বাতিলকৃত" : "Suspended"}
                                </span>
                              ) : exc.removalRequestStatus === "PENDING" ? (
                                <span className="px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 font-bold text-[11px] flex items-center gap-1.5 shadow-2xs">
                                  <Clock className="w-3.5 h-3.5 text-amber-700 animate-pulse" />
                                  {language === "bn" ? "অনুমোদনের অপেক্ষায় (Pending UNO Approval)" : "Pending UNO Approval"}
                                </span>
                              ) : isDeptOfficer ? (
                                currentUser.departmentId && exc.departmentId !== currentUser.departmentId ? (
                                  <span className="px-2 py-1 rounded bg-slate-100 text-slate-500 font-semibold text-[10px] border border-slate-200">
                                    {language === "bn" ? "অন্য দপ্তরের কর্মসূচি" : "Other Dept Scheme"}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => handleOpenSuspensionRequest(exc, item)}
                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-[11px] font-bold shadow-xs transition-all"
                                    title={language === "bn" ? "বাতিলের অনুরোধ করুন" : "Request Removal"}
                                  >
                                    <Send className="w-3 h-3" />
                                    {language === "bn" ? "বাতিলের অনুরোধ করুন (Request Removal)" : "Request Removal"}
                                  </button>
                                )
                              ) : isUpazilaAdmin ? (
                                <Link
                                  href="/admin/removal-requests"
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-[11px] font-bold shadow-xs transition-all"
                                  title={language === "bn" ? "ইউএনও অনুমোদন ইনবক্স" : "UNO Approval Inbox"}
                                >
                                  <Clock className="w-3.5 h-3.5" />
                                  {language === "bn" ? "অনুমোদন ইনবক্স" : "Approval Inbox"}
                                </Link>
                              ) : isSuperAdmin ? (
                                <span className="px-2.5 py-1 rounded bg-purple-50 text-purple-700 font-bold text-[10px] border border-purple-200">
                                  {language === "bn" ? "ইউএনও'র সিদ্ধান্তের অপেক্ষায়" : "Awaiting UNO Decision"}
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 rounded bg-slate-100 text-slate-500 font-semibold text-[10px] border border-slate-200">
                                  {t.common.readOnlyNotice}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Modal: Department Officer Removal Request */}
        {showSuspensionModal && targetForRequest && (
          <div className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl max-w-xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold">
                    <Send className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      {language === "bn" ? "ভাতা বাতিলের সুপারিশ প্রেরণ (ইউএনও বরাবর)" : "Submit Benefit Removal Request"}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      {language === "bn"
                        ? "দ্বৈত সুবিধার কারণে নিজ দপ্তরের ভাতা বাতিলের জন্য উপজেলা নির্বাহী কর্মকর্তার নিকট আবেদন"
                        : "Submit recommendation to Upazila Executive Officer for removing redundant benefit"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowSuspensionModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Citizen Information Card */}
              <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-900 text-sm">{targetForRequest.beneficiaryName}</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-900">
                    {targetForRequest.unionName}, ওয়ার্ড {targetForRequest.wardNo}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-slate-600 text-[11px]">
                  <div>এনআইডি / বিআরএন: <strong className="font-mono text-slate-800">{targetForRequest.beneficiaryNid || "তথ্য নেই"}</strong></div>
                  <div>অভিভাবক: <strong className="text-slate-800">{targetForRequest.beneficiaryGuardian || "তথ্য নেই"}</strong></div>
                </div>
              </div>

              {/* Overlapping Benefits Comparison */}
              <div className="space-y-2">
                <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-indigo-600" />
                  {language === "bn" ? "নাগরিকের ওভারল্যাপিং ও সক্রিয় সুবিধাসমূহ:" : "Beneficiary's Overlapping Benefits:"}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  {/* Retained Primary Scheme */}
                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">
                        {language === "bn" ? "✓ বহাল থাকবে (মূল ভাতা)" : "✓ Retained Primary"}
                      </span>
                      <span className="font-extrabold text-emerald-800 text-xs">
                        {formatCurrency(targetForRequest.primaryScheme.monthlyAmount, language)} / মাস
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 mt-1">
                      {getSchemeName(targetForRequest.primaryScheme, language)}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {getDepartmentName(targetForRequest.primaryScheme, language)}
                    </div>
                  </div>

                  {/* Target Scheme to Remove */}
                  <div className="p-3 rounded-2xl bg-red-50/70 border border-red-200 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800">
                        {language === "bn" ? "✕ বাতিলের প্রস্তাবিত" : "✕ Target to Remove"}
                      </span>
                      <span className="font-extrabold text-red-800 text-xs">
                        {formatCurrency(targetForRequest.monthlyAmount, language)} / মাস
                      </span>
                    </div>
                    <div className="font-bold text-slate-900 mt-1">
                      {formatSchemeName(targetForRequest.schemeName, language)}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      {formatDepartmentName(targetForRequest.departmentName, language)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Reason Form */}
              <form onSubmit={handleSubmitSuspensionRequest} className="space-y-3 pt-1">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === "bn" ? "আবেদনের আদর্শ কারণ নির্বাচন করুন:" : "Select Standard Justification:"}
                  </label>
                  <select
                    onChange={(e) => setSuspensionReason(e.target.value)}
                    value={suspensionReason}
                    className="w-full p-2.5 rounded-xl border border-slate-300 text-xs text-slate-800 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {PRESET_REMOVAL_REASONS.map((reason, idx) => (
                      <option key={idx} value={reason}>
                        {reason}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === "bn" ? "বিস্তারিত বিবরণ / মন্তব্য (প্রয়োজনে সম্পাদনা করুন):" : "Detailed Justification / Remarks:"} *
                  </label>
                  <textarea
                    rows={3}
                    value={suspensionReason}
                    onChange={(e) => setSuspensionReason(e.target.value)}
                    required
                    className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 leading-relaxed"
                  />
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowSuspensionModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={submittingRequest || !suspensionReason.trim()}
                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs transition-all"
                  >
                    {submittingRequest ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}
                    {language === "bn" ? "ইউএনও'র নিকট আবেদন প্রেরণ" : "Submit Request to UNO"}
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
