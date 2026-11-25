export type UserRole = "SUPER_ADMIN" | "DISTRICT_ADMIN" | "UPAZILA_ADMIN" | "DEPT_OFFICER" | "DEPARTMENT_OFFICER" | "UNION_VIEWER";

export interface UserSession {
  id: string;
  name: string;
  designation?: string | null;
  email: string;
  role: UserRole;
  roleTitleBn: string;
  roleTitleEn: string;
  phone?: string | null;
  phoneVerified?: boolean;
  image?: string | null;
  isEmailVerified?: boolean;
  departmentId?: string | null;
  departmentName?: string | null;
  departmentNameBn?: string | null;
  departmentNameEn?: string | null;
  district?: string | null;
  districtName?: string | null;
  upazilaName?: string | null;
  unionName?: string | null;
  wardNo?: string | null;
}

export const ROLE_CONFIG: Record<
  UserRole,
  {
    nameEn: string;
    nameBn: string;
    descriptionBn: string;
    descriptionEn: string;
    badgeColor: string;
  }
> = {
  SUPER_ADMIN: {
    nameEn: "Super Admin",
    nameBn: "সুপার অ্যাডমিন",
    descriptionBn: "সকল দপ্তরের সামগ্রিক তথ্য ও চার্ট দেখা, বাল্ক আপলোড, এবং ইউজার ও সিস্টেম পরিচালনা। (সরাসরি বা এককভাবে ভাতা বাতিলের ক্ষমতা নেই)",
    descriptionEn: "Full system monitoring across all departments, bulk upload, and system management. Cannot directly cancel allowances.",
    badgeColor: "bg-purple-100 text-purple-900 border-purple-300",
  },
  DISTRICT_ADMIN: {
    nameEn: "District Admin (DC)",
    nameBn: "জেলা এডমিন (জেলা প্রশাসক)",
    descriptionBn: "জেলা প্রশাসক: সমগ্র জেলার সকল উপজেলা ও দপ্তরের সামগ্রিক তথ্য, ড্যাশবোর্ড ও চার্ট পর্যবেক্ষণ এবং রিপোর্ট পর্যালোচনা।",
    descriptionEn: "Deputy Commissioner: full district oversight across all upazilas and departments.",
    badgeColor: "bg-indigo-100 text-indigo-900 border-indigo-300",
  },
  UPAZILA_ADMIN: {
    nameEn: "Upazila Admin (UNO)",
    nameBn: "উপজেলা এডমিন (ইউএনও)",
    descriptionBn: "উপজেলা নির্বাহী অফিসার: সকল দপ্তরের তথ্য পর্যবেক্ষণ, দপ্তরের প্রেরিত ভাতা বাতিলের আবেদন পর্যালোচনা, মন্তব্য প্রদান ও ভাতা বাতিলের চূড়ান্ত অনুমোদন।",
    descriptionEn: "Upazila Executive Officer: monitor all departments, review department removal requests, write administrative comments, and provide final cancellation approval.",
    badgeColor: "bg-amber-100 text-amber-900 border-amber-300",
  },
  DEPT_OFFICER: {
    nameEn: "Department Officer",
    nameBn: "দপ্তর কর্মকর্তা",
    descriptionBn: "শুধুমাত্র নিজ দপ্তরের ডাটা ও চার্ট, নিজ দপ্তরের বাল্ক আপলোড এবং উপজেলা নির্বাহী অফিসারের নিকট ভাতা বাতিলের আবেদন পাঠানোর অনুমতি।",
    descriptionEn: "Scoped access: upload and review data strictly for assigned department, submit removal requests to Upazila Admin.",
    badgeColor: "bg-blue-100 text-blue-900 border-blue-300",
  },
  DEPARTMENT_OFFICER: {
    nameEn: "Department Officer",
    nameBn: "দপ্তর কর্মকর্তা",
    descriptionBn: "শুধুমাত্র নিজ দপ্তরের ডাটা ও চার্ট, নিজ দপ্তরের বাল্ক আপলোড এবং উপজেলা নির্বাহী অফিসারের নিকট ভাতা বাতিলের আবেদন পাঠানোর অনুমতি।",
    descriptionEn: "Scoped access: upload and review data strictly for assigned department, submit removal requests to Upazila Admin.",
    badgeColor: "bg-blue-100 text-blue-900 border-blue-300",
  },
  UNION_VIEWER: {
    nameEn: "Union/Ward Viewer",
    nameBn: "ইউনিয়ন পর্যবেক্ষক",
    descriptionBn: "শুধুমাত্র নিজ ইউনিয়নের সুবিধাভোগী ও ডুপ্লিকেট তালিকা পর্যবেক্ষণ (রিড-অনলি অ্যাক্সেস)।",
    descriptionEn: "Read-only observation of beneficiary and duplicate registries within assigned Union.",
    badgeColor: "bg-emerald-100 text-emerald-900 border-emerald-300",
  },
};

export const ROLE_PERMISSIONS = {
  SUPER_ADMIN: {
    canViewAllDepartments: true,
    canUploadExcel: true,
    canUploadAnyDepartment: true,
    canViewDetailedDeduplication: true,
    canDirectlySuspend: false,
    canApproveSuspension: false,
    canRequestSuspension: false,
    canManageUsersAndDepts: true,
    canExportReports: true,
  },
  DISTRICT_ADMIN: {
    canViewAllDepartments: true,
    canUploadExcel: true,
    canUploadAnyDepartment: true,
    canViewDetailedDeduplication: true,
    canDirectlySuspend: false,
    canApproveSuspension: false,
    canRequestSuspension: false,
    canManageUsersAndDepts: true,
    canExportReports: true,
  },
  UPAZILA_ADMIN: {
    canViewAllDepartments: true,
    canUploadExcel: true,
    canUploadAnyDepartment: true,
    canViewDetailedDeduplication: true,
    canDirectlySuspend: false,
    canApproveSuspension: true,
    canRequestSuspension: false,
    canManageUsersAndDepts: false,
    canExportReports: true,
  },
  DEPT_OFFICER: {
    canViewAllDepartments: false,
    canUploadExcel: true,
    canUploadAnyDepartment: false,
    canViewDetailedDeduplication: true,
    canDirectlySuspend: false,
    canApproveSuspension: false,
    canRequestSuspension: true,
    canManageUsersAndDepts: false,
    canExportReports: true,
  },
  DEPARTMENT_OFFICER: {
    canViewAllDepartments: false,
    canUploadExcel: true,
    canUploadAnyDepartment: false,
    canViewDetailedDeduplication: true,
    canDirectlySuspend: false,
    canApproveSuspension: false,
    canRequestSuspension: true,
    canManageUsersAndDepts: false,
    canExportReports: true,
  },
  UNION_VIEWER: {
    canViewAllDepartments: false,
    canUploadExcel: false,
    canUploadAnyDepartment: false,
    canViewDetailedDeduplication: true,
    canDirectlySuspend: false,
    canApproveSuspension: false,
    canRequestSuspension: false,
    canManageUsersAndDepts: false,
    canExportReports: true,
  },
} as const;

export function getPermissionsForRole(role: UserRole) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.UNION_VIEWER;
}
