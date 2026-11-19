import { prisma } from "@/lib/prisma";

export interface CleanedRecord {
  fullName: string;
  guardianName: string;
  gender: string;
  nid?: string;
  brn?: string;
  mobile?: string;
  district?: string;
  upazilaName?: string;
  unionName: string;
  wardNo: string;
  cardNumber?: string;
  rowNumber?: number;
}

export interface DuplicateFlag {
  rowNumber: number;
  fullName: string;
  nid?: string;
  brn?: string;
  schemeName: string;
  flagType: "SAME_SCHEME_DUPLICATE" | "CROSS_SCHEME_DUPLICATE" | "IDENTITY_COLLISION" | "BATCH_DUPLICATE" | "SUSPICIOUS_MOBILE";
  reason: string;
  existingRecord?: {
    beneficiaryName: string;
    guardianName: string;
    schemeName: string;
    departmentName: string;
    monthlyAmount: number;
    startDate: string;
    cardNumber?: string | null;
  };
}

export interface ProcessingResult {
  batchId: string;
  totalRecords: number;
  newBeneficiariesCreated: number;
  existingBeneficiariesMatched: number;
  activeCount: number;
  flaggedCount: number;
  flags: DuplicateFlag[];
}

/**
 * Normalizes NID: removes hyphens, spaces, and non-digits.
 */
export function normalizeNid(nid?: string | null): string | undefined {
  if (!nid) return undefined;
  const cleaned = String(nid).replace(/\D/g, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Normalizes BRN (Birth Registration Number).
 */
export function normalizeBrn(brn?: string | null): string | undefined {
  if (!brn) return undefined;
  const cleaned = String(brn).replace(/\D/g, "").trim();
  return cleaned.length > 0 ? cleaned : undefined;
}

/**
 * Normalizes Bangladeshi mobile numbers to 11-digit 01XXXXXXXXX.
 */
export function normalizeMobile(mobile?: string | null): string | undefined {
  if (!mobile) return undefined;
  let digits = String(mobile).replace(/\D/g, "").trim();
  if (digits.startsWith("8801")) {
    digits = digits.substring(2);
  } else if (digits.startsWith("88") && digits.length === 13) {
    digits = digits.substring(2);
  }
  return digits.length === 11 ? digits : digits.length > 0 ? digits : undefined;
}

/**
 * Checks if two NIDs match (accounting for 13-digit old NID vs 17-digit format with 4-digit birth year).
 */
export function isNidMatch(nidA?: string | null, nidB?: string | null): boolean {
  if (!nidA || !nidB) return false;
  if (nidA === nidB) return true;
  // If one is 13-digit and other is 17-digit
  if (nidA.length === 13 && nidB.length === 17 && nidB.endsWith(nidA)) return true;
  if (nidB.length === 13 && nidA.length === 17 && nidA.endsWith(nidB)) return true;
  return false;
}

/**
 * Process a batch of cleaned beneficiary records and enroll them into a scheme.
 */
export async function processBatchUpload(
  departmentId: string,
  schemeId: string,
  records: CleanedRecord[],
  batchId: string,
  uploadedByUserId?: string | null,
  tx?: any,
  batchDistrict?: string | null,
  batchUpazila?: string | null
): Promise<ProcessingResult> {
  const db = tx || prisma;

  const targetScheme = await db.scheme.findUnique({
    where: { id: schemeId },
    include: { department: true },
  });

  if (!targetScheme) {
    throw new Error(`Target scheme ID ${schemeId} not found.`);
  }

  const flags: DuplicateFlag[] = [];
  let newBeneficiariesCreated = 0;
  let existingBeneficiariesMatched = 0;
  let activeCount = 0;
  let flaggedCount = 0;

  // Track seen NIDs and BRNs within the current batch to catch batch-internal duplicates
  const seenNidsInBatch = new Map<string, number>(); // nid -> rowNumber
  const seenBrnsInBatch = new Map<string, number>(); // brn -> rowNumber

  for (let i = 0; i < records.length; i++) {
    const record = records[i];
    const rowNum = record.rowNumber ?? i + 1;
    const nid = normalizeNid(record.nid);
    const brn = normalizeBrn(record.brn);
    const mobile = normalizeMobile(record.mobile);

    let isFlagged = false;
    let flagReason = "";
    let flagType: DuplicateFlag["flagType"] = "SAME_SCHEME_DUPLICATE";
    let existingDetail: DuplicateFlag["existingRecord"] | undefined = undefined;

    // 1. Check Batch-Internal Duplicates
    if (nid && seenNidsInBatch.has(nid)) {
      isFlagged = true;
      flagType = "BATCH_DUPLICATE";
      flagReason = `Duplicate NID (${nid}) found within the same upload file (previously seen at Row ${seenNidsInBatch.get(nid)}).`;
    } else if (brn && seenBrnsInBatch.has(brn)) {
      isFlagged = true;
      flagType = "BATCH_DUPLICATE";
      flagReason = `Duplicate BRN (${brn}) found within the same upload file (previously seen at Row ${seenBrnsInBatch.get(brn)}).`;
    }

    if (nid) seenNidsInBatch.set(nid, rowNum);
    if (brn) seenBrnsInBatch.set(brn, rowNum);

    // 2. Database Lookup for Existing Beneficiary
    let existingBeneficiary = null;

    if (nid) {
      // Lookup by exact NID or 13/17 digit variant
      const candidates = await db.beneficiary.findMany({
        where: {
          OR: [
            { nid: nid },
            ...(nid.length === 13 ? [{ nid: { endsWith: nid } }] : []),
            ...(nid.length === 17 ? [{ nid: nid.substring(4) }] : []),
          ],
        },
        include: {
          enrollments: {
            include: {
              scheme: {
                include: { department: true },
              },
            },
          },
        },
      });

      if (candidates.length > 0) {
        existingBeneficiary = candidates[0];
      }
    }

    if (!existingBeneficiary && brn) {
      existingBeneficiary = await db.beneficiary.findFirst({
        where: { brn: brn },
        include: {
          enrollments: {
            include: {
              scheme: {
                include: { department: true },
              },
            },
          },
        },
      });
    }

    // Fallback: Check exact Name + Guardian + Union + Ward match
    if (!existingBeneficiary && record.fullName && record.guardianName && record.unionName) {
      existingBeneficiary = await db.beneficiary.findFirst({
        where: {
          fullName: { equals: record.fullName.trim() },
          guardianName: { equals: record.guardianName.trim() },
          unionName: { equals: record.unionName.trim() },
          wardNo: { equals: record.wardNo.trim() },
        },
        include: {
          enrollments: {
            include: {
              scheme: {
                include: { department: true },
              },
            },
          },
        },
      });
    }

    let beneficiaryId: string;

    if (existingBeneficiary) {
      existingBeneficiariesMatched++;
      beneficiaryId = existingBeneficiary.id;

      // Check existing enrollments for redundancy
      for (const enr of existingBeneficiary.enrollments) {
        if (enr.status === "Active" || enr.status === "Flagged") {
          isFlagged = true;
          existingDetail = {
            beneficiaryName: existingBeneficiary.fullName,
            guardianName: existingBeneficiary.guardianName,
            schemeName: enr.scheme.name,
            departmentName: enr.scheme.department.name,
            monthlyAmount: enr.scheme.monthlyAmount,
            startDate: enr.startDate.toISOString().split("T")[0],
            cardNumber: enr.cardNumber,
          };

          if (enr.schemeId === schemeId) {
            flagType = "SAME_SCHEME_DUPLICATE";
            flagReason = `Beneficiary is already enrolled in "${targetScheme.name}" (Card: ${enr.cardNumber || "N/A"}) with status: ${enr.status}.`;
            break;
          } else {
            flagType = "CROSS_SCHEME_DUPLICATE";
            flagReason = `Cross-program duplicate! Beneficiary is already actively receiving "${enr.scheme.name}" from ${enr.scheme.department.name} (৳${enr.scheme.monthlyAmount}/mo).`;
            break;
          }
        }
      }
    } else {
      newBeneficiariesCreated++;
      const created = await db.beneficiary.create({
        data: {
          fullName: record.fullName.trim(),
          guardianName: record.guardianName.trim(),
          gender: record.gender.trim() || "Female",
          nid: nid,
          brn: brn,
          mobile: mobile,
          district: record.district?.trim() || batchDistrict || "নেত্রকোণা",
          upazilaName: record.upazilaName?.trim() || batchUpazila || "নেত্রকোণা সদর",
          unionName: record.unionName.trim(),
          wardNo: record.wardNo.trim(),
        },
      });
      beneficiaryId = created.id;
    }

    // Determine status
    const enrollmentStatus = isFlagged ? "Flagged" : "Active";

    if (isFlagged) {
      flaggedCount++;
      flags.push({
        rowNumber: rowNum,
        fullName: record.fullName,
        nid: nid,
        brn: brn,
        schemeName: targetScheme.name,
        flagType,
        reason: flagReason,
        existingRecord: existingDetail,
      });
    } else {
      activeCount++;
    }

    // Create Enrollment Record
    await db.enrollment.create({
      data: {
        beneficiaryId: beneficiaryId,
        schemeId: schemeId,
        cardNumber: record.cardNumber ? String(record.cardNumber).trim() : null,
        startDate: new Date(),
        status: enrollmentStatus,
        uploadedBatchId: batchId,
        uploadedByUserId: uploadedByUserId || null,
      },
    });
  }

  return {
    batchId,
    totalRecords: records.length,
    newBeneficiariesCreated,
    existingBeneficiariesMatched,
    activeCount,
    flaggedCount,
    flags,
  };
}
