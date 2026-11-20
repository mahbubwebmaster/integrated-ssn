import { auth } from "@/auth";

export interface UserScopeIdentity {
  role?: string | null;
  districtName?: string | null;
  upazilaName?: string | null;
  departmentId?: string | null;
  unionName?: string | null;
  id?: string | null;
  email?: string | null;
}

export interface ScopeOptions {
  upazila?: string | null;
  departmentId?: string | null;
  union?: string | null;
  district?: string | null;
}

/**
 * Resolves the authenticated user identity from NextAuth session, or request headers as fallback.
 */
export async function getSessionUser(request?: Request): Promise<UserScopeIdentity | null> {
  try {
    const session = await auth();
    if (session?.user) {
      const u = session.user as any;
      return {
        id: u.id || null,
        email: u.email || null,
        role: u.role || null,
        districtName: u.districtName || u.district || "নেত্রকোণা",
        upazilaName: u.upazilaName || null,
        departmentId: u.departmentId || null,
        unionName: u.unionName || null,
      };
    }
  } catch (e) {
    console.warn("getSessionUser: NextAuth session check skipped or failed:", e);
  }

  // Fallback to custom request headers if set (e.g. during client/proxy fetch)
  if (request) {
    const role = request.headers.get("x-user-role");
    if (role) {
      return {
        role,
        districtName: request.headers.get("x-user-district") || "নেত্রকোণা",
        upazilaName: request.headers.get("x-user-upazila") || null,
        departmentId: request.headers.get("x-user-department-id") || null,
        unionName: request.headers.get("x-user-union") || null,
        id: request.headers.get("x-user-id") || null,
        email: request.headers.get("x-user-email") || null,
      };
    }
  }

  return null;
}

/**
 * Returns a Prisma `where` filter object for `Enrollment` queries based on administrative hierarchy:
 * - DEPT_OFFICER: Scoped strictly to user's assigned department and upazila/district
 * - UPAZILA_ADMIN: Scoped strictly to user's assigned upazila and district
 * - DISTRICT_ADMIN: Scoped strictly to user's district, allowing optional upazila and department drill-down
 * - SUPER_ADMIN: Unrestricted; supports optional filter drill-down
 * - UNION_VIEWER: Scoped to assigned union, upazila and district
 */
export function getEnrollmentScope(
  user: UserScopeIdentity | null | undefined,
  options?: ScopeOptions
) {
  const role = user?.role || "SUPER_ADMIN";
  const userDistrict = user?.districtName || "নেত্রকোণা";
  const userUpazila = user?.upazilaName || null;
  const userDeptId = user?.departmentId || null;
  const userUnion = user?.unionName || null;

  const beneficiaryFilter: any = {};
  const schemeFilter: any = {};

  const optUpazila = options?.upazila?.trim();
  const isValidOptUpazila =
    optUpazila &&
    optUpazila !== "all" &&
    optUpazila !== "সমগ্র জেলা" &&
    optUpazila !== "সমগ্র নেত্রকোণা জেলা";

  const optDeptId = options?.departmentId?.trim();
  const optUnion = options?.union?.trim();

  // District condition helper (handles districtName and legacy district column)
  const districtCondition = {
    OR: [{ districtName: userDistrict }, { district: userDistrict }],
  };

  if (role === "DEPT_OFFICER" || role === "DEPARTMENT_OFFICER") {
    // 1. Department Officer: locked to own department and own upazila
    if (userDeptId) {
      schemeFilter.departmentId = userDeptId;
    }
    if (userUpazila) {
      beneficiaryFilter.upazilaName = userUpazila;
    }
    Object.assign(beneficiaryFilter, districtCondition);
  } else if (role === "UPAZILA_ADMIN") {
    // 2. Upazila Admin (UNO): locked to own upazila; can filter by department
    if (userUpazila) {
      beneficiaryFilter.upazilaName = userUpazila;
    }
    Object.assign(beneficiaryFilter, districtCondition);
    if (optDeptId) {
      schemeFilter.departmentId = optDeptId;
    }
  } else if (role === "DISTRICT_ADMIN") {
    // 3. District Admin (DC): locked to district; can drill down to any upazila and department
    Object.assign(beneficiaryFilter, districtCondition);
    if (isValidOptUpazila) {
      beneficiaryFilter.upazilaName = optUpazila;
    }
    if (optDeptId) {
      schemeFilter.departmentId = optDeptId;
    }
  } else if (role === "UNION_VIEWER") {
    // 4. Union Viewer: locked to assigned union, upazila, district
    if (userUnion) {
      beneficiaryFilter.unionName = { contains: userUnion };
    }
    if (userUpazila) {
      beneficiaryFilter.upazilaName = userUpazila;
    }
    Object.assign(beneficiaryFilter, districtCondition);
  } else {
    // 5. Super Admin: full access; honors drill-down options
    if (isValidOptUpazila) {
      beneficiaryFilter.upazilaName = optUpazila;
    }
    if (optDeptId) {
      schemeFilter.departmentId = optDeptId;
    }
    if (options?.district) {
      beneficiaryFilter.OR = [
        { districtName: options.district },
        { district: options.district },
      ];
    }
  }

  if (optUnion && optUnion !== "all" && role !== "UNION_VIEWER") {
    beneficiaryFilter.unionName = { contains: optUnion };
  }

  const whereEnrollment: any = {};
  if (Object.keys(beneficiaryFilter).length > 0) {
    whereEnrollment.beneficiary = beneficiaryFilter;
  }
  if (Object.keys(schemeFilter).length > 0) {
    whereEnrollment.scheme = schemeFilter;
  }

  return whereEnrollment;
}

/**
 * Returns a Prisma `where` filter object for `Beneficiary` queries based on administrative hierarchy.
 */
export function getBeneficiaryScope(
  user: UserScopeIdentity | null | undefined,
  options?: ScopeOptions
) {
  const role = user?.role || "SUPER_ADMIN";
  const userDistrict = user?.districtName || "নেত্রকোণা";
  const userUpazila = user?.upazilaName || null;
  const userDeptId = user?.departmentId || null;
  const userUnion = user?.unionName || null;

  const whereBeneficiary: any = {};

  const optUpazila = options?.upazila?.trim();
  const isValidOptUpazila =
    optUpazila &&
    optUpazila !== "all" &&
    optUpazila !== "সমগ্র জেলা" &&
    optUpazila !== "সমগ্র নেত্রকোণা জেলা";

  const optDeptId = options?.departmentId?.trim();
  const optUnion = options?.union?.trim();

  const districtCondition = {
    OR: [{ districtName: userDistrict }, { district: userDistrict }],
  };

  if (role === "DEPT_OFFICER" || role === "DEPARTMENT_OFFICER") {
    // Dept Officer: locked to own upazila and district, and only beneficiaries enrolled in their department
    if (userUpazila) {
      whereBeneficiary.upazilaName = userUpazila;
    }
    Object.assign(whereBeneficiary, districtCondition);
    if (userDeptId) {
      whereBeneficiary.enrollments = {
        some: {
          scheme: {
            departmentId: userDeptId,
          },
        },
      };
    }
  } else if (role === "UPAZILA_ADMIN") {
    // Upazila Admin: locked to own upazila and district
    if (userUpazila) {
      whereBeneficiary.upazilaName = userUpazila;
    }
    Object.assign(whereBeneficiary, districtCondition);
    if (optDeptId) {
      whereBeneficiary.enrollments = {
        some: {
          scheme: {
            departmentId: optDeptId,
          },
        },
      };
    }
  } else if (role === "DISTRICT_ADMIN") {
    // District Admin (DC): locked to district, can drill down to any upazila or department
    Object.assign(whereBeneficiary, districtCondition);
    if (isValidOptUpazila) {
      whereBeneficiary.upazilaName = optUpazila;
    }
    if (optDeptId) {
      whereBeneficiary.enrollments = {
        some: {
          scheme: {
            departmentId: optDeptId,
          },
        },
      };
    }
  } else if (role === "UNION_VIEWER") {
    // Union Viewer: locked to assigned union, upazila, district
    if (userUnion) {
      whereBeneficiary.unionName = { contains: userUnion };
    }
    if (userUpazila) {
      whereBeneficiary.upazilaName = userUpazila;
    }
    Object.assign(whereBeneficiary, districtCondition);
  } else {
    // Super Admin: full access
    if (isValidOptUpazila) {
      whereBeneficiary.upazilaName = optUpazila;
    }
    if (optDeptId) {
      whereBeneficiary.enrollments = {
        some: {
          scheme: {
            departmentId: optDeptId,
          },
        },
      };
    }
    if (options?.district) {
      whereBeneficiary.OR = [
        { districtName: options.district },
        { district: options.district },
      ];
    }
  }

  if (optUnion && optUnion !== "all" && role !== "UNION_VIEWER") {
    whereBeneficiary.unionName = { contains: optUnion };
  }

  return whereBeneficiary;
}

/**
 * Returns comprehensive data scopes for both Enrollment and Beneficiary queries.
 */
export function getDataScope(
  user: UserScopeIdentity | null | undefined,
  options?: ScopeOptions
) {
  return {
    enrollmentScope: getEnrollmentScope(user, options),
    beneficiaryScope: getBeneficiaryScope(user, options),
  };
}
