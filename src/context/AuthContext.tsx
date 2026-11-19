"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { UserRole, UserSession, ROLE_CONFIG, getPermissionsForRole } from "@/lib/auth";

interface AuthContextType {
  currentUser: UserSession;
  allUsers: UserSession[];
  setCurrentUser: (user: UserSession) => void;
  updateUserProfile: (updated: Partial<UserSession>) => void;
  switchUserById: (userId: string) => void;
  permissions: ReturnType<typeof getPermissionsForRole>;
  roleConfig: typeof ROLE_CONFIG[UserRole];
  isSuperAdmin: boolean;
  isUpazilaAdmin: boolean;
  isDeptOfficer: boolean;
  isUnionViewer: boolean;
  loading: boolean;
}

const DEFAULT_DC: UserSession = {
  id: "default-dc",
  name: "বনানী বিশ্বাস",
  designation: "জেলা প্রশাসক ও জেলা ম্যাজিস্ট্রেট, নেত্রকোণা",
  email: "dc@netrokona.gov.bd",
  role: "SUPER_ADMIN",
  roleTitleBn: ROLE_CONFIG.SUPER_ADMIN.nameBn,
  roleTitleEn: ROLE_CONFIG.SUPER_ADMIN.nameEn,
  phone: "01713000001",
  phoneVerified: true,
  image: null,
  isEmailVerified: true,
  district: "নেত্রকোণা",
  upazilaName: null,
  departmentId: null,
  departmentName: null,
  departmentNameBn: null,
  departmentNameEn: null,
  unionName: null,
};

const DEFAULT_UPAZILA_ADMIN: UserSession = {
  id: "default-uno-sadar",
  name: "তানিয়া আক্তার",
  designation: "উপজেলা নির্বাহী অফিসার, নেত্রকোণা সদর",
  email: "uno.sadar@netrokona.gov.bd",
  role: "UPAZILA_ADMIN",
  roleTitleBn: ROLE_CONFIG.UPAZILA_ADMIN.nameBn,
  roleTitleEn: ROLE_CONFIG.UPAZILA_ADMIN.nameEn,
  phone: "01711000011",
  phoneVerified: true,
  image: null,
  isEmailVerified: true,
  district: "নেত্রকোণা",
  upazilaName: "নেত্রকোণা সদর",
  departmentId: null,
  departmentName: null,
  departmentNameBn: null,
  departmentNameEn: null,
  unionName: null,
};

const DEFAULT_SUPER_ADMIN: UserSession = DEFAULT_DC;

const DEFAULT_USERS: UserSession[] = [
  DEFAULT_DC,
  DEFAULT_UPAZILA_ADMIN,
  {
    id: "default-uno-kendua",
    name: "মো: ইমদাদুল হক তালুকদার",
    designation: "উপজেলা নির্বাহী অফিসার, কেন্দুয়া",
    email: "uno.kendua@netrokona.gov.bd",
    role: "UPAZILA_ADMIN",
    roleTitleBn: ROLE_CONFIG.UPAZILA_ADMIN.nameBn,
    roleTitleEn: ROLE_CONFIG.UPAZILA_ADMIN.nameEn,
    phone: "01711000012",
    phoneVerified: true,
    image: null,
    isEmailVerified: true,
    district: "নেত্রকোণা",
    upazilaName: "কেন্দুয়া",
    departmentId: null,
    departmentName: null,
    departmentNameBn: null,
    departmentNameEn: null,
    unionName: null,
  },
  {
    id: "default-uno-durgapur",
    name: "নাভীদ রেজওয়ানুল কবীর",
    designation: "উপজেলা নির্বাহী অফিসার, দুর্গাপুর",
    email: "uno.durgapur@netrokona.gov.bd",
    role: "UPAZILA_ADMIN",
    roleTitleBn: ROLE_CONFIG.UPAZILA_ADMIN.nameBn,
    roleTitleEn: ROLE_CONFIG.UPAZILA_ADMIN.nameEn,
    phone: "01711000013",
    phoneVerified: true,
    image: null,
    isEmailVerified: true,
    district: "নেত্রকোণা",
    upazilaName: "দুর্গাপুর",
    departmentId: null,
    departmentName: null,
    departmentNameBn: null,
    departmentNameEn: null,
    unionName: null,
  },
  {
    id: "default-dss-sadar",
    name: "উপজেলা সমাজসেবা কর্মকর্তা (নেত্রকোণা সদর)",
    designation: "উপজেলা সমাজসেবা কর্মকর্তা",
    email: "dss.sadar@netrokona.gov.bd",
    role: "DEPT_OFFICER",
    roleTitleBn: ROLE_CONFIG.DEPT_OFFICER.nameBn,
    roleTitleEn: ROLE_CONFIG.DEPT_OFFICER.nameEn,
    phone: "01712000001",
    phoneVerified: true,
    image: null,
    isEmailVerified: true,
    district: "নেত্রকোণা",
    upazilaName: "নেত্রকোণা সদর",
    departmentId: "cmwmbddpy0000sghgtn9qiu6e",
    departmentName: "Department of Social Services",
    departmentNameBn: "সমাজসেবা অধিদপ্তর",
    departmentNameEn: "Department of Social Services",
    unionName: null,
  },
  {
    id: "default-dwa-sadar",
    name: "উপজেলা মহিলা বিষয়ক কর্মকর্তা (নেত্রকোণা সদর)",
    designation: "উপজেলা মহিলা বিষয়ক কর্মকর্তা",
    email: "dwa.sadar@netrokona.gov.bd",
    role: "DEPT_OFFICER",
    roleTitleBn: ROLE_CONFIG.DEPT_OFFICER.nameBn,
    roleTitleEn: ROLE_CONFIG.DEPT_OFFICER.nameEn,
    phone: "01713000002",
    phoneVerified: true,
    image: null,
    isEmailVerified: true,
    district: "নেত্রকোণা",
    upazilaName: "নেত্রকোণা সদর",
    departmentId: "cmwmbddrd0004sghg7sc62y1x",
    departmentName: "Department of Women Affairs",
    departmentNameBn: "মহিলা বিষয়ক অধিদপ্তর",
    departmentNameEn: "Department of Women Affairs",
    unionName: null,
  },
  {
    id: "default-dss-kendua",
    name: "উপজেলা সমাজসেবা কর্মকর্তা (কেন্দুয়া)",
    designation: "উপজেলা সমাজসেবা কর্মকর্তা",
    email: "dss.kendua@netrokona.gov.bd",
    role: "DEPT_OFFICER",
    roleTitleBn: ROLE_CONFIG.DEPT_OFFICER.nameBn,
    roleTitleEn: ROLE_CONFIG.DEPT_OFFICER.nameEn,
    phone: "01712000003",
    phoneVerified: true,
    image: null,
    isEmailVerified: true,
    district: "নেত্রকোণা",
    upazilaName: "কেন্দুয়া",
    departmentId: "cmwmbddpy0000sghgtn9qiu6e",
    departmentName: "Department of Social Services",
    departmentNameBn: "সমাজসেবা অধিদপ্তর",
    departmentNameEn: "Department of Social Services",
    unionName: null,
  },
  {
    id: "default-mougati",
    name: "মো: কামরুল হাসান",
    designation: "ইউপি সচিব",
    email: "mougati.sadar@netrokona.gov.bd",
    role: "UNION_VIEWER",
    roleTitleBn: ROLE_CONFIG.UNION_VIEWER.nameBn,
    roleTitleEn: ROLE_CONFIG.UNION_VIEWER.nameEn,
    phone: "01714000004",
    phoneVerified: false,
    image: null,
    isEmailVerified: false,
    district: "নেত্রকোণা",
    upazilaName: "নেত্রকোণা সদর",
    departmentId: null,
    departmentName: null,
    departmentNameBn: null,
    departmentNameEn: null,
    unionName: "মৌগাতি",
  },
];

const AuthContext = createContext<AuthContextType>({
  currentUser: DEFAULT_UPAZILA_ADMIN,
  allUsers: DEFAULT_USERS,
  setCurrentUser: () => { },
  updateUserProfile: () => { },
  switchUserById: () => { },
  permissions: getPermissionsForRole("UPAZILA_ADMIN"),
  roleConfig: ROLE_CONFIG.UPAZILA_ADMIN,
  isSuperAdmin: false,
  isUpazilaAdmin: true,
  isDeptOfficer: false,
  isUnionViewer: false,
  loading: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const [currentUser, setCurrentUserState] = useState<UserSession>(DEFAULT_SUPER_ADMIN);
  const [allUsers, setAllUsers] = useState<UserSession[]>(DEFAULT_USERS);
  const [loading, setLoading] = useState(true);

  // Synchronize with NextAuth session when available
  useEffect(() => {
    if (session?.user) {
      const u = session.user;
      const userRole = (u.role || "SUPER_ADMIN") as UserRole;
      const matched = allUsers.find((x) => x.email === u.email || x.id === u.id);

      setCurrentUserState({
        id: u.id || matched?.id || "auth-user",
        name: u.name || matched?.name || "Official User",
        designation: (u as any).designation || matched?.designation || null,
        email: u.email || matched?.email || "",
        role: userRole,
        roleTitleBn: ROLE_CONFIG[userRole]?.nameBn || userRole,
        roleTitleEn: ROLE_CONFIG[userRole]?.nameEn || userRole,
        phone: (matched?.phone || null) as string | null,
        phoneVerified: Boolean(matched?.phoneVerified),
        image: (u.image || matched?.image || null) as string | null,
        isEmailVerified: Boolean(matched?.isEmailVerified),
        departmentId: u.departmentId || matched?.departmentId || null,
        departmentName: matched?.departmentName || null,
        departmentNameBn: (u as any).departmentNameBn || matched?.departmentNameBn || null,
        departmentNameEn: (u as any).departmentNameEn || matched?.departmentNameEn || null,
        district: (u as any).district || matched?.district || "নেত্রকোণা",
        upazilaName: (u as any).upazilaName || matched?.upazilaName || null,
        unionName: u.unionName || matched?.unionName || null,
      });

      // Also asynchronously fetch user profile to populate avatar/phone
      if (u.id) {
        fetch(`/api/auth/profile?userId=${encodeURIComponent(u.id)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.success && data?.user) {
              const p = data.user;
              setCurrentUserState((prev) => ({
                ...prev,
                name: p.name || prev.name,
                designation: p.designation ?? prev.designation,
                phone: p.phone ?? prev.phone,
                phoneVerified: Boolean(p.phoneVerified),
                image: p.image ?? prev.image,
                isEmailVerified: Boolean(p.isEmailVerified),
                departmentId: p.departmentId || prev.departmentId,
                departmentName: p.departmentName || prev.departmentName,
                departmentNameBn: p.departmentNameBn || prev.departmentNameBn,
                departmentNameEn: p.departmentNameEn || prev.departmentNameEn,
                district: p.district || prev.district || "নেত্রকোণা",
                upazilaName: p.upazilaName !== undefined ? p.upazilaName : prev.upazilaName,
                unionName: p.unionName || prev.unionName,
              }));
            }
          })
          .catch(() => { });
      }
    }
  }, [session, allUsers]);

  // Load users safely without throwing unhandled network errors
  useEffect(() => {
    let isMounted = true;

    async function loadUsersSafe() {
      try {
        setLoading(true);
        const res = await fetch("/api/auth/users").catch(() => null);
        if (!res || !res.ok) {
          if (isMounted) setLoading(false);
          return;
        }
        const data = await res.json().catch(() => null);
        if (!isMounted || !data || !data.success || !Array.isArray(data.users)) {
          if (isMounted) setLoading(false);
          return;
        }

        const mappedUsers: UserSession[] = data.users.map((u: any) => ({
          id: u.id,
          name: u.name,
          designation: u.designation || null,
          email: u.email,
          role: u.role as UserRole,
          roleTitleBn: ROLE_CONFIG[u.role as UserRole]?.nameBn || u.role,
          roleTitleEn: ROLE_CONFIG[u.role as UserRole]?.nameEn || u.role,
          phone: u.phone || null,
          phoneVerified: Boolean(u.phoneVerified),
          image: u.image || null,
          isEmailVerified: Boolean(u.isEmailVerified),
          departmentId: u.departmentId,
          departmentName: u.department?.name || null,
          departmentNameBn: u.department?.nameBn || null,
          departmentNameEn: u.department?.nameEn || null,
          district: u.district || "নেত্রকোণা",
          upazilaName: u.upazilaName || null,
          unionName: u.unionName || null,
          wardNo: u.wardNo || null,
        }));

        setAllUsers(mappedUsers);

        // Check if previously saved user in localStorage
        const savedUserId =
          typeof window !== "undefined"
            ? localStorage.getItem("ssnp_active_user_id")
            : null;

        if (savedUserId) {
          const found = mappedUsers.find((u) => u.id === savedUserId);
          if (found && !session?.user) {
            setCurrentUserState(found);
            return;
          }
        }

        if (!session?.user) {
          const adminUser =
            mappedUsers.find((u) => u.role === "SUPER_ADMIN") || mappedUsers[0];
          if (adminUser) setCurrentUserState(adminUser);
        }
      } catch {
        // Silently fallback to default personas
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadUsersSafe();

    return () => {
      isMounted = false;
    };
  }, [session]);

  const setCurrentUser = (user: UserSession) => {
    setCurrentUserState(user);
    if (typeof window !== "undefined") {
      localStorage.setItem("ssnp_active_user_id", user.id);
      document.cookie = `ssn_user_role=${user.role}; path=/`;
      if (user.departmentId) {
        document.cookie = `ssn_department_id=${user.departmentId}; path=/`;
      }
      if (user.unionName) {
        document.cookie = `ssn_union_name=${encodeURIComponent(user.unionName)}; path=/`;
      }
    }
  };

  const updateUserProfile = (updated: Partial<UserSession>) => {
    setCurrentUserState((prev) => {
      const next = { ...prev, ...updated };
      setAllUsers((users) =>
        users.map((u) => (u.id === next.id ? { ...u, ...updated } : u))
      );
      return next;
    });
  };

  const switchUserById = (userId: string) => {
    const user = allUsers.find((u) => u.id === userId);
    if (user) {
      setCurrentUser(user);
    }
  };

  const role = currentUser.role || "SUPER_ADMIN";
  const permissions = getPermissionsForRole(role);
  const roleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.SUPER_ADMIN;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        allUsers,
        setCurrentUser,
        updateUserProfile,
        switchUserById,
        permissions,
        roleConfig,
        isSuperAdmin: role === "SUPER_ADMIN",
        isUpazilaAdmin: role === "UPAZILA_ADMIN",
        isDeptOfficer: role === "DEPT_OFFICER" || role === "DEPARTMENT_OFFICER",
        isUnionViewer: role === "UNION_VIEWER",
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
