"use client";

import React, { useState, useEffect, useMemo } from "react";
import * as XLSX from "xlsx";
import {
  Users,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Ban,
  Phone,
  Layers,
  MapPin,
  Loader2,
  ShieldAlert,
  ShieldCheck,
  Building2,
  Eye,
  Lock,
  Download,
  Printer,
  Edit2,
  Trash2,
  X,
  FileSpreadsheet,
  Check,
  Plus,
  Calendar,
  CalendarDays,
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
}

interface SchemeOption {
  id: string;
  name: string;
  departmentId: string;
  department?: {
    id: string;
    name: string;
  };
}

interface Enrollment {
  id: string;
  schemeId: string;
  cardNumber?: string | null;
  startDate: string;
  status: string;
  scheme: {
    id: string;
    name: string;
    monthlyAmount: number;
    department: {
      id: string;
      name: string;
    };
  };
}

interface Beneficiary {
  id: string;
  fullName: string;
  nameBn?: string | null;
  nameEn?: string | null;
  fatherName?: string | null;
  guardianName: string;
  gender: string;
  dateOfBirth?: string | null;
  nid?: string | null;
  brn?: string | null;
  mobile?: string | null;
  district?: string | null;
  upazilaName?: string | null;
  unionName: string;
  wardNo: string;
  enrollments: Enrollment[];
}

export default function BeneficiariesPage() {
  const { currentUser, isSuperAdmin, isDeptOfficer, isUnionViewer } = useAuth();
  const { language, t, formatNumber, formatCurrency, getDepartmentName, getSchemeName } = useLanguage();

  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [schemes, setSchemes] = useState<SchemeOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [upazila, setUpazila] = useState<string>(currentUser.upazilaName || "");
  const [union, setUnion] = useState("");
  const [ward, setWard] = useState("");
  const [gender, setGender] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [selectedDeptId, setSelectedDeptId] = useState("");

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    if (currentUser.upazilaName) {
      setUpazila(currentUser.upazilaName);
    }
  }, [currentUser.upazilaName]);

  // Create Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    nameBn: "",
    nameEn: "",
    fatherName: "",
    gender: "Female",
    dateOfBirth: "",
    nid: "",
    brn: "",
    mobile: "",
    district: "নেত্রকোণা",
    upazilaName: currentUser.upazilaName || "নেত্রকোণা সদর",
    unionName: "",
    wardNo: "",
    schemeId: "",
    cardNumber: "",
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Modal State
  const [editingBeneficiary, setEditingBeneficiary] = useState<Beneficiary | null>(null);
  const [editForm, setEditForm] = useState({
    nameBn: "",
    nameEn: "",
    fatherName: "",
    gender: "Female",
    dateOfBirth: "",
    nid: "",
    brn: "",
    mobile: "",
    district: "নেত্রকোণা",
    upazilaName: "নেত্রকোণা সদর",
    unionName: "",
    wardNo: "",
    cardNumber: "",
    enrollmentId: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Delete Modal State
  const [deletingBeneficiary, setDeletingBeneficiary] = useState<Beneficiary | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const unionsForCreate = useMemo(() => {
    const matched = NETROKONA_UPAZILAS.find(
      (u) => u.nameBn === createForm.upazilaName || u.nameEn === createForm.upazilaName
    );
    return matched ? matched.unions : [];
  }, [createForm.upazilaName]);

  const unionsForEdit = useMemo(() => {
    const matched = NETROKONA_UPAZILAS.find(
      (u) => u.nameBn === editForm.upazilaName || u.nameEn === editForm.upazilaName
    );
    return matched ? matched.unions : [];
  }, [editForm.upazilaName]);

  // Success Feedback
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [todayString, setTodayString] = useState("");

  useEffect(() => {
    setTodayString(new Date().toLocaleDateString(language === "bn" ? "bn-BD" : "en-US"));
  }, [language]);

  // Helper to calculate age from DOB
  const getAge = (dobString?: string | null): number | null => {
    if (!dobString) return null;
    const birth = new Date(dobString);
    if (isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age >= 0 ? age : null;
  };

  // Load departments and schemes
  useEffect(() => {
    fetch("/api/departments")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.departments)) {
          setDepartments(data.departments);
        }
      })
      .catch(() => {});

    fetch("/api/schemes")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && Array.isArray(data.schemes)) {
          setSchemes(data.schemes);
        }
      })
      .catch(() => {});
  }, []);

  // Department lock for DEPT_OFFICER
  useEffect(() => {
    if (isDeptOfficer && currentUser.departmentId) {
      setSelectedDeptId(currentUser.departmentId);
    }
  }, [isDeptOfficer, currentUser.departmentId]);

  // Auto-lock union if union viewer
  useEffect(() => {
    if (isUnionViewer && currentUser.unionName) {
      setUnion(currentUser.unionName);
    }
  }, [currentUser, isUnionViewer]);

  // Reset to first page when any search/filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, upazila, union, ward, gender, ageGroup, selectedDeptId]);

  // Fetch beneficiaries when pagination or filters change
  useEffect(() => {
    fetchBeneficiaries(currentPage, pageSize);
  }, [currentPage, pageSize, search, upazila, union, ward, gender, ageGroup, selectedDeptId]);

  const fetchBeneficiaries = async (pageToFetch = currentPage, limitToFetch = pageSize) => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      params.set("page", pageToFetch.toString());
      params.set("limit", limitToFetch.toString());
      if (search) params.set("search", search);
      if (upazila && upazila !== "all" && upazila !== "সমগ্র জেলা") params.set("upazila", upazila);
      if (union) params.set("union", union);
      if (ward) params.set("ward", ward);
      if (gender) params.set("gender", gender);
      if (ageGroup) params.set("ageGroup", ageGroup);
      if (selectedDeptId) params.set("departmentId", selectedDeptId);

      const res = await fetch(`/api/beneficiaries?${params.toString()}`);
      const data = await res.json();
      if (data?.success && data?.beneficiaries) {
        setBeneficiaries(data.beneficiaries);
        if (data.pagination) {
          setTotalRecords(data.pagination.total);
          setTotalPages(data.pagination.totalPages);
          setCurrentPage(data.pagination.page);
        } else {
          const total = data.total ?? data.beneficiaries.length;
          setTotalRecords(total);
          setTotalPages(Math.max(1, Math.ceil(total / limitToFetch)));
        }
      }
    } catch (err) {
      console.error("Fetch beneficiaries error:", err);
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

  // Scoped beneficiaries: Officers only see beneficiaries with enrollments under their department
  const scopedBeneficiaries = useMemo(() => {
    if (!beneficiaries) return [];
    if (isDeptOfficer && currentUser.departmentId) {
      return beneficiaries.filter((b) =>
        b.enrollments.some(
          (e) =>
            e.scheme.department.id === currentUser.departmentId ||
            (currentUser.departmentName &&
              e.scheme.department.name
                .toLowerCase()
                .includes(currentUser.departmentName.toLowerCase()))
        )
      );
    }
    return beneficiaries;
  }, [beneficiaries, isDeptOfficer, currentUser]);

  // Export to Excel (.xlsx)
  const handleExportExcel = async () => {
    if (!scopedBeneficiaries.length && totalRecords === 0) return;

    try {
      setIsExporting(true);
      let listToExport = scopedBeneficiaries;

      // If there are more records than currently loaded on this page, fetch all matching
      if (totalRecords > beneficiaries.length) {
        const params = new URLSearchParams();
        params.set("all", "true");
        if (search) params.set("search", search);
        if (upazila && upazila !== "all" && upazila !== "সমগ্র জেলা") params.set("upazila", upazila);
        if (union) params.set("union", union);
        if (ward) params.set("ward", ward);
        if (gender) params.set("gender", gender);
        if (ageGroup) params.set("ageGroup", ageGroup);
        if (selectedDeptId) params.set("departmentId", selectedDeptId);

        const res = await fetch(`/api/beneficiaries?${params.toString()}`);
        const data = await res.json();
        if (data?.success && Array.isArray(data.beneficiaries)) {
          listToExport = data.beneficiaries;
          if (isDeptOfficer && currentUser.departmentId) {
            listToExport = listToExport.filter((b: Beneficiary) =>
              b.enrollments.some(
                (e) =>
                  e.scheme.department.id === currentUser.departmentId ||
                  (currentUser.departmentName &&
                    e.scheme.department.name
                      .toLowerCase()
                      .includes(currentUser.departmentName.toLowerCase()))
              )
            );
          }
        }
      }

      if (!listToExport.length) return;

      const isBn = language === "bn";
      const exportRows = listToExport.map((b, idx) => {
        const activeEnrollments = b.enrollments.filter(
          (e) => e.status === "Active" || e.status === "Flagged"
        );
        const schemesList = activeEnrollments
          .map((e) => `${getSchemeName(e.scheme, language)} (${getDepartmentName(e.scheme.department, language)})`)
          .join("; ");
        const totalAmount = activeEnrollments.reduce(
          (sum, e) => sum + e.scheme.monthlyAmount,
          0
        );

        const ageVal = getAge(b.dateOfBirth);
        const dobFormatted = b.dateOfBirth ? new Date(b.dateOfBirth).toISOString().split("T")[0] : "";

        return isBn
          ? {
              "ক্রমিক নং": idx + 1,
              "উপকারভোগীর নাম (বাংলা)": b.nameBn || b.fullName,
              "উপকারভোগীর নাম (ইংরেজি)": b.nameEn || "",
              "পিতার নাম": b.fatherName || b.guardianName,
              "জন্ম তারিখ": dobFormatted || "প্রযোজ্য নয়",
              "বয়স": ageVal !== null ? `${ageVal} বছর` : "অজ্ঞাত",
              "লিঙ্গ": b.gender === "Female" ? "মহিলা" : b.gender === "Male" ? "পুরুষ" : "অন্যান্য",
              "জাতীয় পরিচয়পত্র (NID)": b.nid || "প্রযোজ্য নয়",
              "জন্ম নিবন্ধন (BRN)": b.brn || "প্রযোজ্য নয়",
              "মোবাইল নম্বর": b.mobile || "প্রযোজ্য নয়",
              "জেলা": b.district || "নেত্রকোণা",
              "উপজেলা": b.upazilaName || "নেত্রকোণা সদর",
              "ইউনিয়ন": b.unionName,
              "ওয়ার্ড": b.wardNo,
              "নিবন্ধিত কর্মসূচি": schemesList,
              "মোট মাসিক ভাতা (টাকা)": totalAmount,
              "স্ট্যাটাস": activeEnrollments.length > 1 ? "ডুপ্লিকেট / একাধিক ভাতা" : "একক ভাতা",
            }
          : {
              "SL No": idx + 1,
              "Beneficiary Name (Bengali)": b.nameBn || b.fullName,
              "Beneficiary Name (English)": b.nameEn || "",
              "Father's Name": b.fatherName || b.guardianName,
              "Date of Birth": dobFormatted || "N/A",
              "Age": ageVal !== null ? `${ageVal} yrs` : "N/A",
              "Gender": b.gender,
              "National ID (NID)": b.nid || "N/A",
              "Birth Certificate (BRN)": b.brn || "N/A",
              "Mobile Number": b.mobile || "N/A",
              "District": b.district || "Netrokona",
              "Upazila": b.upazilaName || "Netrokona Sadar",
              "Union": b.unionName,
              "Ward": b.wardNo,
              "Enrolled Programs": schemesList,
              "Total Monthly Amount (BDT)": totalAmount,
              "Status": activeEnrollments.length > 1 ? "Multiple Allowances (Duplicate)" : "Single Active",
            };
      });

      const worksheet = XLSX.utils.json_to_sheet(exportRows);
      const workbook = XLSX.utils.book_new();
      const sheetName = isBn ? "উপকারভোগী_রেজিস্ট্রি" : "Beneficiary_Registry";
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);

      const activeDeptObj = departments.find((d) => d.id === selectedDeptId);
      const activeDept = getDepartmentName(activeDeptObj, language) || "All_Depts";
      const cleanDeptName = activeDept.replace(/\s+/g, "_");
      const today = new Date().toISOString().split("T")[0];

      XLSX.writeFile(
        workbook,
        isBn
          ? `উপকারভোগী_তালিকা_${cleanDeptName}_${today}.xlsx`
          : `Beneficiaries_List_${cleanDeptName}_${today}.xlsx`
      );
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setIsExporting(false);
    }
  };

  // Trigger Print / PDF
  const handlePrint = () => {
    window.print();
  };

  // Open Edit Modal
  const handleOpenEdit = (b: Beneficiary) => {
    // Find relevant enrollment for this officer or first enrollment
    const relevantEnrollment = isDeptOfficer && currentUser.departmentId
      ? b.enrollments.find((e) => e.scheme.department.id === currentUser.departmentId) || b.enrollments[0]
      : b.enrollments[0];

    const dobFormatted = b.dateOfBirth
      ? new Date(b.dateOfBirth).toISOString().split("T")[0]
      : "";

    setEditForm({
      nameBn: b.nameBn || b.fullName || "",
      nameEn: b.nameEn || "",
      fatherName: b.fatherName || b.guardianName || "",
      gender: b.gender || "Female",
      dateOfBirth: dobFormatted,
      nid: b.nid || "",
      brn: b.brn || "",
      mobile: b.mobile || "",
      district: b.district || "নেত্রকোণা",
      upazilaName: b.upazilaName || currentUser.upazilaName || "নেত্রকোণা সদর",
      unionName: b.unionName || "",
      wardNo: b.wardNo || "",
      cardNumber: relevantEnrollment?.cardNumber || "",
      enrollmentId: relevantEnrollment?.id || "",
    });
    setEditError(null);
    setEditingBeneficiary(b);
  };

  // Save Edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBeneficiary) return;

    try {
      setEditSubmitting(true);
      setEditError(null);

      const res = await fetch("/api/beneficiaries", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingBeneficiary.id,
          nameBn: editForm.nameBn.trim(),
          nameEn: editForm.nameEn.trim() || null,
          fatherName: editForm.fatherName.trim(),
          gender: editForm.gender,
          dateOfBirth: editForm.dateOfBirth ? editForm.dateOfBirth : null,
          nid: editForm.nid.trim() || null,
          brn: editForm.brn.trim() || null,
          mobile: editForm.mobile.trim() || null,
          district: editForm.district.trim() || "নেত্রকোণা",
          upazilaName: editForm.upazilaName.trim() || "নেত্রকোণা সদর",
          unionName: editForm.unionName.trim(),
          wardNo: editForm.wardNo.trim(),
          enrollmentId: editForm.enrollmentId || undefined,
          cardNumber: editForm.cardNumber.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(
          language === "bn"
            ? `উপকারভোগী "${editForm.nameBn || editForm.nameEn}" এর তথ্য সফলভাবে আপডেট করা হয়েছে।`
            : `Beneficiary "${editForm.nameBn || editForm.nameEn}" updated successfully.`
        );
        setTimeout(() => setSuccessMessage(null), 5000);
        setEditingBeneficiary(null);
        fetchBeneficiaries();
      } else {
        setEditError(data.error || "Update failed.");
      }
    } catch (err) {
      console.error(err);
      setEditError("An unexpected error occurred while updating.");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Open Create Modal
  const handleOpenCreate = () => {
    const deptSchemes = isDeptOfficer && currentUser.departmentId
      ? schemes.filter((s) => s.departmentId === currentUser.departmentId)
      : schemes;

    setCreateForm({
      nameBn: "",
      nameEn: "",
      fatherName: "",
      gender: "Female",
      dateOfBirth: "",
      nid: "",
      brn: "",
      mobile: "",
      district: "নেত্রকোণা",
      upazilaName: currentUser.upazilaName || "নেত্রকোণা সদর",
      unionName: isUnionViewer && currentUser.unionName ? currentUser.unionName : "",
      wardNo: "",
      schemeId: deptSchemes[0]?.id || schemes[0]?.id || "",
      cardNumber: "",
    });
    setCreateError(null);
    setIsCreateOpen(true);
  };

  // Save Create
  const handleSaveCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreateSubmitting(true);
      setCreateError(null);

      const res = await fetch("/api/beneficiaries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameBn: createForm.nameBn.trim(),
          nameEn: createForm.nameEn.trim() || null,
          fatherName: createForm.fatherName.trim(),
          gender: createForm.gender,
          dateOfBirth: createForm.dateOfBirth ? createForm.dateOfBirth : null,
          nid: createForm.nid.trim() || null,
          brn: createForm.brn.trim() || null,
          mobile: createForm.mobile.trim() || null,
          district: createForm.district.trim() || "নেত্রকোণা",
          upazilaName: createForm.upazilaName.trim() || "নেত্রকোণা সদর",
          unionName: createForm.unionName.trim(),
          wardNo: createForm.wardNo.trim(),
          schemeId: createForm.schemeId || null,
          cardNumber: createForm.cardNumber.trim() || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(
          language === "bn"
            ? `নতুন সুবিধাভোগী "${createForm.nameBn}" সফলভাবে অন্তর্ভুক্ত করা হয়েছে।`
            : `Beneficiary "${createForm.nameBn}" registered successfully.`
        );
        setTimeout(() => setSuccessMessage(null), 5000);
        setIsCreateOpen(false);
        fetchBeneficiaries();
      } else {
        setCreateError(data.error || "Failed to create beneficiary.");
      }
    } catch (err) {
      console.error(err);
      setCreateError("An unexpected error occurred while saving.");
    } finally {
      setCreateSubmitting(false);
    }
  };

  // Open Delete Modal
  const handleOpenDelete = (b: Beneficiary) => {
    setDeletingBeneficiary(b);
  };

  // Confirm Delete
  const handleConfirmDelete = async () => {
    if (!deletingBeneficiary) return;

    try {
      setDeleteSubmitting(true);
      const params = new URLSearchParams();
      params.set("id", deletingBeneficiary.id);
      if (isDeptOfficer && currentUser.departmentId) {
        params.set("departmentId", currentUser.departmentId);
      }

      const res = await fetch(`/api/beneficiaries?${params.toString()}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(
          language === "bn"
            ? `উপকারভোগী "${deletingBeneficiary.fullName}" এর রেকর্ড সফলভাবে মুছে ফেলা হয়েছে।`
            : `Beneficiary "${deletingBeneficiary.fullName}" deleted successfully.`
        );
        setTimeout(() => setSuccessMessage(null), 5000);
        setDeletingBeneficiary(null);
        fetchBeneficiaries();
      } else {
        alert(data.error || "Failed to delete.");
      }
    } catch (err) {
      console.error(err);
      alert("An error occurred while deleting.");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      {/* Printable Report Header (Visible ONLY during window.print()) */}
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
            ? "সমন্বিত সামাজিক নিরাপত্তা ডাটাবেস - উপকারভোগীদের রেজিস্ট্রি"
            : "Integrated Social Safety Net Registry - Central Beneficiary Roster"}
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
            {language === "bn" ? "মোট রেকর্ড:" : "Total Records:"}{" "}
            {formatNumber(scopedBeneficiaries.length, language)}
          </span>
        </div>
      </div>

      <div className="max-w-7xl mx-auto space-y-6">
        {/* Success Alert Banner */}
        {successMessage && (
          <div className="no-print bg-emerald-50 border border-emerald-300 text-emerald-900 px-4 py-3 rounded-2xl flex items-center justify-between shadow-xs animate-in fade-in duration-300">
            <div className="flex items-center gap-2.5">
              <Check className="w-5 h-5 text-emerald-600 shrink-0" />
              <p className="text-xs font-semibold">{successMessage}</p>
            </div>
            <button
              onClick={() => setSuccessMessage(null)}
              className="text-emerald-700 hover:text-emerald-900 p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

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
                    ? "সকল দপ্তরের সুবিধাভোগীদের কেন্দ্রীয় ডাটাবেজ প্রদর্শিত হচ্ছে।"
                    : "Viewing central master database of beneficiaries across all departments.")}
                {isDeptOfficer &&
                  (language === "bn"
                    ? `আপনার দপ্তর (${getDepartmentName({ name: currentUser.departmentName, nameBn: currentUser.departmentNameBn, nameEn: currentUser.departmentNameEn }, "bn") || "দপ্তর"}) এর আওতাভুক্ত সুবিধাভোগীদের তালিকা প্রদর্শিত হচ্ছে।`
                    : `Viewing beneficiary registry enrolled under ${getDepartmentName({ name: currentUser.departmentName, nameBn: currentUser.departmentNameBn, nameEn: currentUser.departmentNameEn }, "en") || "your department"}.`)}
                {isUnionViewer &&
                  (language === "bn"
                    ? `আপনার ইউনিয়ন (${currentUser.unionName || "ইউনিয়ন"}) এর আওতাভুক্ত সুবিধাভোগীদের তালিকা প্রদর্শিত হচ্ছে।`
                    : `Viewing beneficiary registry residing in ${currentUser.unionName || "your assigned union"}.`)}
              </p>
            </div>
          </div>
        </div>

        {/* Header & Export Actions */}
        <div className="bg-white rounded-2xl p-6 shadow-xs border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-800 mb-2">
              <Users className="w-3.5 h-3.5 text-emerald-600" />
              {t.beneficiariesPage.badge}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {t.beneficiariesPage.title}
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              {t.beneficiariesPage.subtitle}
            </p>
          </div>

          {/* Action Buttons: Add Beneficiary, Excel & Print */}
          <div className="no-print flex items-center gap-2 shrink-0">
            {!isUnionViewer && (
              <button
                onClick={handleOpenCreate}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                {t.beneficiariesPage.btnAddBeneficiary}
              </button>
            )}

            <button
              onClick={handleExportExcel}
              disabled={loading || isExporting || (scopedBeneficiaries.length === 0 && totalRecords === 0)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold shadow-xs border border-slate-300 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin text-emerald-700" />
              ) : (
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
              )}
              {isExporting ? (language === "bn" ? "এক্সপোর্ট হচ্ছে..." : "Exporting...") : t.beneficiariesPage.exportExcel}
            </button>

            <button
              onClick={handlePrint}
              disabled={loading || scopedBeneficiaries.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              {t.beneficiariesPage.printPdf}
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="no-print bg-white rounded-2xl p-4 shadow-xs border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder={t.beneficiariesPage.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            {/* Department Filter (Super Admin sees all, Dept Officer is locked) */}
            <div className="relative">
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                disabled={isDeptOfficer}
                className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  isDeptOfficer
                    ? "bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed"
                    : "border-slate-300 bg-white"
                }`}
              >
                {!isDeptOfficer && (
                  <option value="">{t.beneficiariesPage.allDepartments}</option>
                )}
                {departments.map((dept) => (
                  <option key={dept.id} value={dept.id}>
                    {getDepartmentName(dept, language)}
                  </option>
                ))}
              </select>
              {isDeptOfficer && (
                <span className="absolute right-3 top-2.5 text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                  <Lock className="w-3 h-3" /> {t.common.locked}
                </span>
              )}
            </div>

            {/* Upazila Filter (Netrokona) */}
            <div className="relative">
              <select
                value={upazila}
                onChange={(e) => {
                  setUpazila(e.target.value);
                  setUnion("");
                }}
                disabled={Boolean(currentUser.upazilaName)}
                className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  currentUser.upazilaName
                    ? "bg-slate-100 border-slate-300 text-slate-700 font-semibold cursor-not-allowed"
                    : "border-slate-300 bg-white"
                }`}
              >
                <option value="">{language === "bn" ? "সকল উপজেলা (নেত্রকোণা)" : "All Upazilas (Netrokona)"}</option>
                {NETROKONA_UPAZILAS.map((upz) => (
                  <option key={upz.key} value={upz.nameBn}>
                    {upz.nameBn}
                  </option>
                ))}
              </select>
              {currentUser.upazilaName && (
                <span className="absolute right-3 top-2.5 text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                  <Lock className="w-3 h-3" /> {t.common.locked}
                </span>
              )}
            </div>

            {/* Union Filter */}
            <div className="relative">
              <input
                type="text"
                placeholder={t.beneficiariesPage.filterUnionPlaceholder}
                value={union}
                onChange={(e) => setUnion(e.target.value)}
                disabled={isUnionViewer}
                className={`w-full px-3 py-2 rounded-xl border text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  isUnionViewer
                    ? "bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed"
                    : "border-slate-300"
                }`}
              />
              {isUnionViewer && (
                <span className="absolute right-3 top-2.5 text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
                  <Lock className="w-3 h-3" /> {t.common.locked}
                </span>
              )}
            </div>

            {/* Ward Filter */}
            <input
              type="text"
              placeholder={t.beneficiariesPage.wardPlaceholder}
              value={ward}
              onChange={(e) => setWard(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />

            {/* Gender Filter */}
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">{t.beneficiariesPage.allGenders}</option>
              <option value="Female">{t.common.female}</option>
              <option value="Male">{t.common.male}</option>
              <option value="Other">{t.common.other}</option>
            </select>

            {/* Age Group Filter */}
            <select
              value={ageGroup}
              onChange={(e) => setAgeGroup(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-emerald-600"
            >
              <option value="">{t.beneficiariesPage.allAges}</option>
              <option value="0-17">{t.beneficiariesPage.ageGroupChildren}</option>
              <option value="18-35">{t.beneficiariesPage.ageGroupYouth}</option>
              <option value="36-59">{t.beneficiariesPage.ageGroupAdult}</option>
              <option value="60+">{t.beneficiariesPage.ageGroupSenior}</option>
            </select>
          </div>
        </div>

        {/* Beneficiaries Table */}
        {loading ? (
          <div className="bg-white p-12 rounded-2xl text-center border border-slate-200">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-2" />
            <p className="text-xs text-slate-500">{t.common.loading}</p>
          </div>
        ) : scopedBeneficiaries.length === 0 ? (
          <div className="bg-white p-12 rounded-2xl text-center border border-slate-200">
            <Users className="w-12 h-12 text-slate-400 mx-auto mb-2" />
            <h3 className="font-bold text-slate-800 text-base">{t.beneficiariesPage.noBeneficiaries}</h3>
            <p className="text-xs text-slate-500 mt-1">
              {isDeptOfficer
                ? (language === "bn" ? "আপনার দপ্তরের কোন সুবিধাভোগী পাওয়া যায়নি।" : "No beneficiaries found enrolled in your department.")
                : isUnionViewer
                ? (language === "bn" ? "আপনার ইউনিয়নের তালিকায় কোন সুবিধাভোগী পাওয়া যায়নি।" : "No beneficiaries found within your assigned union.")
                : (language === "bn" ? "কোনো সুবিধাভোগী রেকর্ড পাওয়া যায়নি।" : "No citizen records found matching current criteria.")}
            </p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-800">
                  {language === "bn"
                    ? `সর্বমোট নিবন্ধিত উপকারভোগী: ${formatNumber(totalRecords, language)} জন`
                    : `Total Registered: ${formatNumber(totalRecords, language)} citizens`}
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
                  <option value={10}>{language === "bn" ? "১০ টি" : "10"}</option>
                  <option value={20}>{language === "bn" ? "২০ টি" : "20"}</option>
                  <option value={50}>{language === "bn" ? "৫০ টি" : "50"}</option>
                  <option value={100}>{language === "bn" ? "১০০ টি" : "100"}</option>
                </select>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200">
                  <tr>
                    <th className="py-3 px-4">{t.beneficiariesPage.colCitizen}</th>
                    <th className="py-3 px-4">{language === "bn" ? "জাতীয় পরিচয়পত্র / জন্ম নিবন্ধন" : "Identification (NID / BRN)"}</th>
                    <th className="py-3 px-4">{t.beneficiariesPage.colLocation}</th>
                    <th className="py-3 px-4">{t.beneficiariesPage.colEnrolledPrograms}</th>
                    <th className="py-3 px-4">{t.dashboard.colTotalReceived}</th>
                    {!isUnionViewer && (
                      <th className="no-print py-3 px-4 text-right">{t.beneficiariesPage.colActions}</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-800">
                  {scopedBeneficiaries.map((b) => {
                    const activeCount = b.enrollments.filter(
                      (e) => e.status === "Active" || e.status === "Flagged"
                    ).length;
                    const totalAllowance = b.enrollments
                      .filter((e) => e.status === "Active" || e.status === "Flagged")
                      .reduce((sum, e) => sum + e.scheme.monthlyAmount, 0);

                    const ageVal = getAge(b.dateOfBirth);
                    const dobStr = b.dateOfBirth
                      ? new Date(b.dateOfBirth).toISOString().split("T")[0]
                      : null;

                    return (
                      <tr key={b.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="font-bold text-slate-900 text-sm">
                            {b.nameBn || b.fullName}
                          </div>
                          {b.nameEn && (
                            <div className="text-xs font-medium text-slate-600">
                              {b.nameEn}
                            </div>
                          )}
                          <div className="text-[11px] text-slate-500 mt-1 flex flex-wrap items-center gap-1.5">
                            <span>
                              <span className="font-semibold text-slate-600">{t.beneficiariesPage.fieldFatherName}:</span>{" "}
                              {b.fatherName || b.guardianName}
                            </span>
                            <span className="text-slate-300">•</span>
                            <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-700 font-medium text-[10px]">
                              {b.gender === "Female"
                                ? t.common.female
                                : b.gender === "Male"
                                ? t.common.male
                                : t.common.other}
                            </span>
                            {dobStr && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200 font-semibold">
                                  <Calendar className="w-3 h-3 text-emerald-600" />
                                  {ageVal !== null
                                    ? `${formatNumber(ageVal, language)} ${t.beneficiariesPage.yearsOld}`
                                    : ""}
                                  {" "}({dobStr})
                                </span>
                              </>
                            )}
                          </div>
                        </td>

                        <td className="py-3.5 px-4 font-mono">
                          {b.nid ? (
                            <div>
                              <span className="font-semibold text-slate-900">
                                {language === "bn" ? "এনআইডি:" : "NID:"} {b.nid}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                {b.nid.length === 10
                                  ? (language === "bn" ? "স্মার্টকার্ড" : "Smart Card")
                                  : b.nid.length === 17
                                  ? (language === "bn" ? "১৭ ডিজিট এনআইডি" : "Barcode NID")
                                  : (language === "bn" ? "পুরাতন এনআইডি" : "Legacy NID")}
                              </div>
                            </div>
                          ) : b.brn ? (
                            <span className="text-blue-800 font-semibold">
                              {language === "bn" ? "জন্ম নিবন্ধন:" : "BRN:"} {b.brn}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">
                              {language === "bn" ? "পরিচয়পত্র নেই" : "No National ID"}
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-slate-900">
                            {b.upazilaName || "নেত্রকোণা সদর"}, {b.unionName}
                          </div>
                          <div className="text-[11px] text-slate-500">
                            {language === "bn" ? `ওয়ার্ড ${formatNumber(b.wardNo, language)}` : `Ward ${b.wardNo}`} • {b.district || "নেত্রকোণা"}
                          </div>
                          {b.mobile && (
                            <div className="text-[11px] font-mono text-slate-600 flex items-center gap-1 mt-0.5">
                              <Phone className="w-3 h-3 text-slate-400" />
                              {b.mobile}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4 space-y-1">
                          {b.enrollments.map((enr) => (
                            <div
                              key={enr.id}
                              className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 text-[11px] mr-1 mb-1"
                            >
                              <span className="font-medium text-slate-800">
                                {getSchemeName(enr.scheme, language)}
                              </span>
                              <span className="text-emerald-700 font-bold">
                                {formatCurrency(enr.scheme.monthlyAmount, language)}
                              </span>
                              {enr.cardNumber && (
                                <span className="text-[10px] text-slate-500 font-mono">
                                  #{enr.cardNumber}
                                </span>
                              )}
                              <span
                                className={`text-[9px] px-1 rounded uppercase font-bold ${
                                  enr.status === "Active"
                                    ? "bg-emerald-200 text-emerald-900"
                                    : enr.status === "Flagged"
                                    ? "bg-red-200 text-red-900"
                                    : "bg-slate-300 text-slate-700"
                                }`}
                              >
                                {enr.status === "Active"
                                  ? t.beneficiariesPage.statusActive
                                  : enr.status === "Suspended"
                                  ? t.beneficiariesPage.statusSuspended
                                  : enr.status}
                              </span>
                            </div>
                          ))}
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="text-sm font-black text-slate-900">
                            {formatCurrency(totalAllowance, language)}
                            <span className="text-[10px] font-normal text-slate-500"> {t.common.perMonth}</span>
                          </div>
                          {activeCount > 1 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-red-700 bg-red-100 px-1.5 py-0.5 rounded mt-1">
                              <ShieldAlert className="w-3 h-3" />
                              {t.dashboard.crossDeptBadge} ({formatNumber(activeCount, language)})
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded mt-1">
                              <CheckCircle2 className="w-3 h-3" />
                              {t.dashboard.primarySchemeTag}
                            </span>
                          )}
                        </td>

                        {/* Edit & Delete Action Buttons */}
                        {!isUnionViewer && (
                          <td className="no-print py-3.5 px-4 text-right space-x-1 whitespace-nowrap">
                            <button
                              onClick={() => handleOpenEdit(b)}
                              title={t.beneficiariesPage.btnEdit}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>{t.beneficiariesPage.btnEdit}</span>
                            </button>
                            <button
                              onClick={() => handleOpenDelete(b)}
                              title={t.beneficiariesPage.btnDelete}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{t.beneficiariesPage.btnDelete}</span>
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

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
                      {" জনের মধ্যে)"}
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
                      {" beneficiaries"}
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
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={language === "bn" ? "প্রথম পৃষ্ঠা" : "First Page"}
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  {/* Previous Page */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1 || loading}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-colors"
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
                          className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition-all ${
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
                    className="px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-semibold flex items-center gap-1 transition-colors"
                  >
                    <span className="hidden sm:inline">{language === "bn" ? "পরবর্তী" : "Next"}</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Last Page */}
                  <button
                    type="button"
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages || loading}
                    className="p-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={language === "bn" ? "সর্বশেষ পৃষ্ঠা" : "Last Page"}
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Beneficiary Modal */}
      {isCreateOpen && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  {t.beneficiariesPage.createModalTitle}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCreate} className="p-5 space-y-4">
              {createError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{createError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Name (Bengali) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldNameBn} *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.nameBn}
                    onChange={(e) => setCreateForm({ ...createForm, nameBn: e.target.value })}
                    placeholder="যেমন: রহিমা খাতুন"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Name (English) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldNameEn}
                  </label>
                  <input
                    type="text"
                    value={createForm.nameEn}
                    onChange={(e) => setCreateForm({ ...createForm, nameEn: e.target.value })}
                    placeholder="e.g. Rahima Khatun"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Father's Name (Only Bengali, no English field) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldFatherName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.fatherName}
                    onChange={(e) => setCreateForm({ ...createForm, fatherName: e.target.value })}
                    placeholder="যেমন: মোহাম্মদ আব্দুল করিম"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Date of Birth & Dynamic Age preview */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      {t.beneficiariesPage.fieldDob}
                    </label>
                    {createForm.dateOfBirth && getAge(createForm.dateOfBirth) !== null && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {t.beneficiariesPage.fieldAge}: {formatNumber(getAge(createForm.dateOfBirth)!, language)} {t.beneficiariesPage.yearsOld}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={createForm.dateOfBirth}
                    onChange={(e) => setCreateForm({ ...createForm, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldGender} *
                  </label>
                  <select
                    value={createForm.gender}
                    onChange={(e) => setCreateForm({ ...createForm, gender: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Female">{t.common.female}</option>
                    <option value="Male">{t.common.male}</option>
                    <option value="Other">{t.common.other}</option>
                  </select>
                </div>

                {/* Mobile */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldMobile}
                  </label>
                  <input
                    type="text"
                    value={createForm.mobile}
                    onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* NID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldNid}
                  </label>
                  <input
                    type="text"
                    value={createForm.nid}
                    onChange={(e) => setCreateForm({ ...createForm, nid: e.target.value })}
                    placeholder="10, 13 or 17 digit NID"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* BRN */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldBrn}
                  </label>
                  <input
                    type="text"
                    value={createForm.brn}
                    onChange={(e) => setCreateForm({ ...createForm, brn: e.target.value })}
                    placeholder="17 digit BRN"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* District */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldDistrict} *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.district}
                    onChange={(e) => setCreateForm({ ...createForm, district: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="যেমন: নেত্রকোণা"
                  />
                </div>

                {/* Upazila */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldUpazila} *
                  </label>
                  <select
                    required
                    value={createForm.upazilaName}
                    onChange={(e) => {
                      const newUp = e.target.value;
                      setCreateForm({
                        ...createForm,
                        upazilaName: newUp,
                        unionName: "",
                      });
                    }}
                    disabled={!isSuperAdmin && Boolean(currentUser.upazilaName)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                      !isSuperAdmin && currentUser.upazilaName
                        ? "bg-slate-100 text-slate-600 cursor-not-allowed border-slate-300"
                        : "border-slate-300"
                    }`}
                  >
                    {NETROKONA_UPAZILAS.map((up) => (
                      <option key={up.key} value={up.nameBn}>
                        {language === "bn" ? up.nameBn : up.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Union */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldUnion} *
                  </label>
                  <input
                    type="text"
                    required
                    list="create-unions-list"
                    value={createForm.unionName}
                    onChange={(e) => setCreateForm({ ...createForm, unionName: e.target.value })}
                    disabled={isUnionViewer}
                    placeholder="ইউনিয়নের নাম লিখুন বা তালিকা থেকে বাছুন"
                    className={`w-full px-3 py-2 rounded-xl border text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                      isUnionViewer ? "bg-slate-100 cursor-not-allowed border-slate-300" : "border-slate-300"
                    }`}
                  />
                  <datalist id="create-unions-list">
                    {unionsForCreate.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>

                {/* Ward */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldWard} *
                  </label>
                  <input
                    type="text"
                    required
                    value={createForm.wardNo}
                    onChange={(e) => setCreateForm({ ...createForm, wardNo: e.target.value })}
                    placeholder="১ থেকে ৯"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Welfare Scheme */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldScheme}
                  </label>
                  <select
                    value={createForm.schemeId}
                    onChange={(e) => setCreateForm({ ...createForm, schemeId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="">{t.beneficiariesPage.selectScheme}</option>
                    {(isDeptOfficer && currentUser.departmentId
                      ? schemes.filter((s) => s.departmentId === currentUser.departmentId)
                      : schemes
                    ).map((s) => (
                      <option key={s.id} value={s.id}>
                        {getSchemeName(s, language)} ({getDepartmentName(s.department, language)})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Card Number */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldCardNo}
                  </label>
                  <input
                    type="text"
                    value={createForm.cardNumber}
                    onChange={(e) => setCreateForm({ ...createForm, cardNumber: e.target.value })}
                    placeholder="SSN-CARD-XXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  {t.beneficiariesPage.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {createSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {t.beneficiariesPage.btnSave}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Beneficiary Modal */}
      {editingBeneficiary && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-slate-100 bg-slate-50/50 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-base">
                  {t.beneficiariesPage.editModalTitle}
                </h3>
              </div>
              <button
                onClick={() => setEditingBeneficiary(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-5 space-y-4">
              {editError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Name (Bengali) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldNameBn} *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.nameBn}
                    onChange={(e) => setEditForm({ ...editForm, nameBn: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Name (English) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldNameEn}
                  </label>
                  <input
                    type="text"
                    value={editForm.nameEn}
                    onChange={(e) => setEditForm({ ...editForm, nameEn: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Father's Name (Only Bengali, no English field) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldFatherName} *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.fatherName}
                    onChange={(e) => setEditForm({ ...editForm, fatherName: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Date of Birth & Dynamic Age preview */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-slate-700">
                      {t.beneficiariesPage.fieldDob}
                    </label>
                    {editForm.dateOfBirth && getAge(editForm.dateOfBirth) !== null && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        {t.beneficiariesPage.fieldAge}: {formatNumber(getAge(editForm.dateOfBirth)!, language)} {t.beneficiariesPage.yearsOld}
                      </span>
                    )}
                  </div>
                  <input
                    type="date"
                    value={editForm.dateOfBirth}
                    onChange={(e) => setEditForm({ ...editForm, dateOfBirth: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldGender} *
                  </label>
                  <select
                    value={editForm.gender}
                    onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  >
                    <option value="Female">{t.common.female}</option>
                    <option value="Male">{t.common.male}</option>
                    <option value="Other">{t.common.other}</option>
                  </select>
                </div>

                {/* Mobile */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldMobile}
                  </label>
                  <input
                    type="text"
                    value={editForm.mobile}
                    onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                    placeholder="01XXXXXXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* NID */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldNid}
                  </label>
                  <input
                    type="text"
                    value={editForm.nid}
                    onChange={(e) => setEditForm({ ...editForm, nid: e.target.value })}
                    placeholder="10 or 17 digit NID"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* BRN */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldBrn}
                  </label>
                  <input
                    type="text"
                    value={editForm.brn}
                    onChange={(e) => setEditForm({ ...editForm, brn: e.target.value })}
                    placeholder="17 digit BRN"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* District */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldDistrict} *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.district}
                    onChange={(e) => setEditForm({ ...editForm, district: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    placeholder="যেমন: নেত্রকোণা"
                  />
                </div>

                {/* Upazila */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldUpazila} *
                  </label>
                  <select
                    required
                    value={editForm.upazilaName}
                    onChange={(e) => {
                      const newUp = e.target.value;
                      setEditForm({
                        ...editForm,
                        upazilaName: newUp,
                        unionName: "",
                      });
                    }}
                    disabled={!isSuperAdmin && Boolean(currentUser.upazilaName)}
                    className={`w-full px-3 py-2 rounded-xl border text-xs bg-white font-medium focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                      !isSuperAdmin && currentUser.upazilaName
                        ? "bg-slate-100 text-slate-600 cursor-not-allowed border-slate-300"
                        : "border-slate-300"
                    }`}
                  >
                    {NETROKONA_UPAZILAS.map((up) => (
                      <option key={up.key} value={up.nameBn}>
                        {language === "bn" ? up.nameBn : up.nameEn}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Union */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldUnion} *
                  </label>
                  <input
                    type="text"
                    required
                    list="edit-unions-list"
                    value={editForm.unionName}
                    onChange={(e) => setEditForm({ ...editForm, unionName: e.target.value })}
                    disabled={isUnionViewer}
                    className={`w-full px-3 py-2 rounded-xl border text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                      isUnionViewer ? "bg-slate-100 cursor-not-allowed border-slate-300" : "border-slate-300"
                    }`}
                  />
                  <datalist id="edit-unions-list">
                    {unionsForEdit.map((u) => (
                      <option key={u} value={u} />
                    ))}
                  </datalist>
                </div>

                {/* Ward */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldWard} *
                  </label>
                  <input
                    type="text"
                    required
                    value={editForm.wardNo}
                    onChange={(e) => setEditForm({ ...editForm, wardNo: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Card Number */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {t.beneficiariesPage.fieldCardNo}
                  </label>
                  <input
                    type="text"
                    value={editForm.cardNumber}
                    onChange={(e) => setEditForm({ ...editForm, cardNumber: e.target.value })}
                    placeholder="SSN-CARD-XXXXX"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingBeneficiary(null)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  {t.beneficiariesPage.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={editSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {editSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {t.beneficiariesPage.btnSave}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBeneficiary && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden p-6 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-base font-bold text-slate-900">
                {t.beneficiariesPage.deleteModalTitle}
              </h3>
              <p className="text-xs text-slate-600">
                {t.beneficiariesPage.deleteConfirmText}
              </p>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1">
              <div>
                <span className="font-semibold text-slate-600">
                  {language === "bn" ? "উপকারভোগীর নাম:" : "Beneficiary Name:"}
                </span>{" "}
                <span className="font-bold text-slate-900">{deletingBeneficiary.fullName}</span>
              </div>
              {deletingBeneficiary.nid && (
                <div>
                  <span className="font-semibold text-slate-600">
                    {language === "bn" ? "এনআইডি:" : "NID:"}
                  </span>{" "}
                  <span className="font-mono text-slate-800">{deletingBeneficiary.nid}</span>
                </div>
              )}
              <div>
                <span className="font-semibold text-slate-600">
                  {language === "bn" ? "ইউনিয়ন ও ওয়ার্ড:" : "Union & Ward:"}
                </span>{" "}
                <span className="text-slate-800">
                  {deletingBeneficiary.unionName}, {language === "bn" ? `ওয়ার্ড ${deletingBeneficiary.wardNo}` : `Ward ${deletingBeneficiary.wardNo}`}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingBeneficiary(null)}
                className="w-1/2 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
              >
                {t.beneficiariesPage.btnCancel}
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleteSubmitting}
                className="w-1/2 inline-flex items-center justify-center gap-1.5 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
              >
                {deleteSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                {t.beneficiariesPage.btnConfirmDelete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
