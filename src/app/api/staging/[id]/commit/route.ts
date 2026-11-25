import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { processBatchUpload, CleanedRecord } from "@/lib/dedup";
import fs from "fs";
import path from "path";

const STAGING_DIR = path.join(process.cwd(), "src", "data", "staging");
const MANIFEST_FILE = path.join(STAGING_DIR, "manifest.json");

function readManifest(): any[] {
  try {
    if (!fs.existsSync(MANIFEST_FILE)) return [];
    return JSON.parse(fs.readFileSync(MANIFEST_FILE, "utf8"));
  } catch {
    return [];
  }
}

function writeManifest(items: any[]) {
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(items, null, 2));
}

// Convert Bengali numerals to standard Western numerals
function toEnglishDigits(str: string): string {
  const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return str.replace(/[০-৯]/g, (d) => String(bnDigits.indexOf(d)));
}

// POST /api/staging/[id]/commit
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const manifest = readManifest();
    const stagedIndex = manifest.findIndex((m) => m.id === id);

    if (stagedIndex === -1) {
      return NextResponse.json({ success: false, error: "Staged batch not found" }, { status: 404 });
    }

    const stagedItem = manifest[stagedIndex];
    const dataFilePath = path.join(STAGING_DIR, `${id}.json`);

    if (!fs.existsSync(dataFilePath)) {
      return NextResponse.json({ success: false, error: "Staged data file is missing" }, { status: 404 });
    }

    const rawRows: any[] = JSON.parse(fs.readFileSync(dataFilePath, "utf8"));
    const body = await request.json();
    const columnMapping = body.columnMapping || stagedItem.columnMapping || {};

    // Transform raw rows into CleanedRecord
    const records: CleanedRecord[] = rawRows.map((row: any, idx: number) => {
      const getVal = (sysKey: string): string => {
        const colHeader = columnMapping[sysKey];
        if (!colHeader) return "";
        return String(row[colHeader] ?? "").trim();
      };

      const rawFullName = getVal("fullName") || `উপকারভোগী-${idx + 1}`;
      const rawGuardian = getVal("guardianName") || "তথ্য নেই";
      const rawGender = getVal("gender") || "Female";
      const rawNid = getVal("nid");
      const rawBrn = getVal("brn");
      const rawMobile = getVal("mobile");
      const rawDistrict = getVal("district") || stagedItem.district || "নেত্রকোণা";
      const rawUpazila = getVal("upazilaName") || stagedItem.upazilaName || "নেত্রকোণা সদর";
      const rawUnion = getVal("unionName") || "সদর";
      const rawWard = getVal("wardNo") || "০১";
      const rawCard = getVal("cardNumber");

      // Normalize digits and characters
      const cleanNid = rawNid ? toEnglishDigits(rawNid).replace(/\D/g, "") : undefined;
      const cleanBrn = rawBrn ? toEnglishDigits(rawBrn).replace(/\D/g, "") : undefined;
      let cleanMobile = rawMobile ? toEnglishDigits(rawMobile).replace(/\D/g, "") : undefined;
      if (cleanMobile && cleanMobile.startsWith("8801")) {
        cleanMobile = cleanMobile.substring(2);
      }

      return {
        fullName: rawFullName,
        guardianName: rawGuardian,
        gender: rawGender,
        nid: cleanNid,
        brn: cleanBrn,
        mobile: cleanMobile,
        district: rawDistrict,
        upazilaName: rawUpazila,
        unionName: rawUnion,
        wardNo: rawWard,
        cardNumber: rawCard,
        rowNumber: idx + 1,
      };
    });

    const targetScheme = await prisma.scheme.findUnique({
      where: { id: stagedItem.schemeId },
      include: { department: true },
    });

    if (!targetScheme) {
      return NextResponse.json({ success: false, error: "Scheme not found" }, { status: 404 });
    }

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const batchCode = `BATCH-${timestamp}-${randomSuffix}`;
    let validUserId = session?.user?.id;
    if (!validUserId) {
      const fallbackUser = await prisma.user.findFirst({
        where: { role: "SUPER_ADMIN" },
        select: { id: true },
      });
      validUserId = fallbackUser?.id || (await prisma.user.findFirst({ select: { id: true } }))?.id || undefined;
    }

    if (!validUserId) {
      return NextResponse.json(
        { success: false, error: "No valid user account found for upload attribution." },
        { status: 400 }
      );
    }
    const currentUserId: string = validUserId;

    // Wrap ingestion in transaction
    const { uploadBatch, processResult } = await prisma.$transaction(
      async (tx) => {
        const batch = await tx.uploadBatch.create({
          data: {
            batchCode,
            fileName: stagedItem.fileName,
            departmentId: stagedItem.departmentId,
            schemeId: stagedItem.schemeId,
            totalRecords: records.length,
            uploadedByUserId: currentUserId,
            district: stagedItem.district,
            upazilaName: stagedItem.upazilaName,
            status: "ACTIVE",
          },
        });

        const result = await processBatchUpload(
          stagedItem.departmentId,
          stagedItem.schemeId,
          records,
          batch.id,
          currentUserId,
          tx,
          stagedItem.district,
          stagedItem.upazilaName
        );

        await tx.auditLog.create({
          data: {
            userId: currentUserId,
            actionType: "BATCH_UPLOAD",
            entityId: batch.id,
            details: `${session.user.name || "অফিসার"} অস্থায়ী স্টেজিং টেবিল থেকে ${records.length} টি রেকর্ড "${targetScheme.name}" এ বাল্ক ইমপোর্ট ও যাচাই সম্পন্ন করেছেন (${result.activeCount} সক্রিয়, ${result.flaggedCount} ডুপ্লিকেট চিহ্নিত)।`,
          },
        });

        return { uploadBatch: batch, processResult: result };
      },
      { timeout: 60000 }
    );

    // Update manifest
    manifest[stagedIndex].status = "COMMITTED";
    manifest[stagedIndex].committedAt = new Date().toISOString();
    manifest[stagedIndex].columnMapping = columnMapping;
    writeManifest(manifest);

    const { batchId: _processedBatchId, ...restResult } = processResult;

    return NextResponse.json({
      success: true,
      batchId: uploadBatch.id,
      batchCode: uploadBatch.batchCode,
      fileName: stagedItem.fileName,
      ...restResult,
    });
  } catch (error: any) {
    console.error("Failed to commit staged batch:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
