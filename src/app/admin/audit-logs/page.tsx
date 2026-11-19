"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import {
  History,
  FileSpreadsheet,
  ShieldCheck,
  RotateCcw,
  AlertTriangle,
  Search,
  Filter,
  CheckCircle2,
  X,
  Loader2,
  Building2,
  Layers,
  UserCheck,
  Calendar,
  Clock,
  ArrowLeft,
  UploadCloud,
  FileText,
  Ban,
  Activity,
  Globe,
  RefreshCw,
  Info,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

interface UploadBatchItem {
  id: string;
  batchCode: string;
  fileName: string;
  departmentId: string;
  schemeId: string;
  totalRecords: number;
  uploadedByUserId: string;
  status: "ACTIVE" | "ROLLED_BACK";
  createdAt: string;
  department: {
    id: string;
    name: string;
    nameBn?: string | null;
    nameEn?: string | null;
  };
  scheme: {
    id: string;
    name: string;
    nameBn?: string | null;
    nameEn?: string | null;
  };
  uploadedByUser?: {
    id: string;
    name: string;
    email: string;
    designation?: string | null;
    role: string;
  } | null;
  _count?: {
    enrollments: number;
  };
}

interface AuditLogItem {
  id: string;
  userId: string;
  actionType: string;
  entityId?: string | null;
  details: string;
  ipAddress?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name: string;
    email: string;
    designation?: string | null;
    role: string;
  } | null;
}

export default function AuditLogsPage() {
  const { currentUser, isSuperAdmin, isDeptOfficer, isUnionViewer } = useAuth();
  const { language, t, formatNumber, getDepartmentName, getSchemeName } = useLanguage();

  const [activeTab, setActiveTab] = useState<"batches" | "audit">("batches");

  // Batches State
  const [batches, setBatches] = useState<UploadBatchItem[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(true);
  const [batchSearch, setBatchSearch] = useState("");
  const [batchStatusFilter, setBatchStatusFilter] = useState("ALL");

  // Rollback Modal State
  const [targetBatchForRollback, setTargetBatchForRollback] = useState<UploadBatchItem | null>(null);
  const [rollingBack, setRollingBack] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Audit Logs State
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [auditSearch, setAuditSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("ALL");

  // Load Batches
  const fetchBatches = useCallback(async () => {
    try {
      setLoadingBatches(true);
      const res = await fetch("/api/batches");
      const data = await res.json();
      if (data.success && Array.isArray(data.batches)) {
        setBatches(data.batches);
      }
    } catch (err) {
      console.error("Failed to load batches:", err);
    } finally {
      setLoadingBatches(false);
    }
  }, []);

  // Load Audit Logs (for Super Admin)
  const fetchAuditLogs = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      setLoadingLogs(true);
      const res = await fetch("/api/audit-logs");
      const data = await res.json();
      if (data.success && Array.isArray(data.logs)) {
        setAuditLogs(data.logs);
      }
    } catch (err) {
      console.error("Failed to load audit logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, [isSuperAdmin]);

  useEffect(() => {
    fetchBatches();
    if (isSuperAdmin) {
      fetchAuditLogs();
    }
  }, [fetchBatches, fetchAuditLogs, isSuperAdmin]);

  // Execute Rollback
  const handleConfirmRollback = async () => {
    if (!targetBatchForRollback) return;
    try {
      setRollingBack(true);
      setErrorMessage(null);

      const res = await fetch(`/api/batches/${targetBatchForRollback.id}/rollback`, {
        method: "POST",
      });
      const data = await res.json();

      if (data.success) {
        setToastMessage(
          language === "bn"
            ? `ব্যাচ ${targetBatchForRollback.batchCode} সফলভাবে রোলব্যাক করা হয়েছে। ${formatNumber(data.deletedEnrollmentsCount || 0, language)}টি রেকর্ড অপসারিত হয়েছে।`
            : `Batch ${targetBatchForRollback.batchCode} was rolled back successfully. Removed ${data.deletedEnrollmentsCount || 0} records.`
        );
        setTargetBatchForRollback(null);
        await fetchBatches();
        if (isSuperAdmin) {
          await fetchAuditLogs();
        }
      } else {
        setErrorMessage(data.error || (language === "bn" ? "রোলব্যাক সম্পন্ন করা যায়নি।" : "Rollback failed."));
      }
    } catch (err) {
      console.error("Rollback execution error:", err);
      setErrorMessage(language === "bn" ? "সার্ভার বা নেটওয়ার্ক সমস্যা হয়েছে।" : "Server error during rollback.");
    } finally {
      setRollingBack(false);
    }
  };

  // Filtered Batches
  const filteredBatches = useMemo(() => {
    return batches.filter((b) => {
      const q = batchSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        b.batchCode.toLowerCase().includes(q) ||
        b.fileName.toLowerCase().includes(q) ||
        b.department.name.toLowerCase().includes(q) ||
        (b.department.nameBn && b.department.nameBn.toLowerCase().includes(q)) ||
        b.scheme.name.toLowerCase().includes(q) ||
        (b.scheme.nameBn && b.scheme.nameBn.toLowerCase().includes(q)) ||
        (b.uploadedByUser?.name && b.uploadedByUser.name.toLowerCase().includes(q));

      const matchesStatus =
        batchStatusFilter === "ALL" || b.status === batchStatusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [batches, batchSearch, batchStatusFilter]);

  // Filtered Audit Logs
  const filteredAuditLogs = useMemo(() => {
    return auditLogs.filter((l) => {
      const q = auditSearch.toLowerCase().trim();
      const matchesSearch =
        !q ||
        l.details.toLowerCase().includes(q) ||
        l.actionType.toLowerCase().includes(q) ||
        (l.user?.name && l.user.name.toLowerCase().includes(q)) ||
        (l.user?.email && l.user.email.toLowerCase().includes(q)) ||
        (l.ipAddress && l.ipAddress.toLowerCase().includes(q));

      const matchesAction =
        actionFilter === "ALL" || l.actionType === actionFilter;

      return matchesSearch && matchesAction;
    });
  }, [auditLogs, auditSearch, actionFilter]);

  // Check if current user is eligible to rollback a specific batch
  const canRollbackBatch = (b: UploadBatchItem) => {
    if (b.status !== "ACTIVE") return false;
    if (isSuperAdmin) return true;
    if (isDeptOfficer) {
      const isUploader = b.uploadedByUserId === currentUser.id;
      const elapsedHours = (Date.now() - new Date(b.createdAt).getTime()) / (1000 * 60 * 60);
      return isUploader && elapsedHours <= 24;
    }
    return false;
  };

  const activeBatchesCount = batches.filter((b) => b.status === "ACTIVE").length;
  const rolledBackCount = batches.filter((b) => b.status === "ROLLED_BACK").length;
  const totalUploadedRecords = batches
    .filter((b) => b.status === "ACTIVE")
    .reduce((acc, curr) => acc + curr.totalRecords, 0);

  // If Union Viewer, block access
  if (isUnionViewer) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <Ban className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">{t.common.unauthorized}</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {language === "bn"
              ? "এই পৃষ্ঠাটি শুধুমাত্র দপ্তর কর্মকর্তা ও সুপার অ্যাডমিন অ্যাকাউন্টের জন্য সংরক্ষিত।"
              : "This page is restricted to Department Officers and Super Admins."}
          </p>
          <div className="pt-2">
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition-all shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              {t.upload.returnDashboard}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Toast / Error Messages */}
        {toastMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="p-4 rounded-2xl bg-red-50 border border-red-300 text-red-900 flex items-center justify-between shadow-xs animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-bold">
              <AlertTriangle className="w-4 h-4 text-red-700" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header Bar */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-50 border border-blue-200 text-xs font-semibold text-blue-900 mb-2">
                <History className="w-3.5 h-3.5 text-blue-700" />
                <span>{language === "bn" ? "ডাটা ব্যবস্থাপনা ও নিরাপত্তা" : "Data Management & Audit Trail"}</span>
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {language === "bn" ? "ব্যাচ হিস্ট্রি ও অডিট ট্রেইল" : "Batch History & Audit Logs"}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {language === "bn"
                  ? "সকল এক্সেল আপলোড ব্যাচ পর্যবেক্ষণ, অনাকাঙ্ক্ষিত আপলোড প্রত্যাহার (রোলব্যাক) এবং কেন্দ্রীয় সিস্টেম অডিট লগ।"
                  : "Inspect uploaded Excel batches, perform instant rollback of accidental imports, and review system audit trails."}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => {
                  fetchBatches();
                  if (isSuperAdmin) fetchAuditLogs();
                }}
                disabled={loadingBatches || loadingLogs}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingBatches || loadingLogs ? "animate-spin" : ""}`} />
                <span>{language === "bn" ? "রিফ্রেশ" : "Refresh"}</span>
              </button>

              <Link
                href="/upload"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-xs transition-all"
              >
                <UploadCloud className="w-4 h-4" />
                <span>{language === "bn" ? "নতুন এক্সেল আপলোড" : "New Excel Upload"}</span>
              </Link>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="text-slate-500 font-semibold uppercase text-[10px]">
                {language === "bn" ? "মোট আপলোড ব্যাচ" : "Total Batches"}
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatNumber(batches.length, language)}
              </div>
            </div>
            <div className="bg-emerald-50/70 p-3.5 rounded-2xl border border-emerald-200">
              <div className="text-emerald-700 font-semibold uppercase text-[10px]">
                {language === "bn" ? "সক্রিয় ব্যাচসমূহ" : "Active Batches"}
              </div>
              <div className="text-xl font-black text-emerald-900 mt-1">
                {formatNumber(activeBatchesCount, language)}
              </div>
            </div>
            <div className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200">
              <div className="text-rose-700 font-semibold uppercase text-[10px]">
                {language === "bn" ? "প্রত্যাহারকৃত (রোলব্যাক)" : "Rolled Back"}
              </div>
              <div className="text-xl font-black text-rose-900 mt-1">
                {formatNumber(rolledBackCount, language)}
              </div>
            </div>
            <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200">
              <div className="text-blue-700 font-semibold uppercase text-[10px]">
                {language === "bn" ? "সক্রিয় সুবিধাভোগী ডাটা" : "Active Enrolled Records"}
              </div>
              <div className="text-xl font-black text-blue-900 mt-1">
                {formatNumber(totalUploadedRecords, language)}
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-3 border-b border-slate-200 pb-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab("batches")}
            className={`min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
              activeTab === "batches"
                ? "bg-slate-900 text-white shadow-xs"
                : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
            }`}
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>{language === "bn" ? "আপলোডকৃত এক্সেল ব্যাচসমূহ" : "Upload Batches"}</span>
            <span className="ml-1 text-[11px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-200 border border-slate-700 font-mono">
              {formatNumber(batches.length, language)}
            </span>
          </button>

          {isSuperAdmin && (
            <button
              onClick={() => setActiveTab("audit")}
              className={`min-h-[44px] flex items-center gap-2 px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm transition-all whitespace-nowrap cursor-pointer ${
                activeTab === "audit"
                  ? "bg-purple-950 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/60"
              }`}
            >
              <Activity className="w-4 h-4 text-purple-400" />
              <span>{language === "bn" ? "সিস্টেম অডিট ট্রেইল" : "System Audit Trail"}</span>
              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-900 text-purple-200 font-bold border border-purple-700">
                {language === "bn" ? "সুপার অ্যাডমিন" : "Admin Only"}
              </span>
            </button>
          )}
        </div>

        {/* TAB 1: UPLOAD BATCHES */}
        {activeTab === "batches" && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 w-full">
              <div className="relative sm:col-span-2 md:col-span-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={batchSearch}
                  onChange={(e) => setBatchSearch(e.target.value)}
                  placeholder={language === "bn" ? "ব্যাচ কোড, ফাইল, স্কিম বা কর্মকর্তা খুঁজুন..." : "Search batch code, file, scheme..."}
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600 bg-white"
                />
              </div>

              <div className="relative">
                <select
                  value={batchStatusFilter}
                  onChange={(e) => setBatchStatusFilter(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  <option value="ALL">{language === "bn" ? "সকল ব্যাচ (All)" : "All Batches"}</option>
                  <option value="ACTIVE">{language === "bn" ? "সক্রিয় (Active)" : "Active Only"}</option>
                  <option value="ROLLED_BACK">{language === "bn" ? "রোলব্যাককৃত (Rolled Back)" : "Rolled Back Only"}</option>
                </select>
              </div>
            </div>

            {/* Batches Table */}
            <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
              {loadingBatches ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                  <span className="text-xs font-semibold">{language === "bn" ? "ব্যাচ তালিকা লোড হচ্ছে..." : "Loading upload batches..."}</span>
                </div>
              ) : filteredBatches.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <FileSpreadsheet className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold">{language === "bn" ? "কোনো ব্যাচ রেকর্ড পাওয়া যায়নি।" : "No upload batches found."}</p>
                  <p className="text-xs text-slate-400 mt-1">
                    {language === "bn" ? "নতুন এক্সেল ফাইল আপলোড করলে স্বয়ংক্রিয়ভাবে এখানে তালিকাভুক্ত হবে।" : "Uploaded Excel datasets will automatically appear here."}
                  </p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                    <thead className="bg-slate-900 text-white font-semibold text-[11px] uppercase tracking-wider whitespace-nowrap">
                      <tr>
                        <th className="py-3.5 px-4">{language === "bn" ? "ব্যাচ কোড" : "Batch Code"}</th>
                        <th className="py-3.5 px-4">{language === "bn" ? "ফাইল ও কর্মসূচি" : "File & Scheme"}</th>
                        <th className="py-3.5 px-4">{language === "bn" ? "দপ্তর" : "Department"}</th>
                        <th className="py-3.5 px-4 text-center">{language === "bn" ? "রেকর্ড সংখ্যা" : "Records"}</th>
                        <th className="py-3.5 px-4">{language === "bn" ? "আপলোডকারী" : "Uploaded By"}</th>
                        <th className="py-3.5 px-4">{language === "bn" ? "আপলোডের সময়" : "Upload Date/Time"}</th>
                        <th className="py-3.5 px-4 text-center">{language === "bn" ? "স্ট্যাটাস" : "Status"}</th>
                        <th className="py-3.5 px-4 text-right">{language === "bn" ? "অ্যাকশন" : "Action"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredBatches.map((b) => {
                        const canRollback = canRollbackBatch(b);

                        return (
                          <tr key={b.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold text-slate-800">
                              <span className="px-2 py-1 bg-slate-100 rounded-md border border-slate-200 text-[11px]">
                                {b.batchCode}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900 flex items-center gap-1.5">
                                <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="truncate max-w-[200px]" title={b.fileName}>
                                  {b.fileName}
                                </span>
                              </div>
                              <div className="text-[11px] text-blue-700 font-medium mt-0.5">
                                {getSchemeName(b.scheme, language)}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-700">
                              <span className="font-medium">{getDepartmentName(b.department, language)}</span>
                            </td>
                            <td className="py-3 px-4 text-center font-bold text-slate-900">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 border border-slate-200">
                                {formatNumber(b.totalRecords, language)}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-semibold text-slate-900 text-xs">
                                {b.uploadedByUser?.name || (language === "bn" ? "সিস্টেম ইউজার" : "System User")}
                              </div>
                              {b.uploadedByUser?.designation && (
                                <div className="text-[10px] text-slate-500">{b.uploadedByUser.designation}</div>
                              )}
                            </td>
                            <td className="py-3 px-4 text-[11px] text-slate-600 whitespace-nowrap">
                              <div>{new Date(b.createdAt).toLocaleDateString("en-CA")}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {new Date(b.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {b.status === "ACTIVE" ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                                  {language === "bn" ? "সক্রিয়" : "ACTIVE"}
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-300">
                                  <RotateCcw className="w-2.5 h-2.5 text-slate-400" />
                                  {language === "bn" ? "রোলব্যাককৃত" : "ROLLED_BACK"}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              {b.status === "ACTIVE" ? (
                                <button
                                  type="button"
                                  onClick={() => setTargetBatchForRollback(b)}
                                  disabled={!canRollback}
                                  title={
                                    canRollback
                                      ? language === "bn"
                                        ? "এই ব্যাচের সকল রেকর্ড প্রত্যাহার করুন"
                                        : "Rollback all records from this batch"
                                      : language === "bn"
                                      ? "২৪ ঘণ্টার বেশি অতিক্রান্ত হওয়ায় শুধুমাত্র সুপার অ্যাডমিন রোলব্যাক করতে পারেন।"
                                      : "Only Super Admin can rollback after 24 hours."
                                  }
                                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                                    canRollback
                                      ? "bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-300 hover:border-rose-600"
                                      : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                                  }`}
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>{language === "bn" ? "রোলব্যাক" : "Rollback"}</span>
                                </button>
                              ) : (
                                <span className="text-[11px] text-slate-400 font-medium italic">
                                  {language === "bn" ? "বাতিলকৃত" : "Purged"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 2: SYSTEM AUDIT TRAIL (SUPER ADMIN ONLY) */}
        {activeTab === "audit" && isSuperAdmin && (
          <div className="space-y-4">
            {/* Filter Bar */}
            <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 w-full">
              <div className="relative sm:col-span-2 md:col-span-3">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  placeholder={language === "bn" ? "কর্মকর্তা, বিবরণ বা আইপি খুঁজুন..." : "Search action, officer, details, IP..."}
                  className="w-full min-h-[44px] pl-9 pr-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-600 bg-white"
                />
              </div>

              <div className="relative">
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 text-xs sm:text-sm rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-purple-600"
                >
                  <option value="ALL">{language === "bn" ? "সকল কার্যক্রম (All)" : "All Actions"}</option>
                  <option value="BATCH_UPLOAD">{language === "bn" ? "এক্সেল আপলোড" : "Batch Upload"}</option>
                  <option value="BATCH_ROLLBACK">{language === "bn" ? "ব্যাচ রোলব্যাক" : "Batch Rollback"}</option>
                  <option value="SCHEME_SUSPENDED">{language === "bn" ? "ভাতা স্থগিত" : "Scheme Suspended"}</option>
                  <option value="DUPLICATE_VERIFIED">{language === "bn" ? "ডুপ্লিকেট যাচাই" : "Duplicate Verified"}</option>
                  <option value="USER_CREATED">{language === "bn" ? "ইউজার সৃষ্টি" : "User Created"}</option>
                </select>
              </div>
            </div>

            {/* Audit Logs Table */}
            <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
              {loadingLogs ? (
                <div className="p-12 text-center text-slate-500 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  <span className="text-xs font-semibold">{language === "bn" ? "অডিট লগ লোড হচ্ছে..." : "Loading audit trail..."}</span>
                </div>
              ) : filteredAuditLogs.length === 0 ? (
                <div className="p-12 text-center text-slate-500">
                  <ShieldCheck className="w-12 h-12 text-slate-300 mx-auto mb-3" />
                  <p className="text-sm font-semibold">{language === "bn" ? "কোনো অডিট লগ রেকর্ড পাওয়া যায়নি।" : "No audit trail entries found."}</p>
                </div>
              ) : (
                <div className="w-full overflow-x-auto">
                  <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                    <thead className="bg-purple-950 text-purple-200 font-semibold text-[11px] uppercase tracking-wider whitespace-nowrap">
                      <tr>
                        <th className="py-3.5 px-4">{language === "bn" ? "কার্যক্রমের ধরন" : "Action Type"}</th>
                        <th className="py-3.5 px-4">{language === "bn" ? "কর্মকর্তা / ইউজার" : "Officer / User"}</th>
                        <th className="py-3.5 px-4 w-1/2">{language === "bn" ? "বিস্তারিত বিবরণ" : "Activity Details"}</th>
                        <th className="py-3.5 px-4">{language === "bn" ? "আইপি অ্যাড্রেস" : "IP Address"}</th>
                        <th className="py-3.5 px-4 text-right">{language === "bn" ? "তারিখ ও সময়" : "Timestamp"}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredAuditLogs.map((log) => {
                        let badgeColor = "bg-slate-100 text-slate-800 border-slate-300";
                        if (log.actionType === "BATCH_UPLOAD") {
                          badgeColor = "bg-blue-50 text-blue-800 border-blue-300";
                        } else if (log.actionType === "BATCH_ROLLBACK") {
                          badgeColor = "bg-rose-50 text-rose-800 border-rose-300";
                        } else if (log.actionType === "SCHEME_SUSPENDED") {
                          badgeColor = "bg-purple-50 text-purple-800 border-purple-300";
                        } else if (log.actionType === "DUPLICATE_VERIFIED") {
                          badgeColor = "bg-emerald-50 text-emerald-800 border-emerald-300";
                        }

                        return (
                          <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-3 px-4 font-mono font-bold">
                              <span className={`px-2 py-0.5 rounded-full border text-[10px] ${badgeColor}`}>
                                {log.actionType}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <div className="font-bold text-slate-900">
                                {log.user?.name || (language === "bn" ? "সিস্টেম কর্মকর্তা" : "Official User")}
                              </div>
                              <div className="text-[10px] text-slate-500">
                                {log.user?.designation || log.user?.role || "User"}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-slate-700 leading-relaxed">
                              {log.details}
                            </td>
                            <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                              {log.ipAddress || "—"}
                            </td>
                            <td className="py-3 px-4 text-right text-[11px] text-slate-600 whitespace-nowrap">
                              <div className="font-medium">{new Date(log.createdAt).toLocaleDateString("en-CA")}</div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {new Date(log.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MODAL: ROLLBACK CONFIRMATION */}
        {targetBatchForRollback && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="w-10 sm:w-12 h-10 sm:h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 sm:w-6 h-5 sm:h-6" />
                </div>
                <div>
                  <h3 className="text-base sm:text-lg font-bold text-slate-900">
                    {language === "bn" ? "এক্সেল ব্যাচ রোলব্যাক নিশ্চিতকরণ" : "Confirm Batch Rollback"}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === "bn"
                      ? "এই কার্যক্রমটি অপূরণীয় এবং ডাটাবেজ থেকে ডাটা স্থায়ীভাবে মুছে ফেলবে।"
                      : "This action is permanent and will remove ingested records from the registry."}
                  </p>
                </div>
              </div>

              {/* Warning Notice Box */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2 leading-relaxed">
                <div className="font-bold flex items-center gap-1.5 text-rose-800">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {language === "bn"
                      ? `এই ব্যাচের সকল ${formatNumber(targetBatchForRollback.totalRecords, language)} টি ডাটা মুছে যাবে এবং ডুপ্লিকেসি রিপোর্ট পুনরায় হালনাগাদ হবে। আপনি কি নিশ্চিত?`
                      : `All ${targetBatchForRollback.totalRecords} records from this batch will be purged and deduplication reports will be recalculated. Are you sure?`}
                  </span>
                </div>
                <p className="text-[11px] text-rose-700">
                  {language === "bn"
                    ? "যেসব সুবিধাভোগীর অন্য কোনো সক্রিয় কর্মসূচি নেই, তাদের এতিম প্রোফাইলও স্বয়ংক্রিয়ভাবে মুছে ফেলা হবে।"
                    : "Beneficiaries with zero remaining active scheme enrollments will also be purged."}
                </p>
              </div>

              {/* Target Batch Summary Details */}
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">{language === "bn" ? "ব্যাচ কোড:" : "Batch Code:"}</span>
                  <strong className="font-mono text-slate-900">{targetBatchForRollback.batchCode}</strong>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{language === "bn" ? "ফাইলের নাম:" : "File Name:"}</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[200px]">{targetBatchForRollback.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{language === "bn" ? "কর্মসূচি:" : "Scheme:"}</span>
                  <span className="font-semibold text-blue-900">{getSchemeName(targetBatchForRollback.scheme, language)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">{language === "bn" ? "মোট রেকর্ড:" : "Total Records:"}</span>
                  <span className="font-bold text-slate-900">{formatNumber(targetBatchForRollback.totalRecords, language)}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setTargetBatchForRollback(null)}
                  disabled={rollingBack}
                  className="w-full sm:w-auto min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold hover:bg-slate-100 transition-all cursor-pointer flex items-center justify-center"
                >
                  {language === "bn" ? "না, ফিরে যান" : "Cancel"}
                </button>

                <button
                  type="button"
                  onClick={handleConfirmRollback}
                  disabled={rollingBack}
                  className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-700 hover:bg-rose-800 text-white text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  {rollingBack ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{language === "bn" ? "রোলব্যাক হচ্ছে..." : "Rolling back..."}</span>
                    </>
                  ) : (
                    <>
                      <RotateCcw className="w-4 h-4" />
                      <span>{language === "bn" ? "হ্যাঁ, রোলব্যাক সম্পন্ন করুন" : "Yes, Confirm Rollback"}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
