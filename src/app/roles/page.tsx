"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import {
  Shield,
  KeyRound,
  Users,
  Building2,
  Check,
  X,
  AlertTriangle,
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  Ban,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Info,
  Search,
  MapPin,
  Lock,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { ROLE_CONFIG, UserRole } from "@/lib/auth";
import { NETROKONA_UPAZILAS } from "@/lib/netrokona";

interface Department {
  id: string;
  name: string;
  nameBn?: string | null;
  nameEn?: string | null;
}

interface SuspensionReq {
  id: string;
  reason: string;
  adminComment?: string | null;
  status: string;
  createdAt: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  requestedBy: {
    name: string;
    role: string;
    email: string;
    designation?: string | null;
  };
  enrollment: {
    id: string;
    cardNumber?: string | null;
    beneficiary: {
      fullName: string;
      nid?: string | null;
      fatherName?: string | null;
      guardianName?: string | null;
      mobile?: string | null;
      unionName: string;
      wardNo: string;
    };
    scheme: {
      name: string;
      nameBn?: string | null;
      nameEn?: string | null;
      monthlyAmount: number;
      department: {
        name: string;
        nameBn?: string | null;
        nameEn?: string | null;
      };
    };
  };
}

export default function RolesAndPermissionsPage() {
  const { currentUser, allUsers, isSuperAdmin, isUpazilaAdmin, isDeptOfficer } = useAuth();
  const { language, t, formatNumber, formatCurrency, getDepartmentName, getSchemeName } = useLanguage();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [suspensionRequests, setSuspensionRequests] = useState<SuspensionReq[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  // Details & Review Modal State
  const [selectedRequestForDetails, setSelectedRequestForDetails] = useState<SuspensionReq | null>(null);
  const [adminCommentInput, setAdminCommentInput] = useState("");

  // New User Form State
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUserName, setNewUserName] = useState("");
  const [newUserEmail, setNewUserEmail] = useState("");
  const [newUserRole, setNewUserRole] = useState<UserRole>("DEPARTMENT_OFFICER");
  const [newUserDeptId, setNewUserDeptId] = useState("");
  const [newUserUnion, setNewUserUnion] = useState("");
  const [creatingUser, setCreatingUser] = useState(false);

  // Reviewing State
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  // User Directory Filters & Pagination
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("ALL");
  const [userUpazilaFilter, setUserUpazilaFilter] = useState(currentUser.upazilaName || "");
  const [userPage, setUserPage] = useState(1);
  const userPageSize = 9;

  useEffect(() => {
    if (currentUser.upazilaName) {
      setUserUpazilaFilter(currentUser.upazilaName);
    }
  }, [currentUser.upazilaName]);

  useEffect(() => {
    setUserPage(1);
  }, [userSearch, userRoleFilter, userUpazilaFilter]);

  const filteredDirectoryUsers = useMemo(() => {
    return allUsers.filter((u) => {
      const q = userSearch.toLowerCase();
      const matchesSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        (u.designation && u.designation.toLowerCase().includes(q)) ||
        u.email.toLowerCase().includes(q) ||
        (u.upazilaName && u.upazilaName.toLowerCase().includes(q)) ||
        (u.unionName && u.unionName.toLowerCase().includes(q));

      const matchesRole =
        userRoleFilter === "ALL"
          ? true
          : userRoleFilter === "DEPT_OFFICER"
          ? u.role === "DEPT_OFFICER" || u.role === "DEPARTMENT_OFFICER"
          : u.role === userRoleFilter;

      const matchesUpazila =
        !userUpazilaFilter || userUpazilaFilter === "all"
          ? true
          : u.upazilaName === userUpazilaFilter;

      return matchesSearch && matchesRole && matchesUpazila;
    });
  }, [allUsers, userSearch, userRoleFilter, userUpazilaFilter]);

  const userTotalPages = Math.max(1, Math.ceil(filteredDirectoryUsers.length / userPageSize));
  const paginatedDirectoryUsers = useMemo(() => {
    const start = (userPage - 1) * userPageSize;
    return filteredDirectoryUsers.slice(start, start + userPageSize);
  }, [filteredDirectoryUsers, userPage, userPageSize]);

  useEffect(() => {
    fetch("/api/departments")
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.departments) {
          setDepartments(data.departments);
          if (data.departments.length > 0) {
            setNewUserDeptId(data.departments[0].id);
          }
        }
      });

    loadSuspensionRequests();
  }, []);

  const loadSuspensionRequests = async () => {
    try {
      setLoadingRequests(true);
      const res = await fetch("/api/removal-requests");
      const data = await res.json();
      if (data.success && data.requests) {
        setSuspensionRequests(data.requests);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleReviewRequest = async (requestId: string, status: "APPROVED" | "REJECTED") => {
    if (!adminCommentInput.trim()) {
      alert(language === "bn" ? "প্রশাসনিক মন্তব্য লেখা বাধ্যতামূলক।" : "Administrative comment is required.");
      return;
    }
    try {
      setReviewingId(requestId);
      const res = await fetch(`/api/removal-requests/${requestId}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status,
          adminComment: adminCommentInput.trim(),
          reviewerUserId: currentUser.id,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSelectedRequestForDetails(null);
        setAdminCommentInput("");
        await loadSuspensionRequests();
        alert(
          data.message ||
            (status === "APPROVED"
              ? language === "bn"
                ? "আবেদনটি অনুমোদিত হয়েছে এবং সুবিধাভোগী উক্ত ভাতা থেকে বাদ পড়েছেন।"
                : "Request approved and duplicate allowance removed."
              : language === "bn"
              ? "আবেদনটি বাতিল/প্রত্যাখ্যান করা হয়েছে।"
              : "Request has been rejected.")
        );
      } else {
        alert(data.error || (language === "bn" ? "কার্যক্রম ব্যর্থ হয়েছে" : "Action failed"));
      }
    } catch (err) {
      console.error(err);
      alert(language === "bn" ? "ত্রুটি ঘটেছে" : "Error reviewing request");
    } finally {
      setReviewingId(null);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    try {
      setCreatingUser(true);
      const res = await fetch("/api/auth/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newUserName.trim(),
          email: newUserEmail.trim(),
          role: newUserRole,
          departmentId: newUserRole === "DEPARTMENT_OFFICER" ? newUserDeptId : null,
          unionName: newUserRole === "UNION_VIEWER" ? newUserUnion : null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setShowUserModal(false);
        setNewUserName("");
        setNewUserEmail("");
        window.location.reload();
      } else {
        alert(data.error || (language === "bn" ? "ইউজার তৈরিতে ব্যর্থ হয়েছে" : "Failed to create user"));
      }
    } catch (err) {
      console.error(err);
      alert(language === "bn" ? "ত্রুটি ঘটেছে" : "Error creating user");
    } finally {
      setCreatingUser(false);
    }
  };

  const pendingRequests = suspensionRequests.filter((r) => r.status === "PENDING");

  if (!isSuperAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 py-16 px-4">
        <div className="max-w-md mx-auto bg-white rounded-3xl p-8 border border-slate-200 shadow-sm text-center space-y-4">
          <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
            <Ban className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">
            {t.common.unauthorized}
          </h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            {language === "bn"
              ? "এই পৃষ্ঠাটি শুধুমাত্র সুপার অ্যাডমিন অ্যাকাউন্টের জন্য সংরক্ষিত।"
              : "This page is strictly restricted to Super Admin accounts."}
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
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-100 text-purple-900 text-xs font-semibold mb-2">
                <KeyRound className="w-3.5 h-3.5 text-purple-700" />
                {t.rolesPage.badge}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {t.rolesPage.title}
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                {t.rolesPage.subtitle}
              </p>
            </div>

            {isSuperAdmin && (
              <button
                onClick={() => setShowUserModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-purple-800 hover:bg-purple-900 text-white text-xs font-bold shadow-xs transition-all"
              >
                <Plus className="w-4 h-4" />
                {t.adminUsers.btnCreateUser}
              </button>
            )}
          </div>
        </div>

        {/* ROLE MATRIX TABLE (EXACT DESIGN FROM USER REQUIREMENTS) */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-700" />
              {t.rolesPage.matrixTitle}
            </h2>
            <span className="text-xs text-slate-500">
              {t.rolesPage.matrixSub}
            </span>
          </div>

          <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-900 text-white font-semibold text-[12px]">
                <tr>
                  <th className="py-3.5 px-4 w-1/5">{t.rolesPage.colFeature}</th>
                  <th className="py-3.5 px-4 w-1/5 bg-amber-950/90 text-amber-200 border-l border-slate-800">
                    {language === "bn" ? "উপজেলা এডমিন (ইউএনও)" : "Upazila Admin (UNO)"}
                  </th>
                  <th className="py-3.5 px-4 w-1/5 bg-purple-950/80 text-purple-200 border-l border-slate-800">
                    {t.rolesPage.colSuperAdmin}
                  </th>
                  <th className="py-3.5 px-4 w-1/5 bg-blue-950/80 text-blue-200 border-l border-slate-800">
                    {t.rolesPage.colDeptOfficer}
                  </th>
                  <th className="py-3.5 px-4 w-1/5 bg-emerald-950/80 text-emerald-200 border-l border-slate-800">
                    {t.rolesPage.colUnionViewer}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-slate-800">
                {/* Row 1 */}
                <tr className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {t.rolesPage.feature1}
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 font-semibold text-emerald-700 bg-amber-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" /> {language === "bn" ? "সকল দপ্তর" : "All Departments"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 font-semibold text-emerald-700 bg-purple-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" /> {t.rolesPage.feature1_sa}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 text-slate-700 bg-blue-50/20">
                    {t.rolesPage.feature1_do}
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 text-slate-700 bg-emerald-50/20">
                    {t.rolesPage.feature1_uv}
                  </td>
                </tr>

                {/* Row 2 */}
                <tr className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {t.rolesPage.feature2}
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 text-slate-600 font-medium bg-amber-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <X className="w-4 h-4 text-slate-400" /> {language === "bn" ? "প্রযোজ্য নয়" : "N/A"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 font-semibold text-emerald-700 bg-purple-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" /> {t.rolesPage.feature2_sa}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 text-emerald-700 font-semibold bg-blue-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" /> {t.rolesPage.feature2_do}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 text-red-600 font-medium bg-emerald-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <X className="w-4 h-4 text-red-500" /> {t.rolesPage.feature2_uv}
                    </span>
                  </td>
                </tr>

                {/* Row 3: Approval of Cancellation (Separation of Duties) */}
                <tr className="hover:bg-slate-50 bg-amber-50/10">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {language === "bn" ? "ভাতা বাতিলের চূড়ান্ত অনুমোদন ও কমেন্ট" : "Final Cancellation Approval & Comment"}
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 font-black text-emerald-800 bg-amber-100/50">
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="w-4 h-4 text-emerald-700" />{" "}
                      {language === "bn" ? "একক চূড়ান্ত ক্ষমতা (ইউএনও)" : "Exclusive Final Authority"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 font-bold text-red-700 bg-purple-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <X className="w-4 h-4 text-red-600" /> {language === "bn" ? "বাতিল ক্ষমতা নেই" : "No Cancellation Power"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 text-amber-800 font-medium bg-blue-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <Clock className="w-4 h-4 text-amber-600" /> {language === "bn" ? "আবেদন প্রেরণ" : "Submit Request"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 text-red-600 font-medium bg-emerald-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <X className="w-4 h-4 text-red-500" /> {language === "bn" ? "অনুমতি নেই" : "No Access"}
                    </span>
                  </td>
                </tr>

                {/* Row 4 */}
                <tr className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {t.rolesPage.feature3}
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 font-semibold text-emerald-700 bg-amber-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" /> {language === "bn" ? "যাচাই ও পর্যালোচনা" : "Review & Verify"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 font-semibold text-emerald-700 bg-purple-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" /> {t.rolesPage.feature3_sa}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 text-slate-700 bg-blue-50/20">
                    {t.rolesPage.feature3_do}
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 font-semibold text-emerald-700 bg-emerald-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" /> {t.rolesPage.feature3_uv}
                    </span>
                  </td>
                </tr>

                {/* Row 5 */}
                <tr className="hover:bg-slate-50">
                  <td className="py-3.5 px-4 font-bold text-slate-900">
                    {t.rolesPage.feature5}
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 text-slate-600 font-medium bg-amber-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" /> {language === "bn" ? "অডিট নিরীক্ষা" : "Audit Inspection"}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 font-semibold text-emerald-700 bg-purple-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-emerald-600" /> {t.rolesPage.feature5_sa}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 text-red-600 font-medium bg-blue-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <X className="w-4 h-4 text-red-500" /> {t.rolesPage.feature5_do}
                    </span>
                  </td>
                  <td className="py-3.5 px-4 border-l border-slate-100 text-red-600 font-medium bg-emerald-50/20">
                    <span className="inline-flex items-center gap-1.5">
                      <X className="w-4 h-4 text-red-500" /> {t.rolesPage.feature5_uv}
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* PENDING SUSPENSION REQUESTS */}
        {(isSuperAdmin || isUpazilaAdmin) && (
          <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-600" />
                  {language === "bn" ? "ভাতা বাতিলের আবেদনসমূহ" : "Allowance Removal Requests"}
                  {pendingRequests.length > 0 && (
                    <span className="bg-red-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">
                      {formatNumber(pendingRequests.length, language)}
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {language === "bn"
                    ? "দপ্তর কর্মকর্তাদের পাঠানো ভাতা বাতিলের আবেদন পর্যালোচনা, প্রশাসনিক মন্তব্য ও চূড়ান্ত অনুমোদন (শুধুমাত্র উপজেলা নির্বাহী কর্মকর্তা / উপজেলা এডমিন)।"
                    : "Review removal requests submitted by department officers and provide final approval with administrative comments (Strictly Upazila Admin / UNO)."}
                </p>
              </div>
            </div>

            {loadingRequests ? (
              <div className="p-8 text-center text-xs text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-emerald-700" />
                {t.common.loading}
              </div>
            ) : suspensionRequests.length === 0 ? (
              <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500">
                {language === "bn"
                  ? "বর্তমানে কোনো ভাতা স্থগিত বা বাতিলের আবেদন জমা নেই।"
                  : "No pending removal requests at this time."}
              </div>
            ) : (
              <div className="space-y-3">
                {suspensionRequests.map((req) => (
                  <div
                    key={req.id}
                    className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            req.status === "PENDING"
                              ? "bg-amber-100 text-amber-900 border border-amber-300"
                              : req.status === "APPROVED"
                              ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                              : "bg-red-100 text-red-900 border border-red-300"
                          }`}
                        >
                          {req.status === "PENDING"
                            ? (language === "bn" ? "অপেক্ষমান" : "Pending")
                            : req.status === "APPROVED"
                            ? (language === "bn" ? "অনুমোদিত" : "Approved")
                            : (language === "bn" ? "বাতিল" : "Rejected")}
                        </span>
                        <span className="font-bold text-slate-900 text-sm">
                          {req.enrollment.beneficiary.fullName}
                        </span>
                        <span className="text-slate-500">
                          ({req.enrollment.beneficiary.unionName}, {language === "bn" ? `ওয়ার্ড ${formatNumber(req.enrollment.beneficiary.wardNo, language)}` : `Ward ${req.enrollment.beneficiary.wardNo}`})
                        </span>
                      </div>

                      <div className="text-slate-700">
                        {language === "bn" ? "বাতিলের প্রস্তাবিত কর্মসূচি:" : "Target Scheme to Remove:"}{" "}
                        <strong className="text-slate-900">{getSchemeName(req.enrollment.scheme, language)}</strong>{" "}
                        ({formatCurrency(req.enrollment.scheme.monthlyAmount, language)} {t.common.perMonth}) • {getDepartmentName(req.enrollment.scheme.department, language)}
                      </div>

                      <div className="text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] space-y-1">
                        <div>
                          <strong>{language === "bn" ? "আবেদনের কারণ:" : "Reason:"}</strong> {req.reason} • {language === "bn" ? "আবেদনকারী:" : "Requested By:"}{" "}
                          <span className="font-semibold text-slate-800">{req.requestedBy.name}</span>
                        </div>
                        {req.adminComment && (
                          <div className="text-emerald-900 bg-emerald-50 p-1.5 rounded border border-emerald-200 mt-1">
                            <strong>{language === "bn" ? "ইউএনও'র মন্তব্য:" : "UNO Comment:"}</strong> {req.adminComment}{" "}
                            {req.reviewedBy && <span className="text-slate-500">({req.reviewedBy})</span>}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => {
                          setSelectedRequestForDetails(req);
                          setAdminCommentInput(req.adminComment || "");
                        }}
                        className="px-3.5 py-2 rounded-xl bg-purple-800 hover:bg-purple-900 text-white text-xs font-bold shadow-xs transition-all flex items-center gap-1.5"
                      >
                        <Info className="w-3.5 h-3.5" />
                        {language === "bn" ? "অনুরোধের বিস্তারিত" : "View Details"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ACTIVE USERS DIRECTORY */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-emerald-700" />
                {language === "bn" ? "সিস্টেমে নিবন্ধিত ইউজার তালিকা" : "Registered User Directory"}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                {language === "bn"
                  ? `সিস্টেমের মোট ${formatNumber(filteredDirectoryUsers.length, language)} জন সক্রিয় কর্মকর্তা ও তাদের অধিক্ষেত্র।`
                  : `Active system users, assigned roles, and jurisdictions (${filteredDirectoryUsers.length} total).`}
              </p>
            </div>

            <Link
              href="/admin/users"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-colors shrink-0"
            >
              <Users className="w-3.5 h-3.5 text-emerald-700" />
              <span>{language === "bn" ? "ইউজার ম্যানেজমেন্ট টেবিল" : "Manage Users Table"}</span>
            </Link>
          </div>

          {/* Directory Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder={language === "bn" ? "নাম, ইমেইল বা পদবি..." : "Search user directory..."}
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <select
              value={userRoleFilter}
              onChange={(e) => setUserRoleFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="ALL">{language === "bn" ? "সকল ভূমিকা / রোল" : "All Roles"}</option>
              <option value="SUPER_ADMIN">{language === "bn" ? "সুপার এডমিন / জেলা প্রশাসন" : "Super Admin (DC)"}</option>
              <option value="UPAZILA_ADMIN">{language === "bn" ? "উপজেলা এডমিন (ইউএনও)" : "Upazila Admin (UNO)"}</option>
              <option value="DEPT_OFFICER">{language === "bn" ? "উপজেলা দপ্তর কর্মকর্তা" : "Department Officer"}</option>
              <option value="UNION_VIEWER">{language === "bn" ? "ইউনিয়ন ভিউয়ার" : "Union Viewer"}</option>
            </select>

            <select
              value={userUpazilaFilter}
              onChange={(e) => setUserUpazilaFilter(e.target.value)}
              disabled={Boolean(currentUser.upazilaName)}
              className={`px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                currentUser.upazilaName
                  ? "bg-slate-100 border-slate-300 text-slate-700 font-semibold cursor-not-allowed"
                  : "border-slate-300 bg-white text-slate-800 font-semibold"
              }`}
            >
              <option value="">{language === "bn" ? "সকল উপজেলা (নেত্রকোণা)" : "All Upazilas"}</option>
              {NETROKONA_UPAZILAS.map((upz) => (
                <option key={upz.key} value={upz.nameBn}>
                  {upz.nameBn} ({upz.nameEn})
                </option>
              ))}
            </select>
          </div>

          {/* Cards Grid */}
          {paginatedDirectoryUsers.length === 0 ? (
            <div className="p-8 text-center border border-dashed border-slate-200 rounded-2xl text-xs text-slate-500">
              {language === "bn" ? "ফিল্টারের সাথে মিলে এমন কোনো কর্মকর্তা পাওয়া যায়নি।" : "No users match your filter criteria."}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {paginatedDirectoryUsers.map((u) => {
                const isCurrent = u.id === currentUser.id;
                const cfg = ROLE_CONFIG[u.role] || ROLE_CONFIG.SUPER_ADMIN;

                return (
                  <div
                    key={u.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isCurrent
                        ? "border-emerald-500 bg-emerald-50/40 shadow-xs"
                        : "border-slate-200 bg-slate-50/40 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${cfg.badgeColor}`}
                      >
                        {language === "bn"
                          ? u.role === "UPAZILA_ADMIN"
                            ? "উপজেলা এডমিন"
                            : u.role === "SUPER_ADMIN"
                            ? t.roles.SUPER_ADMIN
                            : u.role === "UNION_VIEWER"
                            ? t.roles.UNION_VIEWER
                            : t.roles.DEPT_OFFICER
                          : u.role.replace("_", " ")}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                          {language === "bn" ? "বর্তমান ইউজার" : "Active User"}
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-slate-900 text-sm mt-2">{u.name}</h3>
                    {u.designation && (
                      <div className="text-[11px] font-semibold text-indigo-700 mt-0.5">{u.designation}</div>
                    )}
                    <div className="text-xs text-slate-500 font-mono mt-0.5">{u.email}</div>

                    <div className="text-[11px] text-slate-600 mt-2 pt-2 border-t border-slate-200/60">
                      {u.role === "UPAZILA_ADMIN" &&
                        (language === "bn"
                          ? `অধিক্ষেত্র: ${u.upazilaName || "উপজেলা"} প্রশাসন ও ভাতা বাতিলের চূড়ান্ত অনুমোদনকারী (ইউএনও)`
                          : `Jurisdiction: ${u.upazilaName || "Upazila"} Administration & Sole Cancellation Authority`)}
                      {u.role === "SUPER_ADMIN" &&
                        (language === "bn"
                          ? u.email.includes("dc")
                            ? "অধিক্ষেত্র: জেলা প্রশাসন, নেত্রকোণা"
                            : u.email.includes("dg")
                            ? "অধিক্ষেত্র: কেন্দ্রীয় মন্ত্রণালয় / অধিদপ্তর"
                            : "অধিক্ষেত্র: সমগ্র জেলা প্রশাসন (সিস্টেম ব্যবস্থাপনা)"
                          : u.email.includes("dc")
                          ? "Jurisdiction: District Administration"
                          : u.email.includes("dg")
                          ? "Jurisdiction: Ministry / Directorate"
                          : "Jurisdiction: System Administration")}
                      {u.role.includes("DEPT") &&
                        (language === "bn"
                          ? `দপ্তর: ${getDepartmentName({ name: u.departmentName, nameBn: u.departmentNameBn, nameEn: u.departmentNameEn }, "bn") || "নির্দিষ্ট দপ্তর"} • ${u.upazilaName || "উপজেলা"}`
                          : `Department: ${getDepartmentName({ name: u.departmentName, nameBn: u.departmentNameBn, nameEn: u.departmentNameEn }, "en") || "Assigned Department"} • ${u.upazilaName || "Upazila"}`)}
                      {u.role === "UNION_VIEWER" &&
                        (language === "bn"
                          ? `এলাকা: ${u.unionName || "নির্দিষ্ট ইউনিয়ন"} • ${u.upazilaName || "উপজেলা"}`
                          : `Area: ${u.unionName || "Assigned Union"} • ${u.upazilaName || "Upazila"}`)}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Directory Pagination Controls */}
          {userTotalPages > 1 && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pt-3 border-t border-slate-100 gap-2 text-xs text-slate-600">
              <div>
                {language === "bn"
                  ? `পৃষ্ঠা ${formatNumber(userPage, language)} / ${formatNumber(userTotalPages, language)} (মোট ${formatNumber(filteredDirectoryUsers.length, language)} জন)`
                  : `Page ${userPage} of ${userTotalPages} (${filteredDirectoryUsers.length} total)`}
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setUserPage((p) => Math.max(1, p - 1))}
                  disabled={userPage === 1}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>{language === "bn" ? "পূর্ববর্তী" : "Prev"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setUserPage((p) => Math.min(userTotalPages, p + 1))}
                  disabled={userPage === userTotalPages}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span>{language === "bn" ? "পরবর্তী" : "Next"}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal: View Details and Approval (Strictly Upazila Admin) */}
        {selectedRequestForDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[92vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center font-bold">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {language === "bn" ? "ভাতা বাতিলের আবেদন পর্যালোচনা" : "Review Allowance Removal Request"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {language === "bn"
                        ? "দপ্তর কর্মকর্তার সুপারিশ বিস্তারিত যাচাই করে প্রশাসনিক সিদ্ধান্ত প্রদান করুন।"
                        : "Review department officer recommendation and provide administrative decision."}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedRequestForDetails(null);
                    setAdminCommentInput("");
                  }}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold p-1 rounded-lg"
                >
                  ✕
                </button>
              </div>

              {/* Beneficiary Profile */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200 space-y-2 text-xs">
                <div className="font-bold text-slate-900 text-sm flex items-center justify-between">
                  <span>{selectedRequestForDetails.enrollment.beneficiary.fullName}</span>
                  <span
                    className={`px-2.5 py-0.5 rounded text-[10px] font-bold uppercase ${
                      selectedRequestForDetails.status === "PENDING"
                        ? "bg-amber-100 text-amber-900 border border-amber-300"
                        : selectedRequestForDetails.status === "APPROVED"
                        ? "bg-emerald-100 text-emerald-900 border border-emerald-300"
                        : "bg-red-100 text-red-900 border border-red-300"
                    }`}
                  >
                    {selectedRequestForDetails.status === "PENDING"
                      ? language === "bn" ? "অপেক্ষমান" : "Pending"
                      : selectedRequestForDetails.status === "APPROVED"
                      ? language === "bn" ? "অনুমোদিত" : "Approved"
                      : language === "bn" ? "প্রত্যাখ্যাত" : "Rejected"}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-600">
                  <div>
                    <span className="text-slate-400 block text-[10px]">{language === "bn" ? "জাতীয় পরিচয়পত্র:" : "NID:"}</span>
                    <strong className="font-mono text-slate-800">{selectedRequestForDetails.enrollment.beneficiary.nid || "তথ্য নেই"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">{language === "bn" ? "অভিভাবক/পিতা:" : "Guardian/Father:"}</span>
                    <strong className="text-slate-800">{selectedRequestForDetails.enrollment.beneficiary.guardianName || selectedRequestForDetails.enrollment.beneficiary.fatherName || "তথ্য নেই"}</strong>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">{language === "bn" ? "এলাকা ও ওয়ার্ড:" : "Union & Ward:"}</span>
                    <strong className="text-slate-800">{selectedRequestForDetails.enrollment.beneficiary.unionName}, ওয়ার্ড {selectedRequestForDetails.enrollment.beneficiary.wardNo}</strong>
                  </div>
                </div>
              </div>

              {/* Proposed Benefit to Remove */}
              <div className="bg-red-50/60 rounded-2xl p-4 border border-red-200 space-y-1.5 text-xs">
                <div className="font-bold text-red-900 flex items-center gap-1.5">
                  <Ban className="w-3.5 h-3.5 text-red-700" />
                  {language === "bn" ? "যে কর্মসূচি/ভাতা থেকে বাদ দেওয়ার সুপারিশ:" : "Benefit Proposed for Removal:"}
                </div>
                <div className="text-slate-800 font-semibold text-sm">
                  {getSchemeName(selectedRequestForDetails.enrollment.scheme, language)}
                </div>
                <div className="text-slate-600 flex items-center gap-3">
                  <span>{language === "bn" ? "দপ্তর:" : "Department:"} <strong>{getDepartmentName(selectedRequestForDetails.enrollment.scheme.department, language)}</strong></span>
                  <span>•</span>
                  <span>{language === "bn" ? "মাসিক আর্থিক মান:" : "Monthly Value:"} <strong className="text-red-700">{formatCurrency(selectedRequestForDetails.enrollment.scheme.monthlyAmount, language)}</strong></span>
                </div>
              </div>

              {/* Department Officer Recommendation */}
              <div className="bg-blue-50/60 rounded-2xl p-4 border border-blue-200 space-y-1.5 text-xs">
                <div className="font-bold text-blue-950 flex items-center justify-between">
                  <span>{language === "bn" ? "দপ্তর কর্মকর্তার সুপারিশ:" : "Department Officer Recommendation:"}</span>
                  <span className="text-slate-500 font-normal text-[11px]">
                    {new Date(selectedRequestForDetails.createdAt).toLocaleString(language === "bn" ? "bn-BD" : "en-US")}
                  </span>
                </div>
                <p className="text-slate-800 bg-white p-2.5 rounded-xl border border-blue-100 text-[11px] leading-relaxed">
                  "{selectedRequestForDetails.reason}"
                </p>
                <div className="text-[11px] text-slate-500">
                  {language === "bn" ? "আবেদনকারী:" : "Requested By:"}{" "}
                  <strong className="text-slate-700">{selectedRequestForDetails.requestedBy.name}</strong>{" "}
                  ({selectedRequestForDetails.requestedBy.email})
                </div>
              </div>

              {/* Already Reviewed Information */}
              {selectedRequestForDetails.status !== "PENDING" && (
                <div className="bg-emerald-50 rounded-2xl p-4 border border-emerald-200 text-xs space-y-1">
                  <div className="font-bold text-emerald-950">
                    {language === "bn" ? "প্রশাসনিক সিদ্ধান্ত ও মন্তব্য:" : "Administrative Decision & Comment:"}
                  </div>
                  <p className="text-slate-800 bg-white p-2.5 rounded-xl border border-emerald-100 text-[11px]">
                    "{selectedRequestForDetails.adminComment || "কোনো মন্তব্য লেখা হয়নি"}"
                  </p>
                  <div className="text-[11px] text-slate-600">
                    {language === "bn" ? "অনুমোদনকারী:" : "Reviewed By:"}{" "}
                    <strong>{selectedRequestForDetails.reviewedBy || "উপজেলা নির্বাহী কর্মকর্তা"}</strong>
                  </div>
                </div>
              )}

              {/* Decision Section for PENDING */}
              {selectedRequestForDetails.status === "PENDING" && (
                <>
                  {isUpazilaAdmin ? (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block font-bold text-slate-800 text-xs mb-1">
                          {language === "bn" ? "উপজেলা নির্বাহী কর্মকর্তার প্রশাসনিক মন্তব্য / নোট (বাধ্যতামূলক) *" : "Upazila Admin Comment / Note (Mandatory) *"}
                        </label>
                        <textarea
                          rows={3}
                          required
                          value={adminCommentInput}
                          onChange={(e) => setAdminCommentInput(e.target.value)}
                          placeholder={
                            language === "bn"
                              ? "যাচাইান্তে দ্বৈত ভাতা গ্রহণ নিশ্চিত হওয়ায় বাতিল অনুমোদন করা হলো..."
                              : "Enter administrative justification for approval or rejection..."
                          }
                          className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600 text-xs"
                        />
                        <p className="text-[10px] text-slate-500 mt-1">
                          {language === "bn"
                            ? "⚠️ মন্তব্য প্রদান বাধ্যতামূলক। অনুমোদন করলে সুবিধাভোগী উক্ত ভাতা থেকে বাদ পড়বেন এবং অডিট লগে তা স্থায়ীভাবে লিপিবদ্ধ থাকবে।"
                            : "⚠️ Comment is mandatory. Upon approval, the beneficiary will be removed from this benefit and logged."}
                        </p>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRequestForDetails(null);
                            setAdminCommentInput("");
                          }}
                          className="px-4 py-2 rounded-xl border border-slate-300 font-medium text-slate-700 hover:bg-slate-100 text-xs"
                        >
                          {t.common.cancel}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReviewRequest(selectedRequestForDetails.id, "REJECTED")}
                          disabled={reviewingId === selectedRequestForDetails.id || !adminCommentInput.trim()}
                          className="px-4 py-2 rounded-xl bg-red-700 hover:bg-red-800 text-white font-bold text-xs disabled:opacity-50 transition-all"
                        >
                          {reviewingId === selectedRequestForDetails.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" />
                          ) : (
                            language === "bn" ? "প্রত্যাখ্যান করুন" : "Reject Request"
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleReviewRequest(selectedRequestForDetails.id, "APPROVED")}
                          disabled={reviewingId === selectedRequestForDetails.id || !adminCommentInput.trim()}
                          className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-xs disabled:opacity-50 transition-all flex items-center gap-1.5"
                        >
                          {reviewingId === selectedRequestForDetails.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          {language === "bn" ? "অনুমোদন ও ভাতা বাতিল" : "Approve & Remove Benefit"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3 pt-2 border-t border-slate-100">
                      <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                        <span>
                          {language === "bn"
                            ? "নীতিমালা অনুযায়ী শুধুমাত্র উপজেলা নির্বাহী কর্মকর্তা (উপজেলা এডমিন) প্রশাসনিক মন্তব্য সহ ভাতা বাতিলের অনুমোদন দিতে পারেন। সুপার এডমিন বা অন্য কারো এই ক্ষমতা নেই।"
                            : "Per governance rules, only Upazila Admin (UNO) can approve allowance cancellations with an administrative comment. Super Admin does not possess this power."}
                        </span>
                      </div>

                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedRequestForDetails(null);
                            setAdminCommentInput("");
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

        {/* Modal: Create User */}
        {showUserModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                  <Plus className="w-4 h-4 text-purple-700" />
                  {t.adminUsers.modalCreateTitle}
                </h3>
                <button
                  type="button"
                  onClick={() => setShowUserModal(false)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t.adminUsers.labelName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t.adminUsers.labelEmail} *
                  </label>
                  <input
                    type="email"
                    required
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-600"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    {t.adminUsers.labelRole} *
                  </label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as UserRole)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-600"
                  >
                    <option value="SUPER_ADMIN">{t.roles.SUPER_ADMIN}</option>
                    <option value="DEPARTMENT_OFFICER">{t.roles.DEPT_OFFICER}</option>
                    <option value="UNION_VIEWER">{t.roles.UNION_VIEWER}</option>
                  </select>
                </div>

                {newUserRole === "DEPARTMENT_OFFICER" && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {t.adminUsers.labelDept} *
                    </label>
                    <select
                      value={newUserDeptId}
                      onChange={(e) => setNewUserDeptId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-purple-600"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {getDepartmentName(d, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {newUserRole === "UNION_VIEWER" && (
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      {t.adminUsers.labelUnion} *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUserUnion}
                      onChange={(e) => setNewUserUnion(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-purple-600"
                    />
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowUserModal(false)}
                    className="px-4 py-2 rounded-xl border border-slate-300 font-medium text-slate-700 hover:bg-slate-100"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={creatingUser}
                    className="px-4 py-2 rounded-xl bg-purple-800 hover:bg-purple-900 text-white font-semibold disabled:opacity-50"
                  >
                    {creatingUser ? t.common.saving : t.adminUsers.btnSubmitCreate}
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
