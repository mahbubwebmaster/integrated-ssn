"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  Users,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Building2,
  MapPin,
  Lock,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  X,
  Eye,
  EyeOff,
  Power,
  Edit,
  ArrowLeft,
  Ban,
  UserCheck,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { NETROKONA_UPAZILAS } from "@/lib/netrokona";

interface Department {
  id: string;
  name: string;
  nameBn?: string | null;
  nameEn?: string | null;
}

interface AdminUser {
  id: string;
  name: string;
  designation?: string | null;
  email: string;
  role: string;
  phone?: string | null;
  departmentId?: string | null;
  district?: string | null;
  upazilaName?: string | null;
  unionName?: string | null;
  wardNo?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  department?: {
    id: string;
    name: string;
    nameBn?: string | null;
    nameEn?: string | null;
  } | null;
}

export default function AdminUsersPage() {
  const { currentUser, isSuperAdmin, isUpazilaAdmin } = useAuth();
  const { language, t, formatNumber, getDepartmentName } = useLanguage();

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");
  const [upazilaFilter, setUpazilaFilter] = useState<string>(currentUser.upazilaName || "");
  const [deptFilter, setDeptFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ALL");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Create User Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesignation, setNewDesignation] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("admin123");
  const [newRole, setNewRole] = useState<string>("DEPT_OFFICER");
  const [newDeptId, setNewDeptId] = useState("");
  const [newUpazilaName, setNewUpazilaName] = useState(currentUser.upazilaName || "নেত্রকোণা সদর");
  const [newUnionName, setNewUnionName] = useState("");
  const [creating, setCreating] = useState(false);

  // Reset Password Modal State
  const [showResetModal, setShowResetModal] = useState(false);
  const [targetUser, setTargetUser] = useState<AdminUser | null>(null);
  const [resetNewPass, setResetNewPass] = useState("");
  const [showResetPassText, setShowResetPassText] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Edit User Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editTargetUser, setEditTargetUser] = useState<AdminUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesignation, setEditDesignation] = useState("");
  const [editRole, setEditRole] = useState("");
  const [editDeptId, setEditDeptId] = useState("");
  const [editUpazilaName, setEditUpazilaName] = useState("");
  const [editUnionName, setEditUnionName] = useState("");
  const [updating, setUpdating] = useState(false);

  // Auto-lock Upazila if logged in as Upazila Admin
  useEffect(() => {
    if (currentUser.upazilaName) {
      setUpazilaFilter(currentUser.upazilaName);
      setNewUpazilaName(currentUser.upazilaName);
    }
  }, [currentUser.upazilaName]);

  // Load Departments
  useEffect(() => {
    fetch("/api/departments")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.departments)) {
          setDepartments(data.departments);
          if (data.departments.length > 0 && !newDeptId) {
            setNewDeptId(data.departments[0].id);
          }
        }
      })
      .catch(() => {});
  }, []);

  // Reset page to 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, roleFilter, upazilaFilter, deptFilter, statusFilter]);

  // Fetch users when pagination or filters change
  useEffect(() => {
    fetchUsers(currentPage, pageSize);
  }, [currentPage, pageSize, search, roleFilter, upazilaFilter, deptFilter, statusFilter]);

  const fetchUsers = async (pageToFetch = currentPage, limitToFetch = pageSize) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", String(pageToFetch));
      params.set("limit", String(limitToFetch));
      if (search) params.set("search", search);
      if (roleFilter !== "ALL") params.set("role", roleFilter);
      if (upazilaFilter && upazilaFilter !== "all" && upazilaFilter !== "সমগ্র জেলা" && upazilaFilter !== "সমগ্র নেত্রকোণা জেলা") {
        params.set("upazila", upazilaFilter);
      }
      if (deptFilter !== "ALL") params.set("departmentId", deptFilter);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/users?${params.toString()}`);
      const data = await res.json();

      if (data?.success && Array.isArray(data.users)) {
        setUsers(data.users);
        if (data.pagination) {
          setTotalRecords(data.pagination.total);
          setTotalPages(data.pagination.totalPages);
          setCurrentPage(data.pagination.page);
        } else {
          const total = data.total ?? data.users.length;
          setTotalRecords(total);
          setTotalPages(Math.max(1, Math.ceil(total / limitToFetch)));
        }
      }
    } catch (err) {
      console.error("Failed to load admin users:", err);
    } finally {
      setLoading(false);
    }
  };

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    if (currentPage <= 3) {
      pages.push(1, 2, 3, 4, "...", totalPages);
    } else if (currentPage >= totalPages - 2) {
      pages.push(1, "...", totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, "...", currentPage - 1, currentPage, currentPage + 1, "...", totalPages);
    }
    return pages;
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newEmail || !newRole) return;

    try {
      setCreating(true);
      const res = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newName.trim(),
          designation: newDesignation.trim() || null,
          email: newEmail.trim().toLowerCase(),
          password: newPassword,
          role: newRole,
          departmentId: newRole === "DEPT_OFFICER" ? newDeptId : null,
          upazilaName: isUpazilaAdmin ? currentUser.upazilaName : newUpazilaName,
          unionName: newRole === "UNION_VIEWER" ? newUnionName.trim() : null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          language === "bn"
            ? `কর্মকর্তা অ্যাকাউন্ট সফলভাবে তৈরি হয়েছে: ${newName}`
            : `User account created successfully: ${newName}`
        );
        setShowCreateModal(false);
        setNewName("");
        setNewDesignation("");
        setNewEmail("");
        setNewPassword("admin123");
        await fetchUsers(1, pageSize);
      } else {
        alert(data.error || (language === "bn" ? "ইউজার তৈরিতে ব্যর্থ হয়েছে" : "Failed to create user"));
      }
    } catch (err) {
      console.error(err);
      alert(language === "bn" ? "ত্রুটি ঘটেছে" : "Error creating user");
    } finally {
      setCreating(false);
    }
  };

  // Handle Reset Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUser || !resetNewPass) return;

    try {
      setResetting(true);
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUser.id,
          action: "reset_password",
          newPassword: resetNewPass,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          language === "bn"
            ? `পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে (${targetUser.email})`
            : `Password reset successfully for ${targetUser.email}`
        );
        setShowResetModal(false);
        setTargetUser(null);
        setResetNewPass("");
      } else {
        alert(data.error || (language === "bn" ? "পাসওয়ার্ড রিসেট ব্যর্থ হয়েছে" : "Failed to reset password"));
      }
    } catch (err) {
      console.error(err);
      alert(language === "bn" ? "ত্রুটি ঘটেছে" : "Error resetting password");
    } finally {
      setResetting(false);
    }
  };

  // Handle Toggle Active
  const handleToggleActive = async (u: AdminUser) => {
    const confirmMsg = u.isActive
      ? language === "bn"
        ? `আপনি কি নিশ্চিত যে "${u.name}" এর অ্যাকাউন্ট নিষ্ক্রিয় করতে চান?`
        : `Are you sure you want to deactivate ${u.name}'s account?`
      : language === "bn"
      ? `আপনি কি নিশ্চিত যে "${u.name}" এর অ্যাকাউন্ট সক্রিয় করতে চান?`
      : `Are you sure you want to activate ${u.name}'s account?`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: u.id,
          action: "toggle_active",
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          language === "bn"
            ? `অ্যাকাউন্ট স্ট্যাটাস সফলভাবে পরিবর্তন হয়েছে: ${u.name}`
            : `Account status updated for ${u.name}`
        );
        await fetchUsers(currentPage, pageSize);
      } else {
        alert(data.error || (language === "bn" ? "স্ট্যাটাস পরিবর্তন ব্যর্থ হয়েছে" : "Failed to toggle status"));
      }
    } catch (err) {
      console.error(err);
      alert(language === "bn" ? "ত্রুটি ঘটেছে" : "Error toggling user status");
    }
  };

  // Handle Edit User
  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetUser || !editName) return;

    try {
      setUpdating(true);
      const res = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editTargetUser.id,
          action: "update_details",
          name: editName.trim(),
          designation: editDesignation.trim() || null,
          role: isSuperAdmin ? editRole : undefined,
          departmentId: editRole === "DEPT_OFFICER" ? editDeptId : null,
          upazilaName: isSuperAdmin ? editUpazilaName : undefined,
          unionName: editRole === "UNION_VIEWER" ? editUnionName.trim() : null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        showToast(
          language === "bn"
            ? `কর্মকর্তার তথ্য সফলভাবে আপডেট হয়েছে: ${editName}`
            : "Officer details updated successfully."
        );
        setShowEditModal(false);
        await fetchUsers(currentPage, pageSize);
      } else {
        alert(data.error || (language === "bn" ? "আপডেট ব্যর্থ হয়েছে" : "Failed to update user"));
      }
    } catch (err) {
      console.error(err);
      alert(language === "bn" ? "ত্রুটি ঘটেছে" : "Error updating user details");
    } finally {
      setUpdating(false);
    }
  };

  // If not Super Admin or Upazila Admin, show barrier card
  if (!isSuperAdmin && !isUpazilaAdmin) {
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
              ? "এই পৃষ্ঠাটি শুধুমাত্র সিস্টেম অ্যাডমিন, সুপার অ্যাডমিন ও উপজেলা অ্যাডমিন অ্যাকাউন্টের জন্য সংরক্ষিত।"
              : "This page is strictly restricted to System Admin, Super Admin, and Upazila Admin accounts."}
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
        {/* Toast Alert */}
        {toastMessage && (
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 text-emerald-900 flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2 text-xs font-bold">
              <CheckCircle2 className="w-4 h-4 text-emerald-700" />
              <span>{toastMessage}</span>
            </div>
            <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Header Bar */}
        <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xs border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-purple-50 border border-purple-200 text-xs font-semibold text-purple-900 mb-2">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-700" />
                {t.adminUsers.badge}
                {currentUser.upazilaName && (
                  <span className="text-[11px] bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.2 rounded-full font-bold ml-1">
                    {currentUser.upazilaName} উপজেলা
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
                {t.adminUsers.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 mt-1">
                {currentUser.upazilaName
                  ? (language === "bn" ? `${currentUser.upazilaName} উপজেলার কর্মকর্তা ও ইউনিয়ন ভিউয়ার একাউন্টসমূহ পরিচালনা করুন` : `Manage officer accounts within ${currentUser.upazilaName} Upazila`)
                  : (language === "bn" ? "নেত্রকোণা জেলা ও ১০টি উপজেলার সকল প্রশাসনিক ও দপ্তর কর্মকর্তা পরিচালনা করুন" : "Manage administrative and line ministry officers across Netrokona district")}
              </p>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => fetchUsers(currentPage, pageSize)}
                disabled={loading}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold border border-slate-300 transition-all cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-emerald-700" : ""}`} />
                {language === "bn" ? "রিফ্রেশ" : "Refresh"}
              </button>

              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold shadow-sm transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {t.adminUsers.btnCreateUser}
              </button>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-100 text-xs">
            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="text-slate-500 font-semibold uppercase text-[10px]">
                {language === "bn" ? "মোট কর্মকর্তা ইউজার" : "Total Officers"}
              </div>
              <div className="text-xl font-black text-slate-900 mt-1">
                {formatNumber(totalRecords, language)} {language === "bn" ? "জন" : "users"}
              </div>
            </div>
            <div className="bg-amber-50/70 p-3.5 rounded-2xl border border-amber-200">
              <div className="text-amber-800 font-semibold uppercase text-[10px]">
                {language === "bn" ? "উপজেলা এডমিন (ইউএনও)" : "Upazila Admins"}
              </div>
              <div className="text-xl font-black text-amber-900 mt-1">
                {formatNumber(users.filter((u) => u.role === "UPAZILA_ADMIN").length, language)}{" "}
                {language === "bn" ? "জন" : "users"}
              </div>
            </div>
            <div className="bg-blue-50/70 p-3.5 rounded-2xl border border-blue-200">
              <div className="text-blue-700 font-semibold uppercase text-[10px]">
                {t.roles.DEPT_OFFICER}
              </div>
              <div className="text-xl font-black text-blue-900 mt-1">
                {formatNumber(
                  users.filter((u) => u.role === "DEPT_OFFICER" || u.role === "DEPARTMENT_OFFICER").length,
                  language
                )}{" "}
                {language === "bn" ? "জন" : "users"}
              </div>
            </div>
            <div className="bg-purple-50/70 p-3.5 rounded-2xl border border-purple-200">
              <div className="text-purple-700 font-semibold uppercase text-[10px]">
                {t.adminUsers.statusActive}
              </div>
              <div className="text-xl font-black text-purple-900 mt-1">
                {formatNumber(users.filter((u) => u.isActive).length, language)}{" "}
                {language === "bn" ? "টি সক্রিয়" : "active"}
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar with Search, Role, Upazila, Dept & Status */}
        <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-200 space-y-3">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Search className="w-3.5 h-3.5 text-emerald-700" />
              {language === "bn" ? "ইউজার ফিল্টারিং ও অনুসন্ধান" : "Filter & Search Users"}
            </span>
            {(search || roleFilter !== "ALL" || (upazilaFilter && !currentUser.upazilaName) || deptFilter !== "ALL" || statusFilter !== "ALL") && (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setRoleFilter("ALL");
                  if (!currentUser.upazilaName) setUpazilaFilter("");
                  setDeptFilter("ALL");
                  setStatusFilter("ALL");
                }}
                className="text-[11px] font-semibold text-red-600 hover:text-red-800 transition-colors cursor-pointer"
              >
                {language === "bn" ? "ফিল্টার রিসেট করুন" : "Reset Filters"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative sm:col-span-2 md:col-span-4">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={language === "bn" ? "নাম, ইমেইল বা পদবি দিয়ে খুঁজুন..." : "Search name, email, designation..."}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </div>

            {/* Role Filter */}
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="ALL">{language === "bn" ? "সকল ভূমিকা / রোল" : "All Roles"}</option>
                <option value="SUPER_ADMIN">{language === "bn" ? "সুপার এডমিন / জেলা প্রশাসক" : "Super Admin (DC)"}</option>
                <option value="UPAZILA_ADMIN">{language === "bn" ? "উপজেলা এডমিন (ইউএনও)" : "Upazila Admin (UNO)"}</option>
                <option value="DEPT_OFFICER">{language === "bn" ? "উপজেলা দপ্তর কর্মকর্তা" : "Department Officer"}</option>
                <option value="UNION_VIEWER">{language === "bn" ? "ইউনিয়ন ভিউয়ার" : "Union Viewer"}</option>
              </select>
            </div>

            {/* Upazila Filter */}
            <div className="relative">
              <select
                value={upazilaFilter}
                onChange={(e) => setUpazilaFilter(e.target.value)}
                disabled={Boolean(currentUser.upazilaName)}
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  currentUser.upazilaName
                    ? "bg-slate-100 border-slate-300 text-slate-700 font-semibold cursor-not-allowed"
                    : "border-slate-300 bg-white text-slate-800 font-semibold"
                }`}
              >
                <option value="">{language === "bn" ? "সকল উপজেলা (নেত্রকোণা)" : "All Upazilas (Netrokona)"}</option>
                {NETROKONA_UPAZILAS.map((upz) => (
                  <option key={upz.key} value={upz.nameBn}>
                    {upz.nameBn} ({upz.nameEn})
                  </option>
                ))}
              </select>
              {currentUser.upazilaName && (
                <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                  <Lock className="w-3 h-3" />
                </span>
              )}
            </div>

            {/* Department Filter */}
            <div className="relative">
              <select
                value={deptFilter}
                onChange={(e) => setDeptFilter(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="ALL">{language === "bn" ? "সকল দপ্তর" : "All Departments"}</option>
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {getDepartmentName(dept, language)}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white text-slate-800 font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="ALL">{language === "bn" ? "সকল স্ট্যাটাস" : "All Status"}</option>
                <option value="ACTIVE">{language === "bn" ? "সক্রিয় একাউন্ট" : "Active"}</option>
                <option value="INACTIVE">{language === "bn" ? "নিষ্ক্রিয় একাউন্ট" : "Inactive"}</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table Card */}
        <div className="bg-white rounded-3xl shadow-xs border border-slate-200 overflow-hidden">
          {/* Table Header Bar with Top Page info */}
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-800">
                {language === "bn"
                  ? `নিবন্ধিত কর্মকর্তা: ${formatNumber(totalRecords, language)} জন`
                  : `Registered Officers: ${formatNumber(totalRecords, language)} users`}
              </span>
              {totalRecords > 0 && (
                <span className="text-[11px] bg-slate-200/80 text-slate-700 font-semibold px-2 py-0.5 rounded-full">
                  {language === "bn"
                    ? `পৃষ্ঠা ${formatNumber(currentPage, language)} / ${formatNumber(totalPages, language)}`
                    : `Page ${currentPage} of ${totalPages}`}
                </span>
              )}
            </div>

            {/* Rows per page selector */}
            <div className="flex items-center gap-2 text-xs text-slate-600">
              <span className="font-medium">{language === "bn" ? "প্রতি পৃষ্ঠায়:" : "Per page:"}</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const newSize = Number(e.target.value);
                  setPageSize(newSize);
                  setCurrentPage(1);
                }}
                className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value={10}>{language === "bn" ? "১০ জন" : "10"}</option>
                <option value={20}>{language === "bn" ? "২০ জন" : "20"}</option>
                <option value={50}>{language === "bn" ? "৫০ জন" : "50"}</option>
                <option value={100}>{language === "bn" ? "১০০ জন" : "100"}</option>
              </select>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-700 mx-auto mb-2" />
              <p className="text-xs text-slate-500">{t.common.loading}</p>
            </div>
          ) : users.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-2" />
              <h3 className="font-bold text-slate-800 text-sm">
                {language === "bn" ? "কোন ইউজার পাওয়া যায়নি" : "No users found"}
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                {language === "bn" ? "আপনার বর্তমান ফিল্টারের সাথে মিলে এমন কোনো কর্মকর্তা পাওয়া যায়নি।" : "No officer records match your filter criteria."}
              </p>
            </div>
          ) : (
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200 whitespace-nowrap">
                  <tr>
                    <th className="py-3 px-4">{t.adminUsers.colName}</th>
                    <th className="py-3 px-4">{t.adminUsers.colDesignation}</th>
                    <th className="py-3 px-4">{t.adminUsers.colRole}</th>
                    <th className="py-3 px-4">{language === "bn" ? "অধিক্ষেত্র, উপজেলা ও দপ্তর" : "Jurisdiction & Department"}</th>
                    <th className="py-3 px-4 text-center">{t.adminUsers.colStatus}</th>
                    <th className="py-3 px-4 text-center">{t.adminUsers.colActions}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {users.map((u) => {
                    const isSuper = u.role === "SUPER_ADMIN";
                    const isUpazila = u.role === "UPAZILA_ADMIN";
                    const isDept = u.role === "DEPT_OFFICER" || u.role === "DEPARTMENT_OFFICER";
                    const isUnion = u.role === "UNION_VIEWER";

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Name & Email */}
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-sm">{u.name}</div>
                          <div className="text-[11px] text-slate-500 font-mono mt-0.5">{u.email}</div>
                        </td>

                        {/* Designation (পদবি) */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <BadgeCheck className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                            <span>{u.designation || (language === "bn" ? "পদবি উল্লেখ নেই" : "Not specified")}</span>
                          </div>
                          {u.phone && (
                            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                              📞 {u.phone}
                            </div>
                          )}
                        </td>

                        {/* Role Badge */}
                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold border ${
                              isSuper
                                ? "bg-purple-100 text-purple-900 border-purple-300"
                                : isUpazila
                                ? "bg-amber-100 text-amber-900 border-amber-300"
                                : isDept
                                ? "bg-blue-100 text-blue-900 border-blue-300"
                                : "bg-emerald-100 text-emerald-900 border-emerald-300"
                            }`}
                          >
                            <Shield className="w-3 h-3" />
                            {isSuper
                              ? (language === "bn" ? (u.email.includes("dc") ? "জেলা প্রশাসক (সুপার এডমিন)" : "সিস্টেম এডমিনিস্ট্রেটর") : "Super Admin")
                              : isUpazila
                              ? (language === "bn" ? "উপজেলা এডমিন (ইউএনও)" : "Upazila Admin (UNO)")
                              : isDept
                              ? t.roles.DEPT_OFFICER
                              : isUnion
                              ? t.roles.UNION_VIEWER
                              : u.role}
                          </span>
                        </td>

                        {/* Jurisdiction, Upazila & Department / Union */}
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                            <span>
                              {u.upazilaName
                                ? `${u.upazilaName} উপজেলা`
                                : isSuper
                                ? (language === "bn" ? "সমগ্র নেত্রকোণা জেলা (জেলা পর্যায়)" : "District Level (All Upazilas)")
                                : (language === "bn" ? "জেলা প্রশাসন" : "District Level")}
                            </span>
                          </div>

                          {isDept ? (
                            <div className="flex items-center gap-1.5 text-slate-600 text-[11px] mt-0.5">
                              <Building2 className="w-3 h-3 text-blue-600 shrink-0" />
                              <span>{getDepartmentName(u.department, language) || (language === "bn" ? "দপ্তর নির্ধারিত নেই" : "No department assigned")}</span>
                            </div>
                          ) : isUnion ? (
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {language === "bn" ? "ইউনিয়ন: " : "Union: "}{u.unionName || (language === "bn" ? "নির্ধারিত নেই" : "Not specified")}
                            </div>
                          ) : (
                            <div className="text-[10px] text-purple-700 font-medium mt-0.5">
                              {language === "bn" ? "প্রশাসনিক নিরীক্ষা ও সার্বিক নিয়ন্ত্রণ" : "Executive & Audit Authority"}
                            </div>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleActive(u)}
                            disabled={isUpazilaAdmin && u.role === "SUPER_ADMIN"}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase transition-all cursor-pointer ${
                              u.isActive
                                ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300"
                                : "bg-red-100 text-red-800 hover:bg-red-200 border border-red-300"
                            } ${isUpazilaAdmin && u.role === "SUPER_ADMIN" ? "opacity-60 cursor-not-allowed" : ""}`}
                          >
                            {u.isActive ? t.adminUsers.statusActive : t.adminUsers.statusInactive}
                          </button>
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Edit Button */}
                            <button
                              type="button"
                              disabled={isUpazilaAdmin && u.role === "SUPER_ADMIN"}
                              onClick={() => {
                                setEditTargetUser(u);
                                setEditName(u.name);
                                setEditDesignation(u.designation || "");
                                setEditRole(u.role);
                                setEditDeptId(u.departmentId || departments[0]?.id || "");
                                setEditUpazilaName(u.upazilaName || "নেত্রকোণা সদর");
                                setEditUnionName(u.unionName || "");
                                setShowEditModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-900 border border-blue-300 text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              title={t.adminUsers.btnEdit}
                            >
                              <Edit className="w-3 h-3 text-blue-700" />
                              <span>{t.adminUsers.btnEdit}</span>
                            </button>

                            {/* Reset Password Button */}
                            <button
                              type="button"
                              disabled={isUpazilaAdmin && u.role === "SUPER_ADMIN"}
                              onClick={() => {
                                setTargetUser(u);
                                setResetNewPass("admin123");
                                setShowResetModal(true);
                              }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                              title={t.adminUsers.btnResetPass}
                            >
                              <KeyRound className="w-3 h-3 text-amber-700" />
                              <span>{t.adminUsers.btnResetPass}</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Controls Bar */}
          <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-slate-600 font-medium">
              {totalRecords > 0 ? (
                language === "bn" ? (
                  <>
                    প্রদর্শিত হচ্ছে{" "}
                    <span className="font-bold text-slate-900">
                      {formatNumber((currentPage - 1) * pageSize + 1, language)}
                    </span>
                    {" - "}
                    <span className="font-bold text-slate-900">
                      {formatNumber(Math.min(currentPage * pageSize, totalRecords), language)}
                    </span>
                    {" (মোট "}
                    <span className="font-bold text-slate-900">
                      {formatNumber(totalRecords, language)}
                    </span>
                    {" জন কর্মকর্তার মধ্যে)"}
                  </>
                ) : (
                  <>
                    Showing{" "}
                    <span className="font-bold text-slate-900">
                      {(currentPage - 1) * pageSize + 1}
                    </span>
                    {" - "}
                    <span className="font-bold text-slate-900">
                      {Math.min(currentPage * pageSize, totalRecords)}
                    </span>
                    {" of "}
                    <span className="font-bold text-slate-900">{totalRecords}</span>
                    {" officers"}
                  </>
                )
              ) : (
                <span>{language === "bn" ? "কোন তথ্য নেই" : "No records"}</span>
              )}
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5">
                {/* First Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1 || loading}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title={language === "bn" ? "প্রথম পৃষ্ঠা" : "First Page"}
                >
                  <ChevronsLeft className="w-4 h-4" />
                </button>

                {/* Previous Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1 || loading}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">{language === "bn" ? "পূর্ববর্তী" : "Prev"}</span>
                </button>

                {/* Page Numbers */}
                <div className="flex items-center gap-1">
                  {getPageNumbers().map((pg, idx) =>
                    pg === "..." ? (
                      <span key={`ellipsis-${idx}`} className="px-2 text-slate-400 text-xs">
                        ...
                      </span>
                    ) : (
                      <button
                        key={`page-${pg}`}
                        type="button"
                        onClick={() => setCurrentPage(Number(pg))}
                        disabled={loading}
                        className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          currentPage === pg
                            ? "bg-emerald-700 text-white shadow-xs"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {formatNumber(Number(pg), language)}
                      </button>
                    )
                  )}
                </div>

                {/* Next Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages || loading}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="hidden sm:inline">{language === "bn" ? "পরবর্তী" : "Next"}</span>
                  <ChevronRight className="w-4 h-4" />
                </button>

                {/* Last Page */}
                <button
                  type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages || loading}
                  className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  title={language === "bn" ? "সর্বশেষ পৃষ্ঠা" : "Last Page"}
                >
                  <ChevronsRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* MODAL 1: Create New User */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-lg w-[95vw] p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                    <Plus className="w-5 h-5" />
                  </div>
                  <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                    {t.adminUsers.modalCreateTitle}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t.adminUsers.labelName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder={language === "bn" ? "যেমন: মো: রফিকুল ইসলাম" : "e.g. Md. Rafiqul Islam"}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t.adminUsers.labelDesignation} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newDesignation}
                    onChange={(e) => setNewDesignation(e.target.value)}
                    placeholder={t.adminUsers.placeholderDesignation}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {[
                      language === "bn" ? "উপজেলা সমাজসেবা কর্মকর্তা" : "Social Services Officer",
                      language === "bn" ? "উপজেলা মহিলা বিষয়ক কর্মকর্তা" : "Women Affairs Officer",
                      language === "bn" ? "ইউপি সচিব" : "UP Secretary",
                      language === "bn" ? "উপজেলা নির্বাহী অফিসার" : "Upazila Nirbahi Officer",
                    ].map((sug) => (
                      <button
                        key={sug}
                        type="button"
                        onClick={() => setNewDesignation(sug)}
                        className="text-[10px] px-2 py-0.5 rounded-md bg-slate-100 hover:bg-emerald-50 hover:text-emerald-800 text-slate-600 border border-slate-200 transition-colors"
                      >
                        + {sug}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t.adminUsers.labelEmail} *
                  </label>
                  <input
                    type="email"
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    placeholder="officer@netrokona.gov.bd"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t.adminUsers.labelRole} *
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  >
                    <option value="DEPT_OFFICER">{t.roles.DEPT_OFFICER}</option>
                    <option value="UNION_VIEWER">{t.roles.UNION_VIEWER}</option>
                    {isSuperAdmin && (
                      <>
                        <option value="UPAZILA_ADMIN">{language === "bn" ? "উপজেলা এডমিন (ইউএনও)" : "Upazila Admin (UNO)"}</option>
                        <option value="SUPER_ADMIN">{t.roles.SUPER_ADMIN}</option>
                      </>
                    )}
                  </select>
                </div>

                {/* Upazila Selection */}
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === "bn" ? "অধিক্ষেত্র / উপজেলা" : "Jurisdiction Upazila"} *
                  </label>
                  <select
                    value={isUpazilaAdmin ? currentUser.upazilaName || "" : newUpazilaName}
                    onChange={(e) => setNewUpazilaName(e.target.value)}
                    disabled={isUpazilaAdmin}
                    className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                      isUpazilaAdmin ? "bg-slate-100 border-slate-300 text-slate-700 cursor-not-allowed" : "border-slate-300 bg-white"
                    }`}
                  >
                    {NETROKONA_UPAZILAS.map((upz) => (
                      <option key={upz.key} value={upz.nameBn}>
                        {upz.nameBn} ({upz.nameEn})
                      </option>
                    ))}
                  </select>
                </div>

                {newRole === "DEPT_OFFICER" && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {t.adminUsers.labelDept} *
                    </label>
                    <select
                      value={newDeptId}
                      onChange={(e) => setNewDeptId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {getDepartmentName(d, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {newRole === "UNION_VIEWER" && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {t.adminUsers.labelUnion} *
                    </label>
                    <input
                      type="text"
                      required
                      value={newUnionName}
                      onChange={(e) => setNewUnionName(e.target.value)}
                      placeholder={language === "bn" ? "যেমন: বাহাদুরপুর" : "e.g. Bahadurpur"}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t.adminUsers.labelPassword} *
                  </label>
                  <input
                    type="text"
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center justify-center transition-colors"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={creating}
                    className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold shadow-xs transition-all cursor-pointer"
                  >
                    {creating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {t.adminUsers.btnSubmitCreate}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: Reset Password */}
        {showResetModal && targetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-[95vw] p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t.adminUsers.modalResetTitle}
                    </h3>
                    <p className="text-[11px] text-slate-500">{targetUser.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowResetModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <div>{t.adminUsers.colEmail}: <strong className="font-mono text-slate-900">{targetUser.email}</strong></div>
              </div>

              <form onSubmit={handleResetPassword} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {language === "bn" ? "নতুন পাসওয়ার্ড" : "New Password"} *
                  </label>
                  <div className="relative">
                    <input
                      type={showResetPassText ? "text" : "password"}
                      required
                      value={resetNewPass}
                      onChange={(e) => setResetNewPass(e.target.value)}
                      className="w-full pr-10 px-3 py-2 rounded-xl border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassText(!showResetPassText)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                    >
                      {showResetPassText ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResetModal(false)}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center justify-center transition-colors"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={resetting}
                    className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold shadow-xs transition-all cursor-pointer"
                  >
                    {resetting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {t.adminUsers.btnSubmitReset}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 3: Edit User Details */}
        {showEditModal && editTargetUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
            <div className="bg-white rounded-2xl sm:rounded-3xl max-w-md w-[95vw] p-4 sm:p-6 shadow-2xl border border-slate-200 space-y-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-800 flex items-center justify-center shrink-0">
                    <Edit className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                      {t.adminUsers.modalEditTitle}
                    </h3>
                    <p className="text-[11px] text-slate-500">{editTargetUser.name}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="text-slate-400 hover:text-slate-600 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleUpdateUser} className="space-y-4 text-xs">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t.adminUsers.labelName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    {t.adminUsers.labelDesignation} *
                  </label>
                  <input
                    type="text"
                    required
                    value={editDesignation}
                    onChange={(e) => setEditDesignation(e.target.value)}
                    placeholder={t.adminUsers.placeholderDesignation}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {isSuperAdmin && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {t.adminUsers.labelRole} *
                    </label>
                    <select
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="SUPER_ADMIN">{t.roles.SUPER_ADMIN}</option>
                      <option value="UPAZILA_ADMIN">{language === "bn" ? "উপজেলা এডমিন (ইউএনও)" : "Upazila Admin (UNO)"}</option>
                      <option value="DEPT_OFFICER">{t.roles.DEPT_OFFICER}</option>
                      <option value="UNION_VIEWER">{t.roles.UNION_VIEWER}</option>
                    </select>
                  </div>
                )}

                {isSuperAdmin && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {language === "bn" ? "উপজেলা" : "Upazila"}
                    </label>
                    <select
                      value={editUpazilaName}
                      onChange={(e) => setEditUpazilaName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="">{language === "bn" ? "জেলা পর্যায় (নির্দিষ্ট উপজেলা নেই)" : "District Level"}</option>
                      {NETROKONA_UPAZILAS.map((upz) => (
                        <option key={upz.key} value={upz.nameBn}>
                          {upz.nameBn}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editRole === "DEPT_OFFICER" && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {t.adminUsers.labelDept} *
                    </label>
                    <select
                      value={editDeptId}
                      onChange={(e) => setEditDeptId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {getDepartmentName(d, language)}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {editRole === "UNION_VIEWER" && (
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      {t.adminUsers.labelUnion} *
                    </label>
                    <input
                      type="text"
                      required
                      value={editUnionName}
                      onChange={(e) => setEditUnionName(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                )}

                <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-2 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="w-full sm:w-auto min-h-[44px] px-4 py-2 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer flex items-center justify-center transition-colors"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={updating}
                    className="w-full sm:w-auto min-h-[44px] inline-flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-bold shadow-xs transition-all cursor-pointer"
                  >
                    {updating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {language === "bn" ? "সংরক্ষণ করুন" : "Save Changes"}
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
