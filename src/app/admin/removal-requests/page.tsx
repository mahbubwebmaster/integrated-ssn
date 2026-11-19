"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  Search,
  Filter,
  ArrowLeft,
  Building2,
  Users,
  Layers,
  AlertTriangle,
  Loader2,
  Send,
  User,
  CreditCard,
  Phone,
  Calendar,
  Check,
  X,
  RefreshCw,
  ExternalLink,
  DollarSign,
  FileSpreadsheet,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { NETROKONA_UPAZILAS } from "@/lib/netrokona";

interface EnrollmentItem {
  id: string;
  cardNumber?: string | null;
  startDate: string;
  status: string;
  scheme: {
    id: string;
    name: string;
    nameBn?: string | null;
    nameEn?: string | null;
    monthlyAmount: number;
    benefitType?: string;
    department: {
      id: string;
      name: string;
      nameBn?: string | null;
      nameEn?: string | null;
    };
  };
}

interface BeneficiaryData {
  id: string;
  fullName: string;
  nameBn?: string | null;
  nameEn?: string | null;
  fatherName?: string | null;
  guardianName: string;
  gender: string;
  nid?: string | null;
  brn?: string | null;
  mobile?: string | null;
  district?: string | null;
  upazilaName?: string | null;
  unionName: string;
  wardNo: string;
  enrollments?: EnrollmentItem[];
}

interface RemovalRequestItem {
  id: string;
  enrollmentId: string;
  beneficiaryId: string;
  departmentId: string;
  requestedByUserId: string;
  requestReason: string;
  reason?: string; // compat
  status: "PENDING" | "APPROVED" | "REJECTED" | string;
  reviewedByUserId?: string | null;
  adminComment?: string | null;
  district?: string | null;
  upazilaName?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  enrollment: EnrollmentItem;
  beneficiary: BeneficiaryData;
  department: {
    id: string;
    name: string;
    nameBn?: string | null;
    nameEn?: string | null;
  };
  requestedByUser: {
    id: string;
    name: string;
    email: string;
    designation?: string | null;
    role: string;
  };
  reviewedByUser?: {
    id: string;
    name: string;
    email: string;
    designation?: string | null;
    role: string;
  } | null;
  reviewedBy?: string | null; // compat
}

export default function RemovalRequestsApprovalInboxPage() {
  const { currentUser, isUpazilaAdmin, isSuperAdmin, isDeptOfficer } = useAuth();
  const { language, t, formatNumber, formatCurrency, getDepartmentName, getSchemeName } = useLanguage();

  const [requests, setRequests] = useState<RemovalRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedUpazila, setSelectedUpazila] = useState<string>(currentUser.upazilaName || "ALL");
  const [selectedStatusTab, setSelectedStatusTab] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("ALL");
  const [selectedDeptId, setSelectedDeptId] = useState<string>("ALL");

  useEffect(() => {
    if (currentUser.upazilaName) {
      setSelectedUpazila(currentUser.upazilaName);
    }
  }, [currentUser.upazilaName]);

  // Review & Details Modal State
  const [activeModalReq, setActiveModalReq] = useState<RemovalRequestItem | null>(null);
  const [unoComment, setUnoComment] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (selectedUpazila && selectedUpazila !== "ALL") {
        params.set("upazila", selectedUpazila);
      }
      const res = await fetch(`/api/removal-requests?${params.toString()}`);
      const data = await res.json();
      if (data.success && Array.isArray(data.requests)) {
        setRequests(data.requests);
      }
    } catch (err) {
      console.error("Failed to load removal requests:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRequests();
  }, [selectedUpazila]);

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Upazila filter
      if (selectedUpazila !== "ALL") {
        const itemUpz = req.upazilaName || req.beneficiary?.upazilaName;
        if (itemUpz && itemUpz !== selectedUpazila) {
          return false;
        }
      }
      // Status Tab filter
      if (selectedStatusTab !== "ALL" && req.status !== selectedStatusTab) {
        return false;
      }
      // Department filter
      if (selectedDeptId !== "ALL" && req.departmentId !== selectedDeptId) {
        return false;
      }
      // Search filter
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const benName = req.beneficiary?.fullName?.toLowerCase() || "";
        const nid = req.beneficiary?.nid?.toLowerCase() || "";
        const brn = req.beneficiary?.brn?.toLowerCase() || "";
        const scheme = req.enrollment?.scheme?.name?.toLowerCase() || "";
        const dept = req.department?.name?.toLowerCase() || "";
        const officer = req.requestedByUser?.name?.toLowerCase() || "";
        return (
          benName.includes(q) ||
          nid.includes(q) ||
          brn.includes(q) ||
          scheme.includes(q) ||
          dept.includes(q) ||
          officer.includes(q)
        );
      }
      return true;
    });
  }, [requests, selectedStatusTab, selectedDeptId, search]);

  // Distinct departments for filter
  const departmentsList = useMemo(() => {
    const map = new Map<string, { id: string; name: string; nameBn?: string | null; nameEn?: string | null }>();
    requests.forEach((r) => {
      if (r.department) {
        map.set(r.department.id, r.department);
      }
    });
    return Array.from(map.values());
  }, [requests]);

  // Summary counts
  const summary = useMemo(() => {
    const total = requests.length;
    const pending = requests.filter((r) => r.status === "PENDING").length;
    const approved = requests.filter((r) => r.status === "APPROVED").length;
    const rejected = requests.filter((r) => r.status === "REJECTED").length;
    return { total, pending, approved, rejected };
  }, [requests]);

  // Review handler (Approve / Reject)
  const handleReviewDecision = async (status: "APPROVED" | "REJECTED") => {
    if (!activeModalReq) return;
    if (!unoComment.trim()) {
      alert(
        language === "bn"
          ? "উপজেলা নির্বাহী কর্মকর্তার মন্তব্য (Official Comment) প্রদান বাধ্যতামূলক।"
          : "Administrative comment is strictly mandatory before decision."
      );
      return;
    }

    try {
      setReviewing(true);
      const res = await fetch(`/api/removal-requests/${activeModalReq.id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminComment: unoComment.trim(),
          reviewerUserId: currentUser.id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setActiveModalReq(null);
        setUnoComment("");
        setActionSuccessMessage(
          status === "APPROVED"
            ? language === "bn"
              ? `আবেদনটি সফলভাবে অনুমোদিত হয়েছে এবং সুবিধাভোগী উক্ত ভাতা থেকে বাদ পড়েছেন।`
              : `Removal request successfully approved. Benefit has been suspended.`
            : language === "bn"
            ? `আবেদনটি সফলভাবে নামঞ্জুর/প্রত্যাখ্যান করা হয়েছে।`
            : `Removal request has been rejected.`
        );
        setTimeout(() => setActionSuccessMessage(null), 6000);
        await fetchRequests();
      } else {
        alert(data.error || "কার্যক্রম সম্পন্ন করা সম্ভব হয়নি।");
      }
    } catch (err) {
      console.error("Error executing review:", err);
      alert(language === "bn" ? "সার্ভার ত্রুটি ঘটেছে।" : "Error submitting decision.");
    } finally {
      setReviewing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Navigation & Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2">
              <Link
                href="/duplicates"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                {language === "bn" ? "ডুপ্লিকেট তালিকায় ফিরুন" : "Back to Duplicates"}
              </Link>
              <span className="text-slate-300">•</span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                {language === "bn" ? "ইউএনও প্রশাসনিক অনুমোদন ইনবক্স" : "UNO Approval Inbox"}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3 mt-1.5">
              <ShieldCheck className="w-8 h-8 text-amber-600" />
              {language === "bn" ? "ভাতা বাতিলের সুপারিশ ও অনুমোদন ইনবক্স" : "Benefit Removal Requests & Approval Inbox"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-600 mt-1 max-w-3xl">
              {language === "bn"
                ? "দপ্তর কর্মকর্তাদের প্রেরিত ভাতা বাতিলের আবেদনসমূহ পর্যালোচনা, সুবিধাভোগীর সকল সমকালীন সুবিধা যাচাই এবং প্রশাসনিক সিদ্ধান্ত প্রদান।"
                : "Review removal requests submitted by department officers, inspect overlapping safety net entitlements, and execute official UNO decisions."}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={fetchRequests}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-50 shadow-xs transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-slate-500 ${loading ? "animate-spin" : ""}`} />
              {language === "bn" ? "হালনাগাদ করুন" : "Refresh"}
            </button>
          </div>
        </div>

        {/* Administrative Jurisdiction Banner */}
        {currentUser.upazilaName ? (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-600 animate-pulse shrink-0" />
              <span>
                {language === "bn"
                  ? `প্রশাসনিক অধিক্ষেত্র: ${currentUser.upazilaName} উপজেলা, নেত্রকোণা জেলা`
                  : `Administrative Jurisdiction: ${currentUser.upazilaName} Upazila, Netrokona District`}
              </span>
            </div>
            <span className="text-[11px] text-amber-800 font-semibold bg-amber-100/70 px-2 py-0.5 rounded-lg border border-amber-300/60">
              {language === "bn"
                ? `শুধুমাত্র ${currentUser.upazilaName} উপজেলার আবেদন আপনার পর্যালোচনা ও অনুমোদনাধীন`
                : `Actionable strictly within ${currentUser.upazilaName} jurisdiction`}
            </span>
          </div>
        ) : isSuperAdmin ? (
          <div className="p-3.5 rounded-2xl bg-purple-50 border border-purple-300 text-purple-950 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 shadow-xs">
            <div className="flex items-center gap-2 font-bold">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-600 shrink-0" />
              <span>
                {language === "bn"
                  ? "জেলা প্রশাসন অধিক্ষেত্র: সমগ্র নেত্রকোণা জেলা (১০টি উপজেলার ভাতা বাতিলের আবেদন সামগ্রিক পর্যবেক্ষণ)"
                  : "District Administration: All 10 Upazilas of Netrokona District (Oversight Mode)"}
              </span>
            </div>
            <span className="text-[11px] text-purple-800 font-semibold bg-purple-100/70 px-2 py-0.5 rounded-lg border border-purple-300/60">
              {language === "bn" ? "জেলা প্রশাসক ওভারসাইট মোড" : "District Oversight Mode"}
            </span>
          </div>
        ) : null}

        {/* Success Alert Banner */}
        {actionSuccessMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs font-bold flex items-center justify-between shadow-xs animate-in fade-in">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{actionSuccessMessage}</span>
            </div>
            <button
              onClick={() => setActionSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 text-xs"
            >
              ✕
            </button>
          </div>
        )}

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500">{language === "bn" ? "মোট আবেদন" : "Total Requests"}</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900">{formatNumber(summary.total, language)}</div>
            <div className="text-[11px] text-slate-400">{language === "bn" ? "সকল দপ্তর থেকে জমা" : "From all departments"}</div>
          </div>

          <div className="bg-amber-50/60 p-4 sm:p-5 rounded-2xl border border-amber-300 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900">{language === "bn" ? "অপেক্ষমান অনুমোদন" : "Pending Decisions"}</span>
              <Clock className="w-4 h-4 text-amber-600 animate-pulse" />
            </div>
            <div className="text-2xl font-black text-amber-900">{formatNumber(summary.pending, language)}</div>
            <div className="text-[11px] text-amber-800 font-medium">
              {language === "bn" ? "ইউএনও'র সিদ্ধান্তের অপেক্ষায়" : "Awaiting UNO decision"}
            </div>
          </div>

          <div className="bg-emerald-50/60 p-4 sm:p-5 rounded-2xl border border-emerald-300 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900">{language === "bn" ? "অনুমোদিত ও বাতিলকৃত" : "Approved & Suspended"}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="text-2xl font-black text-emerald-900">{formatNumber(summary.approved, language)}</div>
            <div className="text-[11px] text-emerald-800 font-medium">
              {language === "bn" ? "ভাতা কার্যকরভাবে স্থগিত" : "Benefit suspended in DB"}
            </div>
          </div>

          <div className="bg-red-50/60 p-4 sm:p-5 rounded-2xl border border-red-300 shadow-xs space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-red-900">{language === "bn" ? "প্রত্যাখ্যাত আবেদন" : "Rejected Requests"}</span>
              <XCircle className="w-4 h-4 text-red-600" />
            </div>
            <div className="text-2xl font-black text-red-900">{formatNumber(summary.rejected, language)}</div>
            <div className="text-[11px] text-red-800 font-medium">
              {language === "bn" ? "ভাতা বহাল রাখা হয়েছে" : "Benefit kept active"}
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-4">
          {/* Status Tabs */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl gap-1 shrink-0 overflow-x-auto">
            <button
              onClick={() => setSelectedStatusTab("ALL")}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg font-bold transition-all whitespace-nowrap cursor-pointer ${
                selectedStatusTab === "ALL" ? "bg-white text-slate-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {language === "bn" ? "সকল আবেদন" : "All"} ({formatNumber(summary.total, language)})
            </button>
            <button
              onClick={() => setSelectedStatusTab("PENDING")}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                selectedStatusTab === "PENDING"
                  ? "bg-amber-600 text-white shadow-xs"
                  : "text-amber-800 hover:text-amber-950"
              }`}
            >
              <Clock className="w-3 h-3" />
              {language === "bn" ? "অপেক্ষমান" : "Pending"} ({formatNumber(summary.pending, language)})
            </button>
            <button
              onClick={() => setSelectedStatusTab("APPROVED")}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                selectedStatusTab === "APPROVED"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "text-emerald-800 hover:text-emerald-950"
              }`}
            >
              <Check className="w-3 h-3" />
              {language === "bn" ? "অনুমোদিত" : "Approved"} ({formatNumber(summary.approved, language)})
            </button>
            <button
              onClick={() => setSelectedStatusTab("REJECTED")}
              className={`min-h-[38px] px-3.5 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                selectedStatusTab === "REJECTED" ? "bg-red-700 text-white shadow-xs" : "text-red-700 hover:text-red-950"
              }`}
            >
              <X className="w-3 h-3" />
              {language === "bn" ? "প্রত্যাখ্যাত" : "Rejected"} ({formatNumber(summary.rejected, language)})
            </button>
          </div>

          {/* Filter Bar with grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 w-full">
            {/* Upazila Filter (Netrokona) */}
            <div className="relative">
              <select
                value={selectedUpazila}
                onChange={(e) => setSelectedUpazila(e.target.value)}
                disabled={Boolean(currentUser.upazilaName)}
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-xs sm:text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-amber-500 ${
                  currentUser.upazilaName
                    ? "bg-slate-100 border-slate-300 text-slate-700 cursor-not-allowed"
                    : "bg-white border-slate-300 text-slate-800"
                }`}
              >
                <option value="ALL">{language === "bn" ? "সকল উপজেলা (নেত্রকোণা)" : "All Upazilas"}</option>
                {NETROKONA_UPAZILAS.map((upz) => (
                  <option key={upz.key} value={upz.nameBn}>
                    {upz.nameBn}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div className="relative">
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium text-xs sm:text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-500"
              >
                <option value="ALL">{language === "bn" ? "সকল দপ্তর" : "All Departments"}</option>
                {departmentsList.map((d) => (
                  <option key={d.id} value={d.id}>
                    {getDepartmentName(d, language)}
                  </option>
                ))}
              </select>
            </div>

            {/* Search Input */}
            <div className="relative sm:col-span-2">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={language === "bn" ? "নাগরিক, এনআইডি, বা কর্মসূচি খুঁজুন..." : "Search citizen, NID, scheme..."}
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 bg-white"
              />
            </div>
          </div>
        </div>

        {/* Requests Table */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
          {loading ? (
            <div className="p-16 text-center text-xs text-slate-400 space-y-2">
              <Loader2 className="w-8 h-8 animate-spin mx-auto text-amber-600" />
              <p>{t.common.loading}</p>
            </div>
          ) : filteredRequests.length === 0 ? (
            <div className="p-16 text-center text-xs text-slate-500 space-y-2">
              <ShieldCheck className="w-10 h-10 mx-auto text-slate-300" />
              <p className="font-bold text-slate-700 text-sm">
                {language === "bn" ? "কোনো আবেদন পাওয়া যায়নি" : "No Removal Requests Found"}
              </p>
              <p className="text-slate-400 text-xs">
                {language === "bn"
                  ? "নির্বাচিত ফিল্টারে এই মুহূর্তে কোনো ভাতা বাতিলের আবেদন নেই।"
                  : "No requests matching the selected filters at this time."}
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                <thead className="bg-slate-900 text-white font-semibold text-[11px] uppercase tracking-wider whitespace-nowrap">
                  <tr>
                    <th className="py-3.5 px-4">{language === "bn" ? "সুবিধাভোগীর নাম ও পরিচয়" : "Beneficiary Details"}</th>
                    <th className="py-3.5 px-4">{language === "bn" ? "আবেদনকারী দপ্তর ও কর্মকর্তা" : "Requesting Dept & Officer"}</th>
                    <th className="py-3.5 px-4">{language === "bn" ? "প্রস্তাবিত বাতিলযোগ্য ভাতা" : "Proposed Scheme to Remove"}</th>
                    <th className="py-3.5 px-4">{language === "bn" ? "মাসিক অর্থ" : "Monthly Amount"}</th>
                    <th className="py-3.5 px-4">{language === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                    <th className="py-3.5 px-4 text-right">{language === "bn" ? "পদক্ষেপ" : "Action"}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {filteredRequests.map((req) => (
                    <tr key={req.id} className="hover:bg-amber-50/20 transition-colors">
                      {/* 1. Beneficiary */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900 text-sm">{req.beneficiary.fullName}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5 space-x-1.5">
                          <span>NID: <strong className="font-mono text-slate-700">{req.beneficiary.nid || "N/A"}</strong></span>
                          <span>•</span>
                          <span>{req.upazilaName || req.beneficiary.upazilaName || "নেত্রকোণা সদর"}, {req.beneficiary.unionName}, ওয়ার্ড {req.beneficiary.wardNo} • {req.beneficiary.district || "নেত্রকোণা"}</span>
                        </div>
                      </td>

                      {/* 2. Department & Officer */}
                      <td className="py-3.5 px-4">
                        <div className="font-semibold text-slate-900">
                          {getDepartmentName(req.department, language)}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {req.requestedByUser?.name}{" "}
                          <span className="text-slate-400">
                            ({new Date(req.createdAt).toLocaleDateString(language === "bn" ? "bn-BD" : "en-US")})
                          </span>
                        </div>
                      </td>

                      {/* 3. Scheme */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {getSchemeName(req.enrollment.scheme, language)}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {req.enrollment.cardNumber && `কার্ড: ${req.enrollment.cardNumber}`}
                        </div>
                      </td>

                      {/* 4. Monthly Amount */}
                      <td className="py-3.5 px-4 font-black text-red-700">
                        {formatCurrency(req.enrollment.scheme.monthlyAmount, language)} / মাস
                      </td>

                      {/* 5. Status Badge */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                            req.status === "PENDING"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : req.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                              : "bg-red-100 text-red-900 border border-red-300"
                          }`}
                        >
                          {req.status === "PENDING" ? (
                            <>
                              <Clock className="w-3 h-3 text-amber-700 animate-pulse" />
                              {language === "bn" ? "অপেক্ষমান" : "Pending"}
                            </>
                          ) : req.status === "APPROVED" ? (
                            <>
                              <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                              {language === "bn" ? "অনুমোদিত" : "Approved"}
                            </>
                          ) : (
                            <>
                              <XCircle className="w-3 h-3 text-red-700" />
                              {language === "bn" ? "প্রত্যাখ্যাত" : "Rejected"}
                            </>
                          )}
                        </span>
                      </td>

                      {/* 6. Action Button */}
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => {
                            setActiveModalReq(req);
                            setUnoComment(req.adminComment || "");
                          }}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold shadow-xs transition-all ${
                            req.status === "PENDING" && isUpazilaAdmin
                              ? "bg-amber-600 hover:bg-amber-700 text-white"
                              : "bg-slate-800 hover:bg-slate-900 text-white"
                          }`}
                        >
                          {req.status === "PENDING" && isUpazilaAdmin ? (
                            <>
                              <ShieldCheck className="w-3.5 h-3.5 text-amber-200" />
                              {language === "bn" ? "বিস্তারিত ও সিদ্ধান্ত" : "Review & Decide"}
                            </>
                          ) : (
                            <>
                              <ExternalLink className="w-3.5 h-3.5 text-slate-300" />
                              {language === "bn" ? "বিস্তারিত দেখুন" : "View Details"}
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 3. Comprehensive Request Details & Approval Modal */}
        {activeModalReq && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-3xl w-[95vw] p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center font-bold shrink-0">
                    <ShieldCheck className="w-6 h-6 text-amber-700" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm sm:text-base font-black text-slate-900">
                        {language === "bn" ? "ভাতা বাতিলের অনুরোধের বিস্তারিত ও পর্যালোচনা" : "Removal Request Review & Decision"}
                      </h3>
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          activeModalReq.status === "PENDING"
                            ? "bg-amber-100 text-amber-900 border border-amber-300"
                            : activeModalReq.status === "APPROVED"
                            ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                            : "bg-red-100 text-red-900 border border-red-300"
                        }`}
                      >
                        {activeModalReq.status === "PENDING"
                          ? language === "bn" ? "অপেক্ষমান" : "Pending"
                          : activeModalReq.status === "APPROVED"
                          ? language === "bn" ? "অনুমোদিত" : "Approved"
                          : language === "bn" ? "প্রত্যাখ্যাত" : "Rejected"}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                      {language === "bn"
                        ? "নাগরিকের সকল সক্রিয় সরকারি সুযোগ-সুবিধা এবং দপ্তরের সুপারিশ পুঙ্খানুপুঙ্খভাবে যাচাই করুন"
                        : "Compare concurrent safety net enrollments and execute administrative determination"}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setActiveModalReq(null);
                    setUnoComment("");
                  }}
                  className="text-slate-400 hover:text-slate-600 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* a) Full Beneficiary Profile */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 font-bold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <User className="w-4 h-4 text-purple-700" />
                    {language === "bn" ? "সুবিধাভোগীর পরিচিতি প্রোফাইল" : "Beneficiary Profile"}
                  </span>
                  <span className="text-purple-800 font-extrabold text-sm">{activeModalReq.beneficiary.fullName}</span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">{language === "bn" ? "পিতা / স্বামীর নাম:" : "Father/Husband Name:"}</span>
                    <strong className="text-slate-800">{activeModalReq.beneficiary.fatherName || activeModalReq.beneficiary.guardianName || "তথ্য নেই"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">{language === "bn" ? "জাতীয় পরিচয়পত্র (NID):" : "NID:"}</span>
                    <strong className="font-mono text-slate-800">{activeModalReq.beneficiary.nid || "তথ্য নেই"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">{language === "bn" ? "জন্ম নিবন্ধন (BRN):" : "BRN:"}</span>
                    <strong className="font-mono text-slate-800">{activeModalReq.beneficiary.brn || "তথ্য নেই"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">{language === "bn" ? "মোবাইল নম্বর:" : "Mobile:"}</span>
                    <strong className="font-mono text-slate-800">{activeModalReq.beneficiary.mobile || "তথ্য নেই"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">{language === "bn" ? "ঠিকানা (উপজেলা ও ইউনিয়ন):" : "Address:"}</span>
                    <strong className="text-slate-800">{activeModalReq.upazilaName || activeModalReq.beneficiary.upazilaName || "নেত্রকোণা সদর"}, {activeModalReq.beneficiary.unionName}, ওয়ার্ড {activeModalReq.beneficiary.wardNo} • {activeModalReq.beneficiary.district || "নেত্রকোণা"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">{language === "bn" ? "লিঙ্গ:" : "Gender:"}</span>
                    <strong className="text-slate-800">{activeModalReq.beneficiary.gender}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">{language === "bn" ? "আবেদনকারী দপ্তর:" : "Requesting Dept:"}</span>
                    <strong className="text-slate-800">{getDepartmentName(activeModalReq.department, language)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">{language === "bn" ? "আবেদনের তারিখ:" : "Submitted At:"}</span>
                    <strong className="text-slate-800">{new Date(activeModalReq.createdAt).toLocaleDateString(language === "bn" ? "bn-BD" : "en-US")}</strong>
                  </div>
                </div>
              </div>

              {/* b) Side-by-side comparison of ALL active benefits */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-black text-slate-900 flex items-center gap-1.5 uppercase tracking-wide">
                    <Layers className="w-4 h-4 text-amber-600" />
                    {language === "bn" ? "সকল দপ্তরের সক্রিয় সুবিধাসমূহের তুলনামূলক বিবরণ:" : "Comparison of ALL Active Benefits Across Departments:"}
                  </div>
                  <span className="text-[11px] font-bold text-red-700 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                    {language === "bn" ? "অননুমোদিত দ্বৈত অন্তর্ভুক্তি শনাক্ত" : "Concurrent Redundant Benefits Detected"}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                  {/* Map through all enrollments this beneficiary currently has */}
                  {activeModalReq.beneficiary?.enrollments && activeModalReq.beneficiary.enrollments.length > 0 ? (
                    activeModalReq.beneficiary.enrollments.map((enr) => {
                      const isTarget = enr.id === activeModalReq.enrollmentId;

                      return (
                        <div
                          key={enr.id}
                          className={`p-3.5 rounded-2xl border transition-all ${
                            isTarget
                              ? "bg-red-50/80 border-red-300 ring-2 ring-red-400/20"
                              : enr.status === "Suspended" || enr.status === "SUSPENDED"
                              ? "bg-slate-100 border-slate-200 opacity-60"
                              : "bg-emerald-50/80 border-emerald-300"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                isTarget
                                  ? "bg-red-200 text-red-900"
                                  : enr.status === "Suspended" || enr.status === "SUSPENDED"
                                  ? "bg-slate-200 text-slate-600"
                                  : "bg-emerald-200 text-emerald-900"
                              }`}
                            >
                              {isTarget
                                ? language === "bn" ? "✕ বাতিলের প্রস্তাবিত ভাতা" : "✕ Proposed for Removal"
                                : enr.status === "Suspended" || enr.status === "SUSPENDED"
                                ? language === "bn" ? "স্থগিতকৃত" : "Suspended"
                                : language === "bn" ? "✓ বহাল থাকবে (মূল ভাতা)" : "✓ Retained Primary Benefit"}
                            </span>

                            <span
                              className={`font-black text-sm ${
                                isTarget ? "text-red-700" : "text-emerald-800"
                              }`}
                            >
                              {formatCurrency(enr.scheme.monthlyAmount, language)} / মাস
                            </span>
                          </div>

                          <div className="font-bold text-slate-900 text-sm mt-2">
                            {getSchemeName(enr.scheme, language)}
                          </div>
                          <div className="text-[11px] text-slate-600 mt-0.5">
                            {getDepartmentName(enr.scheme.department, language)}
                            {enr.cardNumber && ` • কার্ড: ${enr.cardNumber}`}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    // Fallback to activeModalReq.enrollment if beneficiary.enrollments array is empty
                    <div className="p-3.5 rounded-2xl bg-red-50/80 border border-red-300 col-span-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 rounded text-[10px] font-black bg-red-200 text-red-900">
                          {language === "bn" ? "✕ বাতিলের প্রস্তাবিত ভাতা" : "✕ Proposed for Removal"}
                        </span>
                        <span className="font-black text-sm text-red-700">
                          {formatCurrency(activeModalReq.enrollment.scheme.monthlyAmount, language)} / মাস
                        </span>
                      </div>
                      <div className="font-bold text-slate-900 text-sm mt-2">
                        {getSchemeName(activeModalReq.enrollment.scheme, language)}
                      </div>
                      <div className="text-[11px] text-slate-600 mt-0.5">
                        {getDepartmentName(activeModalReq.department, language)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* c) The Department Officer's Submitted Reason */}
              <div className="p-4 rounded-2xl bg-blue-50/60 border border-blue-200 space-y-1.5 text-xs">
                <div className="flex items-center justify-between font-bold text-blue-950">
                  <span className="flex items-center gap-1.5">
                    <Send className="w-3.5 h-3.5 text-blue-700" />
                    {language === "bn" ? "দপ্তর কর্মকর্তার সুপারিশ ও কারণ:" : "Department Officer Recommendation:"}
                  </span>
                  <span className="text-[11px] font-normal text-slate-500">
                    {new Date(activeModalReq.createdAt).toLocaleString(language === "bn" ? "bn-BD" : "en-US")}
                  </span>
                </div>
                <div className="bg-white p-3 rounded-xl border border-blue-100 text-slate-800 text-xs leading-relaxed font-medium">
                  "{activeModalReq.requestReason || activeModalReq.reason}"
                </div>
                <div className="text-[11px] text-slate-500">
                  {language === "bn" ? "সুপারিশকারী:" : "Submitted By:"}{" "}
                  <strong className="text-slate-800">{activeModalReq.requestedByUser?.name}</strong>{" "}
                  ({activeModalReq.requestedByUser?.designation || activeModalReq.requestedByUser?.role})
                </div>
              </div>

              {/* Past Review Information if already finalized */}
              {activeModalReq.status !== "PENDING" && (
                <div className="p-4 rounded-2xl bg-slate-100 border border-slate-300 text-xs space-y-1">
                  <div className="font-bold text-slate-900 flex items-center justify-between">
                    <span>{language === "bn" ? "প্রদত্ত প্রশাসনিক সিদ্ধান্ত ও মন্তব্য:" : "Official Decision & Remarks:"}</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      {activeModalReq.reviewedAt ? new Date(activeModalReq.reviewedAt).toLocaleString(language === "bn" ? "bn-BD" : "en-US") : ""}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200 text-slate-800 text-xs font-semibold">
                    "{activeModalReq.adminComment || "কোনো মন্তব্য লেখা হয়নি"}"
                  </div>
                  <div className="text-[11px] text-slate-600">
                    {language === "bn" ? "সিদ্ধান্ত প্রদানকারী:" : "Decided By:"}{" "}
                    <strong>{activeModalReq.reviewedByUser?.name || activeModalReq.reviewedBy || "উপজেলা নির্বাহী কর্মকর্তা"}</strong>
                  </div>
                </div>
              )}

              {/* d) Mandatory Comment & Actions for PENDING */}
              {activeModalReq.status === "PENDING" && (
                <>
                  {isUpazilaAdmin ? (
                    <div className="space-y-3 pt-3 border-t border-slate-200">
                      <div>
                        <label className="block font-bold text-slate-900 text-xs mb-1">
                          {language === "bn"
                            ? "উপজেলা নির্বাহী অফিসারের মন্তব্য (Official Comment) *"
                            : "Upazila Executive Officer Official Comment (Mandatory) *"}
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={unoComment}
                          onChange={(e) => setUnoComment(e.target.value)}
                          placeholder={
                            language === "bn"
                              ? "যাচাইান্তে দ্বৈত ভাতা গ্রহণ নিশ্চিত হওয়ায় অত্র দপ্তরের ভাতা বাতিলের সুপারিশ অনুমোদন করা হলো..."
                              : "Enter official administrative reason for approving or rejecting this benefit removal..."
                          }
                          className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500 leading-relaxed font-medium"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          {language === "bn"
                            ? "⚠️ মন্তব্য ছাড়া অনুমোদন বা প্রত্যাখ্যানের বাটন সক্রিয় হবে না। অনুমোদন করলে সুবিধাভোগী উক্ত কর্মসূচি থেকে বাদ পড়বেন।"
                            : "⚠️ Comment is mandatory. Action buttons remain disabled until a valid comment is written."}
                        </p>
                      </div>

                      <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveModalReq(null);
                            setUnoComment("");
                          }}
                          className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors flex items-center justify-center cursor-pointer"
                        >
                          {t.common.cancel}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReviewDecision("REJECTED")}
                          disabled={reviewing || !unoComment.trim()}
                          className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-red-700 hover:bg-red-800 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold shadow-xs transition-all whitespace-nowrap cursor-pointer"
                        >
                          {reviewing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <XCircle className="w-4 h-4" />
                          )}
                          {language === "bn" ? "অনুরোধ নামঞ্জুর করুন (Reject)" : "Reject Request"}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReviewDecision("APPROVED")}
                          disabled={reviewing || !unoComment.trim()}
                          className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold shadow-xs transition-all whitespace-nowrap cursor-pointer"
                        >
                          {reviewing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4" />
                          )}
                          {language === "bn" ? "অনুমোদন ও সুবিধা বাতিল করুন" : "Approve & Cancel"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>
                          {language === "bn"
                            ? "নীতিমালা অনুযায়ী শুধুমাত্র উপজেলা নির্বাহী কর্মকর্তা (উপজেলা এডমিন) প্রশাসনিক মন্তব্য সহ ভাতা বাতিলের অনুমোদন দিতে পারেন।"
                            : "Governance restriction: Only Upazila Admin (UNO) can approve removal requests with administrative comments."}
                        </span>
                      </div>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveModalReq(null);
                            setUnoComment("");
                          }}
                          className="px-4 py-2 rounded-xl bg-slate-800 text-white font-medium text-xs hover:bg-slate-900"
                        >
                          {language === "bn" ? "বন্ধ করুন" : "Close"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
