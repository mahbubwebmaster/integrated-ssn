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
  isDistrictAdmin: boolean;
  isUpazilaAdmin: boolean;
  isDeptOfficer: boolean;
  isUnionViewer: boolean;
  loading: boolean;
}

const EMPTY_USER: UserSession = {
  id: "",
  name: "",
  designation: null,
  email: "",
  role: "UNION_VIEWER",
  roleTitleBn: "",
  roleTitleEn: "",
  phone: null,
  phoneVerified: false,
  image: null,
  isEmailVerified: false,
  district: "নেত্রকোণা",
  upazilaName: null,
  departmentId: null,
  departmentName: null,
  departmentNameBn: null,
  departmentNameEn: null,
  unionName: null,
};

const DEFAULT_SUPER_ADMIN: UserSession = EMPTY_USER;
const DEFAULT_UPAZILA_ADMIN: UserSession = EMPTY_USER;

const DEFAULT_USERS: UserSession[] = [];

const AuthContext = createContext<AuthContextType>({
  currentUser: EMPTY_USER,
  allUsers: DEFAULT_USERS,
  setCurrentUser: () => { },
  updateUserProfile: () => { },
  switchUserById: () => { },
  permissions: getPermissionsForRole("UPAZILA_ADMIN"),
  roleConfig: ROLE_CONFIG.UPAZILA_ADMIN,
  isSuperAdmin: false,
  isDistrictAdmin: false,
  isUpazilaAdmin: false,
  isDeptOfficer: false,
  isUnionViewer: false,
  loading: true,
});

function buildSessionUser(u: any): UserSession {
  const userRole = (u.role || "SUPER_ADMIN") as UserRole;
  return {
    id: u.id || "auth-user",
    name: u.name || "Official User",
    designation: u.designation || null,
    email: u.email || "",
    role: userRole,
    roleTitleBn: ROLE_CONFIG[userRole]?.nameBn || userRole,
    roleTitleEn: ROLE_CONFIG[userRole]?.nameEn || userRole,
    phone: (u as any).phone || null,
    phoneVerified: Boolean((u as any).phoneVerified),
    image: u.image || null,
    isEmailVerified: Boolean((u as any).isEmailVerified),
    departmentId: u.departmentId || null,
    departmentName: u.departmentName || null,
    departmentNameBn: (u as any).departmentNameBn || null,
    departmentNameEn: (u as any).departmentNameEn || null,
    district: (u as any).district || (u as any).districtName || "নেত্রকোণা",
    upazilaName: (u as any).upazilaName || null,
    unionName: u.unionName || null,
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const [currentUser, setCurrentUserState] = useState<UserSession>(EMPTY_USER);
  const [allUsers, setAllUsers] = useState<UserSession[]>(DEFAULT_USERS);
  const [loading, setLoading] = useState(true);

  // Synchronize strictly with real NextAuth session
  useEffect(() => {
    if (status === "loading") {
      setLoading(true);
      return;
    }

    if (session?.user) {
      const u = session.user;
      const newUser = buildSessionUser(u);

      // Hydrate immediately from sessionStorage cache if present for zero-latency profile display
      let cachedProfile: Partial<UserSession> | null = null;
      if (typeof window !== "undefined" && u.id) {
        try {
          const raw = sessionStorage.getItem(`ssnp_profile_cache_${u.id}`);
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && parsed.ts && Date.now() - parsed.ts < 5 * 60 * 1000 && parsed.data) {
              cachedProfile = parsed.data;
            }
          }
        } catch {
          // Ignore storage parse errors
        }
      }

      setCurrentUserState((prev) => ({
        ...prev,
        ...newUser,
        ...(cachedProfile || {}),
      }));
      setLoading(false);

      // Refresh profile in background only if not freshly cached
      if (u.id && !cachedProfile) {
        fetch(`/api/auth/profile?userId=${encodeURIComponent(u.id)}`)
          .then((res) => (res.ok ? res.json() : null))
          .then((data) => {
            if (data?.success && data?.user) {
              const p = data.user;
              const profilePatch: Partial<UserSession> = {
                name: p.name || undefined,
                designation: p.designation ?? null,
                phone: p.phone ?? null,
                phoneVerified: Boolean(p.phoneVerified),
                image: p.image ?? null,
                isEmailVerified: Boolean(p.isEmailVerified),
                departmentId: p.departmentId || null,
                departmentName: p.departmentName || null,
                departmentNameBn: p.departmentNameBn || null,
                departmentNameEn: p.departmentNameEn || null,
                district: p.district || "নেত্রকোণা",
                upazilaName: p.upazilaName !== undefined ? p.upazilaName : null,
                unionName: p.unionName || null,
              };
              if (typeof window !== "undefined") {
                try {
                  sessionStorage.setItem(
                    `ssnp_profile_cache_${u.id}`,
                    JSON.stringify({ ts: Date.now(), data: profilePatch })
                  );
                } catch {
                  // Ignore quota errors
                }
              }
              setCurrentUserState((prev) => ({
                ...prev,
                ...profilePatch,
                name: profilePatch.name || prev.name,
              }));
            }
          })
          .catch(() => { });
      }
    } else {
      setCurrentUserState(EMPTY_USER);
      setLoading(false);
    }
  }, [session, status]);

  // Load users safely in background (admin roles only — never blocks UI loading state)
  useEffect(() => {
    let isMounted = true;

    async function loadUsersSafe() {
      const userRole = (session?.user as any)?.role;
      if (!session?.user || (userRole !== "SUPER_ADMIN" && userRole !== "UPAZILA_ADMIN")) {
        return;
      }

      try {
        const res = await fetch("/api/auth/users").catch(() => null);
        if (!res || !res.ok) return;
        const data = await res.json().catch(() => null);
        if (!isMounted || !data || !data.success || !Array.isArray(data.users)) {
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
      } catch {
        // Silently fallback
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
      if (typeof window !== "undefined" && next.id) {
        try {
          sessionStorage.setItem(
            `ssnp_profile_cache_${next.id}`,
            JSON.stringify({ ts: Date.now(), data: next })
          );
        } catch {
          // Ignore quota errors
        }
      }
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
        isSuperAdmin: Boolean(currentUser.id && role === "SUPER_ADMIN"),
        isDistrictAdmin: Boolean(currentUser.id && role === "DISTRICT_ADMIN"),
        isUpazilaAdmin: Boolean(currentUser.id && role === "UPAZILA_ADMIN"),
        isDeptOfficer: Boolean(currentUser.id && (role === "DEPT_OFFICER" || role === "DEPARTMENT_OFFICER")),
        isUnionViewer: Boolean(currentUser.id && role === "UNION_VIEWER"),
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
