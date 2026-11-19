"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSession } from "next-auth/react";
import {
  Layers,
  Building2,
  Plus,
  Loader2,
  Calendar,
  Users,
  Search,
  Edit,
  Trash2,
  Coins,
  Wheat,
  Shuffle,
  ShieldCheck,
  Lock,
  AlertCircle,
  CheckCircle2,
  X,
  Filter,
  Info,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  calculateMonthlyEquivalent,
  FREQUENCY_OPTIONS,
  BENEFIT_TYPE_OPTIONS,
  COMMON_COMMODITIES,
} from "@/lib/scheme-calc";

interface Scheme {
  id: string;
  departmentId: string;
  name: string;
  nameBn?: string | null;
  nameEn?: string | null;
  monthlyAmount: number;
  frequency: string;
  benefitType: string;
  commodityName?: string | null;
  commodityNameBn?: string | null;
  commodityNameEn?: string | null;
  commodityQuantity?: number | null;
  commodityUnit?: string | null;
  commodityUnitBn?: string | null;
  commodityUnitEn?: string | null;
  commodityMarketValue?: number | null;
  cashAmount?: number | null;
  description?: string | null;
  department: {
    id: string;
    name: string;
    nameBn?: string | null;
    nameEn?: string | null;
  };
  _count?: {
    enrollments: number;
  };
}

interface Department {
  id: string;
  name: string;
  nameBn?: string | null;
  nameEn?: string | null;
  schemes?: Scheme[];
}

export default function SchemesPage() {
  const { data: session } = useSession();
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
  const user = session?.user;
  const userRole = user?.role || "UNION_VIEWER";
  const userDeptId = user?.departmentId || null;

  const isSuperAdmin = userRole === "SUPER_ADMIN";
  const isDeptOfficer = userRole === "DEPT_OFFICER" || userRole === "DEPARTMENT_OFFICER";
  const isUnionViewer = userRole === "UNION_VIEWER";

  const [schemes, setSchemes] = useState<Scheme[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedDeptFilter, setSelectedDeptFilter] = useState("ALL");
  const [selectedFreqFilter, setSelectedFreqFilter] = useState("ALL");
  const [selectedTypeFilter, setSelectedTypeFilter] = useState("ALL");

  // Add / Edit Modal State
  const [modalMode, setModalMode] = useState<"CREATE" | "EDIT" | null>(null);
  const [editingSchemeId, setEditingSchemeId] = useState<string | null>(null);

  // Form State
  const [formDeptId, setFormDeptId] = useState("");
  const [formNameBn, setFormNameBn] = useState("");
  const [formNameEn, setFormNameEn] = useState("");
  const [formFrequency, setFormFrequency] = useState("Monthly");
  const [formBenefitType, setFormBenefitType] = useState<"CASH" | "COMMODITY" | "HYBRID">("CASH");
  const [formCashAmount, setFormCashAmount] = useState<string>("600");
  const [formCommodityNameBn, setFormCommodityNameBn] = useState("");
  const [formCommodityNameEn, setFormCommodityNameEn] = useState("");
  const [formCommodityQty, setFormCommodityQty] = useState<string>("30");
  const [formCommodityUnitBn, setFormCommodityUnitBn] = useState<string>("কেজি");
  const [formCommodityUnitEn, setFormCommodityUnitEn] = useState<string>("kg");
  const [formCommodityMarketValue, setFormCommodityMarketValue] = useState<string>("1500");
  const [formDescription, setFormDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Department Management Modal (Super Admin)
  const [showDeptModal, setShowDeptModal] = useState(false);
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptFormNameBn, setDeptFormNameBn] = useState("");
  const [deptFormNameEn, setDeptFormNameEn] = useState("");
  const [deptSubmitting, setDeptSubmitting] = useState(false);
  const [deptErrorMsg, setDeptErrorMsg] = useState("");
  const [deptSuccessMsg, setDeptSuccessMsg] = useState("");

  // Delete Confirmation Modal State
  const [schemeToDelete, setSchemeToDelete] = useState<Scheme | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [deptRes, schemeRes] = await Promise.all([
        fetch("/api/departments"),
        fetch("/api/schemes"),
      ]);

      const deptData = await deptRes.json();
      const schemeData = await schemeRes.json();

      if (deptData.success && deptData.departments) {
        setDepartments(deptData.departments);
      }
      if (schemeData.success && schemeData.schemes) {
        setSchemes(schemeData.schemes);
      }
    } catch (err) {
      console.error("Failed to load initial scheme data:", err);
    } finally {
      setLoading(false);
    }
  };

  // Open Create Modal
  const openCreateModal = () => {
    setErrorMsg("");
    setSuccessMsg("");
    setModalMode("CREATE");
    setEditingSchemeId(null);
    setFormNameBn("");
    setFormNameEn("");
    setFormFrequency("Monthly");
    setFormBenefitType("CASH");
    setFormCashAmount("600");
    setFormCommodityNameBn("");
    setFormCommodityNameEn("");
    setFormCommodityQty("30");
    setFormCommodityUnitBn("কেজি");
    setFormCommodityUnitEn("kg");
    setFormCommodityMarketValue("1500");
    setFormDescription("");

    if (isDeptOfficer && userDeptId) {
      setFormDeptId(userDeptId);
    } else if (departments.length > 0) {
      setFormDeptId(departments[0].id);
    }
  };

  // Open Edit Modal
  const openEditModal = (scheme: Scheme) => {
    if (isDeptOfficer && scheme.departmentId !== userDeptId) {
      alert(language === "bn" ? "আপনি শুধুমাত্র নিজের নির্ধারিত দপ্তরের কর্মসূচি সম্পাদনা করতে পারবেন।" : "You can only edit schemes for your own department.");
      return;
    }
    if (isUnionViewer) {
      alert(language === "bn" ? "ইউনিয়ন পর্যবেক্ষকের কর্মসূচি সম্পাদনা করার অনুমতি নেই।" : "Union viewers cannot edit welfare schemes.");
      return;
    }

    setErrorMsg("");
    setSuccessMsg("");
    setModalMode("EDIT");
    setEditingSchemeId(scheme.id);
    setFormDeptId(scheme.departmentId);
    setFormNameBn(scheme.nameBn || getSchemeName(scheme, "bn"));
    setFormNameEn(scheme.nameEn || getSchemeName(scheme, "en"));
    setFormFrequency(scheme.frequency || "Monthly");
    setFormBenefitType((scheme.benefitType as any) || "CASH");
    setFormCashAmount(scheme.cashAmount ? String(scheme.cashAmount) : "");
    setFormCommodityNameBn(scheme.commodityNameBn || scheme.commodityName || "");
    setFormCommodityNameEn(scheme.commodityNameEn || scheme.commodityName || "");
    setFormCommodityQty(scheme.commodityQuantity ? String(scheme.commodityQuantity) : "30");
    setFormCommodityUnitBn(scheme.commodityUnitBn || scheme.commodityUnit || "কেজি");
    setFormCommodityUnitEn(scheme.commodityUnitEn || scheme.commodityUnit || "kg");
    setFormCommodityMarketValue(
      scheme.commodityMarketValue ? String(scheme.commodityMarketValue) : "1500"
    );
    setFormDescription(scheme.description || "");
  };

  // Handle Commodity Quick Preset
  const applyCommodityPreset = (preset: (typeof COMMON_COMMODITIES)[0]) => {
    setFormCommodityNameBn(preset.nameBn);
    setFormCommodityNameEn(preset.nameEn);
    setFormCommodityQty(String(preset.typicalQty));
    setFormCommodityUnitBn(preset.defaultUnitBn);
    setFormCommodityUnitEn(preset.defaultUnitEn);
    setFormCommodityMarketValue(String(preset.typicalRate * preset.typicalQty));
  };

  // Live Monthly Calculation
  const liveCalculation = useMemo(() => {
    return calculateMonthlyEquivalent({
      benefitType: formBenefitType,
      cashAmount: parseFloat(formCashAmount) || 0,
      commodityMarketValue: parseFloat(formCommodityMarketValue) || 0,
      frequency: formFrequency,
    });
  }, [formBenefitType, formCashAmount, formCommodityMarketValue, formFrequency]);

  // Handle Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!formDeptId) {
      setErrorMsg(language === "bn" ? "দপ্তর নির্বাচন করুন" : "Please select a department");
      return;
    }
    const cleanBn = formNameBn.trim();
    const cleanEn = formNameEn.trim();
    if (!cleanBn && !cleanEn) {
      setErrorMsg(language === "bn" ? "কর্মসূচির নাম (বাংলা অথবা ইংরেজি) প্রদান করুন" : "Please enter scheme name in Bengali or English");
      return;
    }

    if (isDeptOfficer && formDeptId !== userDeptId) {
      setErrorMsg(language === "bn" ? "দপ্তর কর্মকর্তা শুধুমাত্র নিজের দপ্তরের কর্মসূচি তৈরি করতে পারবেন।" : "Officers can only create schemes for their assigned department.");
      return;
    }

    try {
      setSubmitting(true);
      const compositeName = cleanEn && cleanBn && cleanEn !== cleanBn ? `${cleanEn} (${cleanBn})` : (cleanBn || cleanEn);
      const payload = {
        departmentId: formDeptId,
        name: compositeName,
        nameBn: cleanBn || null,
        nameEn: cleanEn || null,
        frequency: formFrequency,
        benefitType: formBenefitType,
        cashAmount:
          formBenefitType !== "COMMODITY" && formCashAmount ? parseFloat(formCashAmount) : null,
        commodityName: formBenefitType !== "CASH" ? (formCommodityNameBn.trim() || formCommodityNameEn.trim()) : null,
        commodityNameBn: formBenefitType !== "CASH" ? formCommodityNameBn.trim() : null,
        commodityNameEn: formBenefitType !== "CASH" ? formCommodityNameEn.trim() : null,
        commodityQuantity:
          formBenefitType !== "CASH" && formCommodityQty ? parseFloat(formCommodityQty) : null,
        commodityUnit: formBenefitType !== "CASH" ? (formCommodityUnitBn.trim() || formCommodityUnitEn.trim()) : null,
        commodityUnitBn: formBenefitType !== "CASH" ? formCommodityUnitBn.trim() : null,
        commodityUnitEn: formBenefitType !== "CASH" ? formCommodityUnitEn.trim() : null,
        commodityMarketValue:
          formBenefitType !== "CASH" && formCommodityMarketValue
            ? parseFloat(formCommodityMarketValue)
            : null,
        description: formDescription.trim() || null,
      };

      const url =
        modalMode === "EDIT" && editingSchemeId
          ? `/api/schemes/${editingSchemeId}`
          : "/api/schemes";
      const method = modalMode === "EDIT" ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        setErrorMsg(data.error || (language === "bn" ? "সংরক্ষণ ব্যর্থ হয়েছে" : "Save failed"));
        return;
      }

      setSuccessMsg(
        modalMode === "EDIT"
          ? (language === "bn" ? "কর্মসূচি সফলভাবে হালনাগাদ করা হয়েছে!" : "Scheme updated successfully!")
          : (language === "bn" ? "নতুন সামাজিক নিরাপত্তা কর্মসূচি সফলভাবে যুক্ত হয়েছে!" : "New welfare scheme added successfully!")
      );

      await fetchInitialData();
      setTimeout(() => {
        setModalMode(null);
        setEditingSchemeId(null);
        setSuccessMsg("");
      }, 1000);
    } catch (err: any) {
      console.error("Scheme submit error:", err);
      setErrorMsg(language === "bn" ? "সার্ভারে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।" : "Server error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Delete Confirmation
  // Handle Save Department (Super Admin)
  const handleSaveDepartment = async (e: React.FormEvent) => {
    e.preventDefault();
    setDeptErrorMsg("");
    setDeptSuccessMsg("");
    const cleanBn = deptFormNameBn.trim();
    const cleanEn = deptFormNameEn.trim();
    if (!cleanBn && !cleanEn) {
      setDeptErrorMsg(
        language === "bn"
          ? "দপ্তরের নাম (বাংলা অথবা ইংরেজি) প্রদান করুন"
          : "Please provide department name in Bengali or English"
      );
      return;
    }
    try {
      setDeptSubmitting(true);
      const url = editingDeptId ? `/api/departments/${editingDeptId}` : "/api/departments";
      const method = editingDeptId ? "PATCH" : "POST";
      const body = editingDeptId
        ? { nameBn: cleanBn, nameEn: cleanEn, name: cleanEn || cleanBn }
        : { type: "DEPARTMENT", isDepartment: true, nameBn: cleanBn, nameEn: cleanEn, name: cleanEn || cleanBn };

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) {
        setDeptErrorMsg(data.error || "সংরক্ষণ ব্যর্থ হয়েছে");
        return;
      }
      setDeptSuccessMsg(
        editingDeptId
          ? (language === "bn" ? "দপ্তর সফলভাবে হালনাগাদ করা হয়েছে!" : "Department updated successfully!")
          : (language === "bn" ? "নতুন দপ্তর সফলভাবে যুক্ত হয়েছে!" : "New department added successfully!")
      );
      setDeptFormNameBn("");
      setDeptFormNameEn("");
      setEditingDeptId(null);
      await fetchInitialData();
      setTimeout(() => setDeptSuccessMsg(""), 3000);
    } catch (err: any) {
      setDeptErrorMsg(err.message || "ত্রুটি ঘটেছে");
    } finally {
      setDeptSubmitting(false);
    }
  };

  const handleEditDeptClick = (dept: Department) => {
    setDeptErrorMsg("");
    setDeptSuccessMsg("");
    setEditingDeptId(dept.id);
    setDeptFormNameBn(dept.nameBn || getDepartmentName(dept, "bn"));
    setDeptFormNameEn(dept.nameEn || getDepartmentName(dept, "en"));
  };

  const cancelEditDept = () => {
    setEditingDeptId(null);
    setDeptFormNameBn("");
    setDeptFormNameEn("");
    setDeptErrorMsg("");
  };

  const confirmDelete = async () => {
    if (!schemeToDelete) return;

    if (isDeptOfficer && schemeToDelete.departmentId !== userDeptId) {
      alert(language === "bn" ? "আপনি শুধুমাত্র নিজের দপ্তরের কর্মসূচি মুছে ফেলতে পারবেন।" : "You can only delete schemes for your own department.");
      return;
    }

    try {
      setDeleting(true);
      const res = await fetch(`/api/schemes/${schemeToDelete.id}`, {
        method: "DELETE",
      });
      const data = await res.json();

      if (!data.success) {
        alert(data.error || (language === "bn" ? "কর্মসূচি মুছে ফেলা সম্ভব হয়নি" : "Could not delete scheme"));
        return;
      }

      await fetchInitialData();
      setSchemeToDelete(null);
    } catch (err) {
      console.error("Delete error:", err);
      alert(language === "bn" ? "মুছে ফেলার সময় ত্রুটি ঘটেছে।" : "Error occurred during deletion.");
    } finally {
      setDeleting(false);
    }
  };

  const canModifyScheme = (scheme: Scheme) => {
    if (isSuperAdmin) return true;
    if (isDeptOfficer && userDeptId && scheme.departmentId === userDeptId) return true;
    return false;
  };

  const filteredSchemes = useMemo(() => {
    return schemes.filter((s) => {
      if (selectedDeptFilter !== "ALL" && s.departmentId !== selectedDeptFilter) return false;
      if (selectedFreqFilter !== "ALL" && s.frequency !== selectedFreqFilter) return false;
      if (selectedTypeFilter !== "ALL" && s.benefitType !== selectedTypeFilter) return false;
      if (search.trim()) {
        const query = search.toLowerCase();
        const deptBn = (s.department?.nameBn || "").toLowerCase();
        const deptEn = (s.department?.nameEn || "").toLowerCase();
        const deptRaw = (s.department?.name || "").toLowerCase();
        const schemeBn = (s.nameBn || "").toLowerCase();
        const schemeEn = (s.nameEn || "").toLowerCase();
        const schemeRaw = (s.name || "").toLowerCase();
        const commBn = (s.commodityNameBn || "").toLowerCase();
        const commEn = (s.commodityNameEn || "").toLowerCase();
        const commRaw = (s.commodityName || "").toLowerCase();
        return (
          deptBn.includes(query) ||
          deptEn.includes(query) ||
          deptRaw.includes(query) ||
          schemeBn.includes(query) ||
          schemeEn.includes(query) ||
          schemeRaw.includes(query) ||
          commBn.includes(query) ||
          commEn.includes(query) ||
          commRaw.includes(query)
        );
      }
      return true;
    });
  }, [schemes, selectedDeptFilter, selectedFreqFilter, selectedTypeFilter, search]);

  const assignedDeptName = useMemo(() => {
    if (!userDeptId) return null;
    const dept = departments.find((d) => d.id === userDeptId);
    return getDepartmentName(dept, language) || (language === "bn" ? "নির্ধারিত দপ্তর" : "Assigned Dept");
  }, [departments, userDeptId, language, getDepartmentName]);

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Top Header & Role Banner */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 mb-2">
                <Layers className="w-3.5 h-3.5 text-emerald-600" />
                {t.schemes.badge}
              </div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                {t.schemes.title}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                {t.schemes.subtitle}
              </p>
            </div>

            <div className="flex items-center gap-3">
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setDeptErrorMsg("");
                    setDeptSuccessMsg("");
                    setEditingDeptId(null);
                    setDeptFormNameBn("");
                    setDeptFormNameEn("");
                    setShowDeptModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-xs transition-all"
                >
                  <Building2 className="w-4 h-4 text-slate-500" />
                  {language === "bn" ? "দপ্তরসমূহ পরিচালনা" : "Manage Departments"}
                </button>
              )}
              {!isUnionViewer && (
                <button
                  onClick={openCreateModal}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  {t.schemes.btnAddScheme}
                </button>
              )}
            </div>
          </div>

          {/* Role Access Indicator */}
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-600">{t.common.activeRole}</span>
              {isSuperAdmin && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple-100 text-purple-900 font-bold">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  {t.roles.SUPER_ADMIN}
                </span>
              )}
              {isDeptOfficer && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-100 text-blue-900 font-bold">
                  <Lock className="w-3.5 h-3.5" />
                  {t.roles.DEPT_OFFICER}: {assignedDeptName}
                </span>
              )}
              {isUnionViewer && (
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-bold">
                  <Info className="w-3.5 h-3.5" />
                  {t.roles.UNION_VIEWER}
                </span>
              )}
            </div>

            <div className="text-slate-500">
              {language === "bn" ? "মোট নিবন্ধিত কর্মসূচি: " : "Total Programs Registered: "}
              <span className="font-bold text-slate-800">{formatNumber(schemes.length)}</span> {language === "bn" ? "টি" : ""}
            </div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex flex-col md:flex-row items-center gap-3">
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="text"
              placeholder={t.schemes.searchPlaceholder}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {/* Department Filter */}
            <select
              value={selectedDeptFilter}
              onChange={(e) => setSelectedDeptFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="ALL">{t.schemes.filterAllDept}</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {getDepartmentName(d, language)}
                </option>
              ))}
            </select>

            {/* Frequency Filter */}
            <select
              value={selectedFreqFilter}
              onChange={(e) => setSelectedFreqFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="ALL">{t.schemes.filterAllFreq}</option>
              {FREQUENCY_OPTIONS.map((f) => (
                <option key={f.value} value={f.value}>
                  {language === "bn" ? f.labelBn : f.labelEn}
                </option>
              ))}
            </select>

            {/* Benefit Type Filter */}
            <select
              value={selectedTypeFilter}
              onChange={(e) => setSelectedTypeFilter(e.target.value)}
              className="px-3 py-2 rounded-xl border border-slate-200 bg-white text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="ALL">{t.schemes.filterAllType}</option>
              {BENEFIT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {language === "bn" ? opt.labelBn : opt.labelEn}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Schemes Grid */}
        {loading ? (
          <div className="bg-white p-12 rounded-2xl text-center border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">{t.common.loading}</p>
          </div>
        ) : filteredSchemes.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl text-center border border-slate-200">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">
              {language === "bn" ? "কোনো কর্মসূচি পাওয়া যায়নি" : "No Schemes Found"}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {language === "bn" ? "ফিল্টার বা সার্চ পরিবর্তন করুন।" : "Try adjusting your search or filters."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredSchemes.map((scheme) => {
              const canEditThis = canModifyScheme(scheme);
              const isCommodity = scheme.benefitType === "COMMODITY";
              const isHybrid = scheme.benefitType === "HYBRID";
              const isCash = scheme.benefitType === "CASH" || !scheme.benefitType;

              return (
                <div
                  key={scheme.id}
                  className={`bg-white rounded-2xl p-5 shadow-xs border transition-all flex flex-col justify-between ${
                    canEditThis
                      ? "border-slate-200 hover:border-emerald-400 hover:shadow-md"
                      : "border-slate-200 opacity-90"
                  }`}
                >
                  <div className="space-y-3">
                    {/* Top Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {isCommodity && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            <Wheat className="w-3 h-3 text-amber-600" />
                            {t.schemes.typeCommodity}
                          </span>
                        )}
                        {isHybrid && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 text-[10px] font-bold">
                            <Shuffle className="w-3 h-3 text-indigo-600" />
                            {t.schemes.typeHybrid}
                          </span>
                        )}
                        {isCash && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold">
                            <Coins className="w-3 h-3 text-emerald-600" />
                            {t.schemes.typeCash}
                          </span>
                        )}

                        <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-semibold">
                          {FREQUENCY_OPTIONS.find((f) => f.value === scheme.frequency)?.[language === "bn" ? "labelBn" : "labelEn"] || scheme.frequency}
                        </span>
                      </div>

                      {/* Department Lock Indicator */}
                      {isDeptOfficer && (
                        <div>
                          {scheme.departmentId === userDeptId ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-[10px] font-bold">
                              {language === "bn" ? "নিজ দপ্তর" : "My Dept"}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px]">
                              <Lock className="w-2.5 h-2.5" />
                              {language === "bn" ? "অন্য দপ্তর" : "Other Dept"}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Department Name */}
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{getDepartmentName(scheme.department, language)}</span>
                    </div>

                    {/* Scheme Name */}
                    <h3 className="font-bold text-sm text-slate-900 leading-snug">
                      {getSchemeName(scheme, language)}
                    </h3>

                    {/* Benefit Details */}
                    <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-1.5 text-xs">
                      {(isCommodity || isHybrid) && (scheme.commodityName || scheme.commodityNameBn || scheme.commodityNameEn) && (
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Wheat className="w-3 h-3 text-amber-600" />
                            {language === "bn" ? "পণ্য / খাদ্যশস্য:" : "Commodity:"}
                          </span>
                          <span className="font-bold text-amber-900">
                            {formatNumber(scheme.commodityQuantity)} {getCommodityUnit(scheme, language)} {getCommodityName(scheme, language)}
                          </span>
                        </div>
                      )}

                      {(isCash || isHybrid) && scheme.cashAmount !== null && (
                        <div className="flex items-center justify-between text-slate-700">
                          <span className="flex items-center gap-1 text-slate-500">
                            <Coins className="w-3 h-3 text-emerald-600" />
                            {language === "bn" ? "বিতরণকালীন নগদ:" : "Disbursement Cash:"}
                          </span>
                          <span className="font-bold text-emerald-900">
                            {formatCurrency(scheme.cashAmount)}
                          </span>
                        </div>
                      )}

                      <div className="pt-1.5 border-t border-slate-200 flex items-center justify-between">
                        <span className="text-slate-500 font-medium">{t.schemes.cardEntitlement}</span>
                        <span className="text-sm font-black text-slate-900">
                          {formatCurrency(scheme.monthlyAmount)}
                          <span className="text-[10px] font-normal text-slate-500"> {t.common.perMonth}</span>
                        </span>
                      </div>
                    </div>

                    {/* Enrolled Beneficiaries Count */}
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        {t.schemes.cardBeneficiaries}
                      </span>
                      <span className="font-semibold text-slate-800">
                        {formatNumber(scheme._count?.enrollments || 0)} {t.schemes.cardPersons}
                      </span>
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                    {canEditThis ? (
                      <div className="flex items-center gap-2 w-full justify-end">
                        <button
                          type="button"
                          onClick={() => openEditModal(scheme)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-all"
                        >
                          <Edit className="w-3.5 h-3.5 text-slate-600" />
                          {t.common.edit}
                        </button>
                        <button
                          type="button"
                          onClick={() => setSchemeToDelete(scheme)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition-all"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          {t.common.delete}
                        </button>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 italic flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        {isUnionViewer
                          ? (language === "bn" ? "পর্যবেক্ষণ মোড" : "Read-Only Mode")
                          : (language === "bn" ? "অন্য দপ্তরের কর্মসূচি (লক)" : "Other Ministry Program (Locked)")}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create / Edit Scheme Modal */}
        {modalMode && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-xl w-full shadow-2xl border border-slate-200 space-y-5 my-8">
              {/* Modal Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                    {modalMode === "EDIT" ? <Edit className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-base">
                      {modalMode === "EDIT" ? t.schemes.modalEditTitle : t.schemes.modalAddTitle}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {isDeptOfficer
                        ? (language === "bn" ? `আপনার নির্ধারিত দপ্তর: ${assignedDeptName}` : `Your Assigned Department: ${assignedDeptName}`)
                        : (language === "bn" ? "সুপার অ্যাডমিন: সকল মন্ত্রণালয় নির্বাচনযোগ্য" : "Super Admin: All Ministries Selectable")}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setModalMode(null)}
                  className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 flex items-center justify-center"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Status alerts */}
              {errorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              )}
              {successMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-700 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{successMsg}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4 text-xs">
                {/* 1. Department Selection */}
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">
                    {t.schemes.labelMinistry} *
                  </label>
                  {isDeptOfficer ? (
                    <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-between text-slate-800 font-bold">
                      <span>{assignedDeptName}</span>
                      <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded flex items-center gap-1">
                        <Lock className="w-3 h-3" /> {language === "bn" ? "আপনার দপ্তর নির্ধারিত" : "Assigned Department"}
                      </span>
                    </div>
                  ) : (
                    <select
                      value={formDeptId}
                      onChange={(e) => setFormDeptId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    >
                      {departments.map((d) => (
                        <option key={d.id} value={d.id}>
                          {getDepartmentName(d, language)}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* 2. Scheme Name (Bangla & English Separate Fields) */}
                <div className="space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        {t.schemes.labelSchemeNameBn} *
                      </label>
                      <input
                        type="text"
                        placeholder={t.schemes.placeholderSchemeNameBn}
                        value={formNameBn}
                        onChange={(e) => setFormNameBn(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 uppercase mb-1">
                        {t.schemes.labelSchemeNameEn} *
                      </label>
                      <input
                        type="text"
                        placeholder={t.schemes.placeholderSchemeNameEn}
                        value={formNameEn}
                        onChange={(e) => setFormNameEn(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500">
                    {language === "bn"
                      ? "💡 বাংলায় পোর্টাল থাকলে বাংলা নাম এবং ইংরেজিতে সুইচ করলে ইংরেজি নাম দেখানো হবে।"
                      : "💡 The Bengali name displays in Bengali mode, and the English name displays in English mode."}
                  </p>
                </div>

                {/* 3. Benefit Type Selector */}
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1.5">
                    {t.schemes.labelBenefitType} *
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {BENEFIT_TYPE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setFormBenefitType(opt.value as any)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          formBenefitType === opt.value
                            ? "border-emerald-600 bg-emerald-50/50 ring-2 ring-emerald-500/30 text-emerald-950 font-bold"
                            : "border-slate-200 hover:border-slate-300 bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="text-xs leading-snug">
                          {language === "bn" ? opt.labelBn : opt.labelEn}
                        </div>
                        <div className="text-[10px] text-slate-400 font-normal mt-0.5 truncate">
                          {language === "bn" ? opt.descriptionBn : opt.descriptionEn}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 4. Commodity Specific Fields */}
                {(formBenefitType === "COMMODITY" || formBenefitType === "HYBRID") && (
                  <div className="p-4 rounded-2xl bg-amber-50/60 border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-amber-900 flex items-center gap-1.5">
                        <Wheat className="w-4 h-4 text-amber-700" />
                        {t.schemes.labelCommodityDetails}
                      </span>
                      <span className="text-[10px] text-amber-700">{t.schemes.quickPresets}</span>
                    </div>

                    {/* Quick presets */}
                    <div className="flex flex-wrap gap-1.5">
                      {COMMON_COMMODITIES.slice(0, 4).map((p) => (
                        <button
                          key={p.nameEn}
                          type="button"
                          onClick={() => applyCommodityPreset(p)}
                          className="px-2 py-1 rounded bg-white border border-amber-300 hover:bg-amber-100 text-[10px] font-semibold text-amber-900"
                        >
                          + {language === "bn" ? p.nameBn : p.nameEn} ({formatNumber(p.typicalQty)} {language === "bn" ? p.defaultUnitBn : p.defaultUnitEn})
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          {language === "bn" ? "পণ্যের নাম (বাংলা)" : "Commodity Name (Bangla)"}
                        </label>
                        <input
                          type="text"
                          placeholder={language === "bn" ? "যেমন: চাল, গম, সার" : "e.g., Rice, Wheat"}
                          value={formCommodityNameBn}
                          onChange={(e) => setFormCommodityNameBn(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          {language === "bn" ? "পণ্যের নাম (ইংরেজি)" : "Commodity Name (English)"}
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., Rice, Wheat, Fertilizer"
                          value={formCommodityNameEn}
                          onChange={(e) => setFormCommodityNameEn(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          {t.schemes.labelCommodityQty}
                        </label>
                        <input
                          type="number"
                          required
                          min="0.1"
                          step="any"
                          value={formCommodityQty}
                          onChange={(e) => setFormCommodityQty(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          {language === "bn" ? "একক (বাংলা)" : "Unit (Bangla)"}
                        </label>
                        <input
                          type="text"
                          placeholder="কেজি, বস্তা"
                          value={formCommodityUnitBn}
                          onChange={(e) => setFormCommodityUnitBn(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          {language === "bn" ? "একক (ইংরেজি)" : "Unit (English)"}
                        </label>
                        <input
                          type="text"
                          placeholder="kg, bag"
                          value={formCommodityUnitEn}
                          onChange={(e) => setFormCommodityUnitEn(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                        {t.schemes.labelMarketValue} *
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        placeholder="1500"
                        value={formCommodityMarketValue}
                        onChange={(e) => setFormCommodityMarketValue(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        {t.schemes.marketValueHelp}
                      </p>
                    </div>
                  </div>
                )}

                {/* 5. Cash Specific Fields */}
                {(formBenefitType === "CASH" || formBenefitType === "HYBRID") && (
                  <div>
                    <label className="block font-semibold text-slate-700 uppercase mb-1">
                      {t.schemes.labelCashAmount} *
                    </label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={formCashAmount}
                      onChange={(e) => setFormCashAmount(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                )}

                {/* 6. Frequency Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-slate-700 uppercase mb-1">
                      {t.schemes.labelFrequency} *
                    </label>
                    <select
                      value={formFrequency}
                      onChange={(e) => setFormFrequency(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl border border-slate-300 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                    >
                      {FREQUENCY_OPTIONS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {language === "bn" ? f.labelBn : f.labelEn}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Normalized Live Calculation Box */}
                  <div className="p-3 rounded-xl bg-emerald-50/80 border border-emerald-200 flex flex-col justify-center">
                    <span className="text-[10px] font-semibold text-emerald-800 uppercase">
                      {t.schemes.labelNormalizedMonthly}
                    </span>
                    <span className="text-base font-black text-emerald-950 mt-0.5">
                      {formatCurrency(liveCalculation.monthlyAmount)}{" "}
                      <span className="text-xs font-normal text-slate-600">{t.common.perMonth}</span>
                    </span>
                  </div>
                </div>

                {/* 7. Description */}
                <div>
                  <label className="block font-semibold text-slate-700 uppercase mb-1">
                    {t.schemes.labelDescription}
                  </label>
                  <textarea
                    rows={2}
                    placeholder={language === "bn" ? "কর্মসূচির উদ্দেশ্য বা যোগ্যতা সংক্ষেপে লিখুন..." : "Enter eligibility notes or objectives..."}
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>

                {/* Form Buttons */}
                <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setModalMode(null)}
                    className="px-4 py-2.5 rounded-xl border border-slate-300 font-semibold text-slate-700 hover:bg-slate-100 transition-all"
                  >
                    {t.common.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    {submitting ? t.common.saving : t.common.save}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {schemeToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl border border-slate-200 space-y-4">
              <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
                <Trash2 className="w-6 h-6" />
              </div>

              <div className="text-center space-y-1">
                <h3 className="font-bold text-slate-900 text-base">
                  {t.schemes.modalDeleteTitle}
                </h3>
                <p className="text-xs text-slate-500">
                  {language === "bn"
                    ? `আপনি কি নিশ্চিত যে "${getSchemeName(schemeToDelete, language)}" কর্মসূচিটি মুছে ফেলতে চান?`
                    : `Are you sure you want to permanently delete "${getSchemeName(schemeToDelete, language)}"?`}
                </p>
              </div>

              {schemeToDelete._count && schemeToDelete._count.enrollments > 0 ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800 space-y-1">
                  <p className="font-bold flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    {language === "bn" ? "সতর্কতা: সুবিধাভোগী বিদ্যমান" : "Warning: Active Beneficiaries Exist"}
                  </p>
                  <p>
                    {language === "bn"
                      ? `এই কর্মসূচিতে ${formatNumber(schemeToDelete._count.enrollments)} জন সুবিধাভোগী নিবন্ধিত আছেন। সুবিধাভোগী থাকা অবস্থায় মুছে ফেলা সম্ভব নয়।`
                      : `There are ${formatNumber(schemeToDelete._count.enrollments)} registered beneficiaries in this scheme. Cannot delete while beneficiaries exist.`}
                  </p>
                </div>
              ) : null}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSchemeToDelete(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                >
                  {t.common.cancel}
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting || (schemeToDelete._count?.enrollments || 0) > 0}
                  className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50 flex items-center gap-1.5"
                >
                  {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {deleting ? (language === "bn" ? "মুছে ফেলা হচ্ছে..." : "Deleting...") : t.common.delete}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Department Management Modal (Super Admin) */}
        {showDeptModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl p-6 max-w-2xl w-full shadow-2xl border border-slate-200 my-8 space-y-5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-emerald-50 text-emerald-800">
                    <Building2 className="w-5 h-5 text-emerald-700" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {language === "bn" ? "দপ্তরসমূহ ও মন্ত্রণালয় ব্যবস্থাপনা" : "Department & Ministry Management"}
                    </h2>
                    <p className="text-xs text-slate-500">
                      {language === "bn"
                        ? "দপ্তরের নাম বাংলা ও ইংরেজিতে আলাদাভাবে সংরক্ষণ করুন যাতে ভাষা পরিবর্তনের সাথে সঠিক নাম প্রদর্শিত হয়।"
                        : "Maintain separate Bengali and English department names for accurate localized display."}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDeptModal(false);
                    cancelEditDept();
                  }}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {deptErrorMsg && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{deptErrorMsg}</span>
                </div>
              )}

              {deptSuccessMsg && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>{deptSuccessMsg}</span>
                </div>
              )}

              {/* Add / Edit Department Form */}
              <form onSubmit={handleSaveDepartment} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                    {editingDeptId
                      ? (language === "bn" ? "দপ্তরের নাম সম্পাদনা" : "Edit Department")
                      : (language === "bn" ? "নতুন দপ্তর যুক্ত করুন" : "Add New Department")}
                  </h3>
                  {editingDeptId && (
                    <button
                      type="button"
                      onClick={cancelEditDept}
                      className="text-[11px] text-slate-500 hover:text-slate-800 underline"
                    >
                      {language === "bn" ? "বাতিল" : "Cancel"}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {language === "bn" ? "দপ্তরের নাম (বাংলা) *" : "Department Name (Bengali) *"}
                    </label>
                    <input
                      type="text"
                      placeholder="যেমন: সমাজসেবা অধিদপ্তর"
                      value={deptFormNameBn}
                      onChange={(e) => setDeptFormNameBn(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      {language === "bn" ? "দপ্তরের নাম (ইংরেজি) *" : "Department Name (English) *"}
                    </label>
                    <input
                      type="text"
                      placeholder="e.g., Department of Social Services"
                      value={deptFormNameEn}
                      onChange={(e) => setDeptFormNameEn(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 bg-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  {editingDeptId && (
                    <button
                      type="button"
                      onClick={cancelEditDept}
                      className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-600 hover:bg-slate-100"
                    >
                      {t.common.cancel}
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={deptSubmitting}
                    className="px-4 py-1.5 rounded-lg bg-emerald-800 hover:bg-emerald-900 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {deptSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {editingDeptId
                      ? (language === "bn" ? "আপডেট করুন" : "Update")
                      : (language === "bn" ? "দপ্তর সংরক্ষণ" : "Save Department")}
                  </button>
                </div>
              </form>

              {/* Existing Departments Table */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-slate-500 font-semibold">
                  <span>{language === "bn" ? "বিদ্যমান দপ্তরসমূহের তালিকা:" : "Existing Departments:"}</span>
                  <span>{formatNumber(departments.length)} {language === "bn" ? "টি দপ্তর" : "Departments"}</span>
                </div>
                <div className="border border-slate-200 rounded-2xl overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0 border-b border-slate-200">
                      <tr>
                        <th className="px-3 py-2.5">{language === "bn" ? "দপ্তরের নাম (বাংলা)" : "Name (Bengali)"}</th>
                        <th className="px-3 py-2.5">{language === "bn" ? "Department (English)" : "Name (English)"}</th>
                        <th className="px-3 py-2.5 text-center">{language === "bn" ? "কর্মসূচি" : "Schemes"}</th>
                        <th className="px-3 py-2.5 text-right">{t.common.actions}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {departments.map((d) => {
                        const schemeCount = schemes.filter((s) => s.departmentId === d.id).length;
                        return (
                          <tr key={d.id} className="hover:bg-slate-50/80 transition-all">
                            <td className="px-3 py-2.5 font-bold text-slate-900">
                              {d.nameBn || <span className="text-slate-400 italic font-normal">অনির্ধারিত</span>}
                            </td>
                            <td className="px-3 py-2.5 font-medium text-slate-700">
                              {d.nameEn || <span className="text-slate-400 italic font-normal">Unspecified</span>}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold">
                                {formatNumber(schemeCount)}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleEditDeptClick(d)}
                                className="px-2.5 py-1 rounded-lg border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 text-[11px] font-semibold transition-all inline-flex items-center gap-1"
                              >
                                <Edit className="w-3 h-3" />
                                {t.common.edit}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowDeptModal(false);
                    cancelEditDept();
                  }}
                  className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-800"
                >
                  {t.common.close}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
