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
  Camera,
  ScanLine,
  Sparkles,
  UploadCloud,
  Key,
  Archive,
  FolderArchive,
  RotateCcw,
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
  isArchived?: boolean;
  archiveReason?: string | null;
  archiveNote?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
  scheme: {
    id: string;
    name: string;
    monthlyAmount: number;
    department: {
      id: string;
      name: string;
      nameBn?: string | null;
      nameEn?: string | null;
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
  isArchived?: boolean;
  archiveReason?: string | null;
  archiveNote?: string | null;
  archivedAt?: string | null;
  archivedBy?: string | null;
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

  // Interactive Status Filter: ALL, ACTIVE, SUSPENDED, ARCHIVED
  const [statusFilter, setStatusFilter] = useState<"ALL" | "ACTIVE" | "SUSPENDED" | "ARCHIVED">("ALL");
  const [statusCounts, setStatusCounts] = useState({
    all: 0,
    active: 0,
    suspended: 0,
    archived: 0,
  });

  // Archive Modal State
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [archivingBeneficiary, setArchivingBeneficiary] = useState<Beneficiary | null>(null);
  const [archiveForm, setArchiveForm] = useState({
    enrollmentId: "",
    reason: "BENEFIT_EXPIRED", // BENEFIT_EXPIRED, DECEASED, DEPT_REMOVAL, INELIGIBLE
    note: "",
  });
  const [archiveSubmitting, setArchiveSubmitting] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);

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
    startDate: "",
  });
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // NID OCR Scanning State
  const [nidImagePreview, setNidImagePreview] = useState<string | null>(null);
  const [nidScanning, setNidScanning] = useState(false);
  const [nidScanSuccess, setNidScanSuccess] = useState(false);
  const [nidScanError, setNidScanError] = useState<string | null>(null);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedKey = localStorage.getItem("ssnp_gemini_api_key") || "";
      if (savedKey) setGeminiApiKey(savedKey);
    }
  }, []);

  const handleApiKeyChange = (val: string) => {
    setGeminiApiKey(val);
    if (typeof window !== "undefined") {
      localStorage.setItem("ssnp_gemini_api_key", val.trim());
    }
  };

  const handleScanNidImage = async (fileOrDemo?: File | "demo") => {
    try {
      setNidScanning(true);
      setNidScanError(null);
      setNidScanSuccess(false);

      if (fileOrDemo === "demo") {
        const res = await fetch("/api/ocr/nid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isDemo: true }),
        });
        const json = await res.json();
        if (json.success && json.data) {
          applyExtractedNidData(json.data);
          setNidScanSuccess(true);
        } else {
          setNidScanError(json.error || "স্ক্যান ব্যর্থ হয়েছে");
        }
        return;
      }

      if (!fileOrDemo) return;

      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
      });
      reader.readAsDataURL(fileOrDemo);
      const dataUrl = await base64Promise;
      setNidImagePreview(dataUrl);

      const res = await fetch("/api/ocr/nid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: dataUrl,
          mimeType: fileOrDemo.type || "image/jpeg",
          apiKey: geminiApiKey.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success && json.data) {
        applyExtractedNidData(json.data);
        setNidScanSuccess(true);
      } else {
        if (json.requiresApiKey) {
          setShowApiKeyInput(true);
        }
        setNidScanError(json.message || json.error || "এনআইডি তথ্য সংগ্রহ করা সম্ভব হয়নি।");
      }
    } catch (err: any) {
      console.error(err);
      setNidScanError("ছবি প্রসেসিং বা সংযোগে ত্রুটি হয়েছে।");
    } finally {
      setNidScanning(false);
    }
  };

  const applyExtractedNidData = (data: {
    nameBn?: string;
    nameEn?: string;
    fatherName?: string;
    dateOfBirth?: string;
    nid?: string;
  }) => {
    setCreateForm((prev) => ({
      ...prev,
      nameBn: data.nameBn || prev.nameBn,
      nameEn: data.nameEn || prev.nameEn,
      fatherName: data.fatherName || prev.fatherName,
      dateOfBirth: data.dateOfBirth || prev.dateOfBirth,
      nid: data.nid || prev.nid,
    }));
  };

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
    startDate: "",
  });
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
    setCreateForm((prev) => ({
      ...prev,
      startDate: prev.startDate || new Date().toISOString().split("T")[0],
    }));
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
  }, [search, upazila, union, ward, gender, ageGroup, selectedDeptId, statusFilter]);

  // Fetch beneficiaries when pagination or filters change
  useEffect(() => {
    fetchBeneficiaries(currentPage, pageSize);
  }, [currentPage, pageSize, search, upazila, union, ward, gender, ageGroup, selectedDeptId, statusFilter]);

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
      if (statusFilter && statusFilter !== "ALL") params.set("statusFilter", statusFilter);

      const res = await fetch(`/api/beneficiaries?${params.toString()}`);
      const data = await res.json();
      if (data?.success && data?.beneficiaries) {
        setBeneficiaries(data.beneficiaries);
        if (data.statusCounts) {
          setStatusCounts(data.statusCounts);
        }
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

    const startDateFormatted = relevantEnrollment?.startDate
      ? new Date(relevantEnrollment.startDate).toISOString().split("T")[0]
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
      startDate: startDateFormatted,
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
          startDate: editForm.startDate || undefined,
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
      startDate: new Date().toISOString().split("T")[0],
    });
    setNidImagePreview(null);
    setNidScanning(false);
    setNidScanSuccess(false);
    setNidScanError(null);
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
          startDate: createForm.startDate || new Date().toISOString().split("T")[0],
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

  // Open Archive Modal
  const handleOpenArchive = (b: Beneficiary, defaultEnrollmentId?: string) => {
    const relevantEnrollment = isDeptOfficer && currentUser.departmentId
      ? b.enrollments.find((e) => e.scheme.department.id === currentUser.departmentId) || b.enrollments[0]
      : b.enrollments[0];

    setArchivingBeneficiary(b);
    setArchiveForm({
      enrollmentId: defaultEnrollmentId || (isDeptOfficer ? relevantEnrollment?.id || "" : ""),
      reason: "BENEFIT_EXPIRED",
      note: "",
    });
    setArchiveError(null);
    setIsArchiveOpen(true);
  };

  // Confirm Archive
  const handleConfirmArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!archivingBeneficiary) return;
    if (!archiveForm.note.trim()) {
      setArchiveError("অনুগ্রহ করে একটি দাপ্তরিক নোট বা কারণ উল্লেখ করুন।");
      return;
    }

    try {
      setArchiveSubmitting(true);
      setArchiveError(null);

      const res = await fetch("/api/beneficiaries/archive", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          beneficiaryId: archivingBeneficiary.id,
          enrollmentId: archiveForm.enrollmentId || undefined,
          reason: archiveForm.reason,
          note: archiveForm.note.trim(),
          userEmail: currentUser.email,
          userName: currentUser.name,
          userRole: currentUser.role,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSuccessMessage(
          language === "bn"
            ? `সুবিধাভোগী "${archivingBeneficiary.nameBn || archivingBeneficiary.fullName}" এর তথ্য সফলভাবে আর্কাইভ করা হয়েছে।`
            : `Beneficiary "${archivingBeneficiary.nameBn || archivingBeneficiary.fullName}" has been archived.`
        );
        setTimeout(() => setSuccessMessage(null), 5000);
        setIsArchiveOpen(false);
        fetchBeneficiaries(currentPage, pageSize);
      } else {
        setArchiveError(data.error || "আর্কাইভ করতে ব্যর্থ হয়েছে।");
      }
    } catch (err: any) {
      console.error(err);
      setArchiveError("আর্কাইভ করার সময় অপ্রত্যাশিত ত্রুটি ঘটেছে।");
    } finally {
      setArchiveSubmitting(false);
    }
  };

  // Restore from Archive
  const handleRestoreFromArchive = async (beneficiaryId: string, enrollmentId?: string) => {
    if (!confirm(language === "bn" ? "আপনি কি নিশ্চিতভাবে এই সুবিধাভোগীকে আর্কাইভ থেকে সক্রিয় তালিকায় ফিরিয়ে আনতে চান?" : "Are you sure you want to restore this beneficiary from archive?")) {
      return;
    }

    try {
      const params = new URLSearchParams();
      if (beneficiaryId) params.set("beneficiaryId", beneficiaryId);
      if (enrollmentId) params.set("enrollmentId", enrollmentId);

      const res = await fetch(`/api/beneficiaries/archive?${params.toString()}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMessage(
          language === "bn"
            ? "সুবিধাভোগীকে আর্কাইভ থেকে সফলভাবে পুনরুদ্ধার করা হয়েছে।"
            : "Beneficiary restored from archive successfully."
        );
        setTimeout(() => setSuccessMessage(null), 5000);
        fetchBeneficiaries(currentPage, pageSize);
      } else {
        alert(data.error || "পুনরুদ্ধার করা যায়নি।");
      }
    } catch (err) {
      console.error(err);
      alert("পুনরুদ্ধার করার সময় ত্রুটি হয়েছে।");
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

        {/* 4 Interactive Status Filter Cards */}
        <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {/* 1. All Beneficiaries */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("ALL");
              setCurrentPage(1);
            }}
            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              statusFilter === "ALL"
                ? "bg-slate-900 text-white border-slate-900 shadow-md ring-2 ring-slate-900 ring-offset-2"
                : "bg-white text-slate-800 border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                statusFilter === "ALL" ? "text-slate-300" : "text-slate-500"
              }`}>
                {language === "bn" ? "সকল সুবিধাভোগী" : "All Beneficiaries"}
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                statusFilter === "ALL" ? "bg-white/10 text-white" : "bg-slate-100 text-slate-700"
              }`}>
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {formatNumber(statusCounts.all || 0, language)}
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                statusFilter === "ALL" ? "bg-white/20 text-white" : "bg-slate-100 text-slate-600"
              }`}>
                {language === "bn" ? "মোট রেকর্ড" : "Total"}
              </span>
            </div>
          </button>

          {/* 2. Active Beneficiaries */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("ACTIVE");
              setCurrentPage(1);
            }}
            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              statusFilter === "ACTIVE"
                ? "bg-emerald-700 text-white border-emerald-700 shadow-md ring-2 ring-emerald-600 ring-offset-2"
                : "bg-white text-slate-800 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/30 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                statusFilter === "ACTIVE" ? "text-emerald-100" : "text-emerald-700"
              }`}>
                {language === "bn" ? "সক্রিয় সুবিধাভোগী" : "Active Beneficiaries"}
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                statusFilter === "ACTIVE" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"
              }`}>
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {formatNumber(statusCounts.active || 0, language)}
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                statusFilter === "ACTIVE" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-800"
              }`}>
                {language === "bn" ? "নিয়মিত ভাতাভোগী" : "Active"}
              </span>
            </div>
          </button>

          {/* 3. Cancelled Beneficiaries */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("SUSPENDED");
              setCurrentPage(1);
            }}
            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              statusFilter === "SUSPENDED"
                ? "bg-rose-700 text-white border-rose-700 shadow-md ring-2 ring-rose-600 ring-offset-2"
                : "bg-white text-slate-800 border-slate-200 hover:border-rose-300 hover:bg-rose-50/30 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                statusFilter === "SUSPENDED" ? "text-rose-100" : "text-rose-700"
              }`}>
                {language === "bn" ? "বাতিলকৃত সুবিধাভোগী" : "Cancelled Beneficiaries"}
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                statusFilter === "SUSPENDED" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-700"
              }`}>
                <Ban className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {formatNumber(statusCounts.suspended || 0, language)}
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                statusFilter === "SUSPENDED" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-800"
              }`}>
                {language === "bn" ? "স্থগিত / বাতিল" : "Cancelled"}
              </span>
            </div>
          </button>

          {/* 4. Archived Beneficiaries */}
          <button
            type="button"
            onClick={() => {
              setStatusFilter("ARCHIVED");
              setCurrentPage(1);
            }}
            className={`text-left p-4 rounded-2xl border transition-all cursor-pointer relative overflow-hidden flex flex-col justify-between ${
              statusFilter === "ARCHIVED"
                ? "bg-purple-700 text-white border-purple-700 shadow-md ring-2 ring-purple-600 ring-offset-2"
                : "bg-white text-slate-800 border-slate-200 hover:border-purple-300 hover:bg-purple-50/30 shadow-xs"
            }`}
          >
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                statusFilter === "ARCHIVED" ? "text-purple-100" : "text-purple-700"
              }`}>
                {language === "bn" ? "আর্কাইভ সুবিধাভোগী" : "Archived Beneficiaries"}
              </span>
              <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                statusFilter === "ARCHIVED" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-700"
              }`}>
                <FolderArchive className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3 flex items-baseline justify-between">
              <span className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                {formatNumber(statusCounts.archived || 0, language)}
              </span>
              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                statusFilter === "ARCHIVED" ? "bg-white/20 text-white" : "bg-purple-100 text-purple-800"
              }`}>
                {language === "bn" ? "মেয়াদোত্তীর্ণ / মৃত" : "Archived"}
              </span>
            </div>
          </button>
        </div>

        {/* Filters */}
        <div className="no-print bg-white rounded-2xl p-4 shadow-xs border border-slate-200">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={t.beneficiariesPage.searchPlaceholder}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full min-h-[44px] pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
              />
            </div>

            {/* Department Filter (Super Admin sees all, Dept Officer is locked) */}
            <div className="relative">
              <select
                value={selectedDeptId}
                onChange={(e) => setSelectedDeptId(e.target.value)}
                disabled={isDeptOfficer}
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  isDeptOfficer
                    ? "bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed"
                    : "border-slate-300 bg-white text-slate-800"
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
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
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
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  currentUser.upazilaName
                    ? "bg-slate-100 border-slate-300 text-slate-700 font-semibold cursor-not-allowed"
                    : "border-slate-300 bg-white text-slate-800"
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
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
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
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl border text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 ${
                  isUnionViewer
                    ? "bg-slate-100 border-slate-300 text-slate-600 cursor-not-allowed"
                    : "border-slate-300 bg-white"
                }`}
              />
              {isUnionViewer && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-amber-700 font-semibold flex items-center gap-0.5">
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
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
            />

            {/* Gender Filter */}
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
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
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[850px] text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-semibold uppercase tracking-wider text-[11px] border-b border-slate-200 whitespace-nowrap">
                  <tr>
                    <th className="py-3 px-4">{t.beneficiariesPage.colCitizen}</th>
                    <th className="py-3 px-4">{language === "bn" ? "জাতীয় পরিচয়পত্র / জন্ম নিবন্ধন" : "Identification (NID / BRN)"}</th>
                    <th className="py-3 px-4">{t.beneficiariesPage.colLocation}</th>
                    <th className="py-3 px-4">{t.beneficiariesPage.colEnrolledPrograms}</th>
                    <th className="py-3 px-4">{t.dashboard.colTotalReceived}</th>
                    {!isUnionViewer && (
                      <th className="no-print py-3 px-4 text-right">{language === "bn" ? "সম্পাদনা" : t.beneficiariesPage.colActions}</th>
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
                          {b.enrollments.map((enr) => {
                            const isEnrArchived = enr.isArchived || b.isArchived || enr.status === "Archived";
                            const noteText = enr.archiveNote || (b.isArchived ? b.archiveNote : null);
                            const reasonText = enr.archiveReason || (b.isArchived ? b.archiveReason : null);

                            return (
                              <div key={enr.id} className="mb-1.5 last:mb-0">
                                <div
                                  className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] border ${
                                    isEnrArchived
                                      ? "bg-purple-50 border-purple-200"
                                      : "bg-slate-100 border-slate-200"
                                  }`}
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
                                      isEnrArchived
                                        ? "bg-purple-200 text-purple-900 border border-purple-300"
                                        : enr.status === "Active"
                                        ? "bg-emerald-200 text-emerald-900"
                                        : enr.status === "Flagged"
                                        ? "bg-red-200 text-red-900"
                                        : "bg-slate-300 text-slate-700"
                                    }`}
                                  >
                                    {isEnrArchived
                                      ? (language === "bn" ? "আর্কাইভকৃত" : "Archived")
                                      : enr.status === "Active"
                                      ? t.beneficiariesPage.statusActive
                                      : enr.status === "Suspended"
                                      ? t.beneficiariesPage.statusSuspended
                                      : enr.status}
                                  </span>
                                </div>
                                {isEnrArchived && noteText && (
                                  <div className="mt-0.5 text-[10px] text-purple-700 bg-purple-50/80 rounded px-1.5 py-0.5 border border-purple-200/80 flex items-center gap-1 max-w-[280px]">
                                    <FolderArchive className="w-3 h-3 shrink-0 text-purple-600" />
                                    <span className="truncate" title={noteText}>
                                      <span className="font-semibold">
                                        {reasonText === "DECEASED"
                                          ? (language === "bn" ? "মৃত: " : "Deceased: ")
                                          : reasonText === "BENEFIT_EXPIRED"
                                          ? (language === "bn" ? "মেয়াদ শেষ: " : "Expired: ")
                                          : reasonText === "DEPT_REMOVAL"
                                          ? (language === "bn" ? "অপসারণ: " : "Removed: ")
                                          : (language === "bn" ? "নোট: " : "Note: ")}
                                      </span>
                                      {noteText}
                                    </span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
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

                        {/* Actions Column: Edit, Archive / Restore */}
                        {!isUnionViewer && (
                          <td className="no-print py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => handleOpenEdit(b)}
                              title={t.beneficiariesPage.btnEdit}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold border border-blue-200 transition-colors cursor-pointer shadow-xs"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                              <span>{t.beneficiariesPage.btnEdit}</span>
                            </button>

                            {b.isArchived ? (
                              <button
                                onClick={() => handleRestoreFromArchive(b.id)}
                                title={language === "bn" ? "আর্কাইভ থেকে সক্রিয় করুন" : "Restore from archive"}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold border border-emerald-200 transition-colors cursor-pointer shadow-xs"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>{language === "bn" ? "পুনরুদ্ধার" : "Restore"}</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleOpenArchive(b)}
                                title={language === "bn" ? "নোট দিয়ে আর্কাইভ করুন" : "Archive with note"}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold border border-purple-200 transition-colors cursor-pointer shadow-xs"
                              >
                                <FolderArchive className="w-3.5 h-3.5" />
                                <span>{language === "bn" ? "আর্কাইভ" : "Archive"}</span>
                              </button>
                            )}
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
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Plus className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  {t.beneficiariesPage.createModalTitle}
                </h3>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close"
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

              {/* Smart NID Card Scanner Banner & Uploader */}
              <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50/90 via-teal-50/70 to-blue-50/90 p-3.5 sm:p-4 shadow-xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                      <Camera className="w-5 h-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                        {language === "bn" ? "স্মার্ট এনআইডি স্ক্যানার (NID OCR)" : "Smart NID OCR Scanner"}
                        <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-300">
                          AI Auto-fill
                        </span>
                      </h4>
                      <p className="text-[11px] text-slate-600">
                        {language === "bn"
                          ? "এনআইডি কার্ডের সামনের পাতার ছবি আপলোড করলে নাম, পিতার নাম, জন্ম তারিখ ও নম্বর স্বয়ংক্রিয়ভাবে পূরণ হবে।"
                          : "Upload NID front page to automatically extract and fill beneficiary details."}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      onClick={() => handleScanNidImage("demo")}
                      disabled={nidScanning}
                      className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-[11px] font-semibold flex items-center gap-1 transition-colors cursor-pointer disabled:opacity-50"
                      title={language === "bn" ? "ডেমো কার্ড দিয়ে পরীক্ষা করুন" : "Test with sample NID data"}
                    >
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span>{language === "bn" ? "ডেমো টেস্ট" : "Demo Test"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowApiKeyInput(!showApiKeyInput)}
                      className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-white/80 transition-colors cursor-pointer"
                      title={language === "bn" ? "API Key সেটিংস" : "API Key Settings"}
                    >
                      <Key className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* API Key Drawer (collapsible) */}
                {showApiKeyInput && (
                  <div className="p-2.5 bg-white/90 rounded-xl border border-slate-200 text-xs space-y-1.5 animate-in fade-in duration-150">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700 text-[11px]">
                        {language === "bn" ? "Gemini API Key (ঐচ্ছিক / বিনামূল্যে):" : "Gemini API Key (Optional):"}
                      </span>
                      <a
                        href="https://aistudio.google.com/apikey"
                        target="_blank"
                        rel="noreferrer"
                        className="text-emerald-700 hover:underline text-[10px] font-medium"
                      >
                        {language === "bn" ? "কী সংগ্রহ করুন ↗" : "Get Free Key ↗"}
                      </a>
                    </div>
                    <input
                      type="password"
                      value={geminiApiKey}
                      onChange={(e) => handleApiKeyChange(e.target.value)}
                      placeholder="AIzaSy..."
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-mono focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                    />
                    <p className="text-[10px] text-slate-500">
                      {language === "bn"
                        ? "কী আপনার ব্রাউজারে সংরক্ষিত থাকবে অথবা সার্ভারের .env ফাইলে GEMINI_API_KEY ব্যবহার করতে পারেন।"
                        : "Key is saved locally in browser, or configure GEMINI_API_KEY in server .env."}
                    </p>
                  </div>
                )}

                {/* File Upload Zone */}
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <label className="flex-1 w-full min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-emerald-300 bg-white/80 hover:bg-emerald-50/50 cursor-pointer transition-colors text-xs font-semibold text-emerald-800">
                    <UploadCloud className="w-4 h-4 text-emerald-600" />
                    <span>
                      {nidImagePreview
                        ? (language === "bn" ? "অন্য ছবি নির্বাচন করুন" : "Change NID Image")
                        : (language === "bn" ? "এনআইডি কার্ডের ছবি সিলেক্ট করুন" : "Upload NID Card Photo")}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleScanNidImage(file);
                      }}
                    />
                  </label>

                  {nidImagePreview && (
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-11 h-9 rounded-lg border border-slate-300 overflow-hidden bg-slate-100 relative shadow-xs">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={nidImagePreview}
                          alt="NID Preview"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setNidImagePreview(null);
                          setNidScanSuccess(false);
                          setNidScanError(null);
                        }}
                        className="text-[11px] text-red-600 hover:text-red-800 font-medium cursor-pointer"
                      >
                        {language === "bn" ? "মুছে ফেলুন" : "Remove"}
                      </button>
                    </div>
                  )}
                </div>

                {/* Scan Status / Alerts */}
                {nidScanning && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-600 shrink-0" />
                    <span>
                      {language === "bn"
                        ? "এনআইডি কার্ড স্ক্যান ও তথ্য বিশ্লেষণ করা হচ্ছে..."
                        : "Scanning and extracting NID card details..."}
                    </span>
                  </div>
                )}

                {nidScanSuccess && (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-emerald-100/90 border border-emerald-300 text-emerald-900 text-xs font-medium">
                    <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>
                      {language === "bn"
                        ? "✓ এনআইডি স্ক্যান সফল! নাম (বাংলা ও ইংরেজি), পিতার নাম, জন্ম তারিখ এবং এনআইডি নম্বর স্বয়ংক্রিয়ভাবে ফরমে পূরণ হয়েছে।"
                        : "✓ NID scanned successfully! Bengali/English name, father's name, DOB, and NID populated."}
                    </span>
                  </div>
                )}

                {nidScanError && (
                  <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{language === "bn" ? "স্ক্যান করতে পারেনি:" : "Scan failed:"}</span>
                    </div>
                    <p className="text-[11px] text-amber-800 pl-5">{nidScanError}</p>
                  </div>
                )}
              </div>

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
                  <select
                    required
                    value={createForm.unionName}
                    onChange={(e) => setCreateForm({ ...createForm, unionName: e.target.value })}
                    disabled={isUnionViewer}
                    className={`w-full px-3 py-2 rounded-xl border text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                      isUnionViewer ? "bg-slate-100 cursor-not-allowed border-slate-300" : "border-slate-300"
                    }`}
                  >
                    <option value="">
                      {language === "bn" ? "-- ইউনিয়ন নির্বাচন করুন --" : "-- Select Union --"}
                    </option>
                    {unionsForCreate.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    {createForm.unionName && !unionsForCreate.includes(createForm.unionName) && (
                      <option value={createForm.unionName}>{createForm.unionName}</option>
                    )}
                  </select>
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

                {/* Enrollment Start Date */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === "bn" ? "ভাতা শুরুর তারিখ (Enrollment Start Date) *" : "Enrollment Start Date *"}
                  </label>
                  <input
                    type="date"
                    required
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">
                    {language === "bn"
                      ? "📌 নীতিগত নিয়ম: ডুপ্লিকেট ভাতা সনাক্তকরণের ক্ষেত্রে যে ভাতাটি পূর্বে চালু হয়েছে সেটি মূল ভাতা (Primary Benefit) এবং পরবর্তী সময়ে নেওয়া ভাতা অতিরিক্ত (Excess) হিসেবে বিবেচিত হবে।"
                      : "📌 Policy: Earliest enrolled scheme is the legitimate primary benefit; later enrolled schemes are deemed excess."}
                  </p>
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
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-white sticky top-0 z-10">
              <div className="flex items-center gap-2">
                <Edit2 className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold text-slate-900 text-sm sm:text-base">
                  {t.beneficiariesPage.editModalTitle}
                </h3>
              </div>
              <button
                onClick={() => setEditingBeneficiary(null)}
                className="text-slate-400 hover:text-slate-600 p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="Close"
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
                  <select
                    required
                    value={editForm.unionName}
                    onChange={(e) => setEditForm({ ...editForm, unionName: e.target.value })}
                    disabled={isUnionViewer}
                    className={`w-full px-3 py-2 rounded-xl border text-xs bg-white focus:ring-2 focus:ring-emerald-500 focus:outline-none ${
                      isUnionViewer ? "bg-slate-100 cursor-not-allowed border-slate-300" : "border-slate-300"
                    }`}
                  >
                    <option value="">
                      {language === "bn" ? "-- ইউনিয়ন নির্বাচন করুন --" : "-- Select Union --"}
                    </option>
                    {unionsForEdit.map((u) => (
                      <option key={u} value={u}>
                        {u}
                      </option>
                    ))}
                    {editForm.unionName && !unionsForEdit.includes(editForm.unionName) && (
                      <option value={editForm.unionName}>{editForm.unionName}</option>
                    )}
                  </select>
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
                    placeholder="১ থেকে ৯"
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                </div>

                {/* Card Number */}
                <div>
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

                {/* Enrollment Start Date */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === "bn" ? "ভাতা শুরুর তারিখ (Enrollment Date)" : "Enrollment Start Date"}
                  </label>
                  <input
                    type="date"
                    value={editForm.startDate}
                    onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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

      {/* Archive Modal */}
      {isArchiveOpen && archivingBeneficiary && (
        <div className="no-print fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200 w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <FolderArchive className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    {language === "bn" ? "সুবিধাভোগীর তথ্য আর্কাইভ করুন" : "Archive Beneficiary Record"}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {language === "bn"
                      ? "মেয়াদ শেষ, মৃত্যু বা অপসারণের কারণে তথ্য সংরক্ষণ ও আর্কাইভ করা হচ্ছে"
                      : "Archive record due to expiration, demise or department removal"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsArchiveOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {archiveError && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{archiveError}</span>
              </div>
            )}

            {/* Beneficiary Summary Card */}
            <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 text-xs space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "bn" ? "নাম:" : "Name:"}</span>
                <span className="font-bold text-slate-900">{archivingBeneficiary.nameBn || archivingBeneficiary.fullName}</span>
              </div>
              {archivingBeneficiary.nid && (
                <div className="flex justify-between items-center">
                  <span className="text-slate-500">{language === "bn" ? "এনআইডি:" : "NID:"}</span>
                  <span className="font-mono text-slate-800">{archivingBeneficiary.nid}</span>
                </div>
              )}
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "bn" ? "পিতার নাম:" : "Father's Name:"}</span>
                <span className="text-slate-800">{archivingBeneficiary.fatherName || archivingBeneficiary.guardianName || "প্রযোজ্য নয়"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">{language === "bn" ? "ঠিকানা:" : "Address:"}</span>
                <span className="text-slate-800">
                  {archivingBeneficiary.upazilaName}, {archivingBeneficiary.unionName} ({language === "bn" ? `ওয়ার্ড ${formatNumber(archivingBeneficiary.wardNo, language)}` : `Ward ${archivingBeneficiary.wardNo}`})
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmArchive} className="space-y-4">
              {/* If beneficiary has multiple enrollments, officer can choose specific enrollment or whole citizen */}
              {archivingBeneficiary.enrollments.length > 1 && (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {language === "bn" ? "আর্কাইভের আওতা:" : "Archive Scope:"}
                  </label>
                  <select
                    value={archiveForm.enrollmentId}
                    onChange={(e) => setArchiveForm({ ...archiveForm, enrollmentId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="">
                      {language === "bn" ? "সম্পূর্ণ নাগরিক প্রোফাইল আর্কাইভ করুন (সকল ভাতা)" : "Archive full citizen profile (all schemes)"}
                    </option>
                    {archivingBeneficiary.enrollments.map((enr) => (
                      <option key={enr.id} value={enr.id}>
                        {language === "bn" ? "শুধুমাত্র: " : "Only: "}
                        {getSchemeName(enr.scheme, language)} ({getDepartmentName(enr.scheme.department, language)})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Archive Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "bn" ? "আর্কাইভের কারণ নির্বাচন করুন *" : "Select Reason *"}
                </label>
                <select
                  value={archiveForm.reason}
                  onChange={(e) => setArchiveForm({ ...archiveForm, reason: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none bg-white font-medium"
                >
                  <option value="BENEFIT_EXPIRED">
                    {language === "bn" ? "১. ভাতার/বেনিফিটের মেয়াদ শেষ হয়েছে" : "1. Benefit period expired"}
                  </option>
                  <option value="DECEASED">
                    {language === "bn" ? "২. সুবিধাভোগী মৃত্যুবরণ করেছেন (মারা গেছেন)" : "2. Beneficiary is deceased"}
                  </option>
                  <option value="DEPT_REMOVAL">
                    {language === "bn" ? "৩. দপ্তর কর্মকর্তা কর্তৃক তালিকা থেকে অপসারণ" : "3. Department officer removal"}
                  </option>
                  <option value="INELIGIBLE">
                    {language === "bn" ? "৪. সরকারি নীতিমালা অনুযায়ী অযোগ্য প্রমাণিত" : "4. Ineligible according to policy"}
                  </option>
                </select>
              </div>

              {/* Official Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {language === "bn" ? "দাপ্তরিক মন্তব্য / নোট (বাধ্যতামূলক) *" : "Official Note / Remarks (Required) *"}
                </label>
                <textarea
                  required
                  rows={3}
                  value={archiveForm.note}
                  onChange={(e) => setArchiveForm({ ...archiveForm, note: e.target.value })}
                  placeholder={
                    language === "bn"
                      ? "যেমন: ৩০ জুন ২০২৪ এ ভাতার মেয়াদ শেষ হয়েছে / গত ০৫ মে ২০২৪ এ মৃত্যুবরণ করেছেন / মেমোরেন্ডাম নং অনুসারে বাতিল ও আর্কাইভ করা হলো..."
                      : "Enter official remarks, expiration date, or reason..."
                  }
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none leading-relaxed"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsArchiveOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 cursor-pointer"
                >
                  {t.beneficiariesPage.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={archiveSubmitting}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {archiveSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <FolderArchive className="w-4 h-4" />
                  )}
                  {language === "bn" ? "আর্কাইভ নিশ্চিত করুন" : "Confirm Archive"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
