import { NextResponse } from "next/server";
import { auth } from "@/auth";
import fs from "fs";
import path from "path";

const STAGING_DIR = path.join(process.cwd(), "src", "data", "staging");
const MANIFEST_FILE = path.join(STAGING_DIR, "manifest.json");

function ensureStagingDir() {
  if (!fs.existsSync(STAGING_DIR)) {
    fs.mkdirSync(STAGING_DIR, { recursive: true });
  }
  if (!fs.existsSync(MANIFEST_FILE)) {
    fs.writeFileSync(MANIFEST_FILE, JSON.stringify([], null, 2));
  }
}

interface StagedManifestItem {
  id: string;
  stageCode: string;
  fileName: string;
  departmentId: string;
  departmentName?: string;
  schemeId: string;
  schemeName?: string;
  district: string;
  upazilaName: string;
  totalRows: number;
  headers: string[];
  columnMapping?: Record<string, string>;
  presetId?: string;
  status: "STAGED" | "COMMITTED" | "DISCARDED";
  uploadedByUserId: string;
  uploadedByUserName: string;
  createdAt: string;
  committedAt?: string;
}

function readManifest(): StagedManifestItem[] {
  ensureStagingDir();
  try {
    const data = fs.readFileSync(MANIFEST_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeManifest(items: StagedManifestItem[]) {
  ensureStagingDir();
  fs.writeFileSync(MANIFEST_FILE, JSON.stringify(items, null, 2));
}

// GET /api/staging - List staged batches
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const manifest = readManifest();
    return NextResponse.json({ success: true, stagedBatches: manifest });
  } catch (error: any) {
    console.error("Failed to load staging batches:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// POST /api/staging - Upload raw data to staging buffer
export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const {
      departmentId,
      departmentName,
      schemeId,
      schemeName,
      district,
      upazilaName,
      fileName,
      headers,
      rawRows,
      columnMapping,
      presetId,
    } = body;

    if (!departmentId || !schemeId) {
      return NextResponse.json(
        { success: false, error: "দপ্তর এবং কর্মসূচি নির্বাচন করা আবশ্যক।" },
        { status: 400 }
      );
    }

    if (!rawRows || !Array.isArray(rawRows) || rawRows.length === 0) {
      return NextResponse.json(
        { success: false, error: "ফাইলের মধ্যে কোনো ডাটা পাওয়া যায়নি।" },
        { status: 400 }
      );
    }

    ensureStagingDir();

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
    const stageId = `STAGE-${timestamp}-${randomSuffix}`;
    const stageCode = `STG-${timestamp}-${randomSuffix}`;

    // Write raw rows to dedicated JSON file
    const dataFilePath = path.join(STAGING_DIR, `${stageId}.json`);
    fs.writeFileSync(dataFilePath, JSON.stringify(rawRows, null, 2));

    const manifest = readManifest();
    const newItem: StagedManifestItem = {
      id: stageId,
      stageCode,
      fileName: fileName || "uploaded_mis_data.xlsx",
      departmentId,
      departmentName,
      schemeId,
      schemeName,
      district: district || "নেত্রকোণা",
      upazilaName: upazilaName || "নেত্রকোণা সদর",
      totalRows: rawRows.length,
      headers: headers || [],
      columnMapping: columnMapping || {},
      presetId: presetId || "auto",
      status: "STAGED",
      uploadedByUserId: session.user.id || "",
      uploadedByUserName: session.user.name || "অফিসার",
      createdAt: new Date().toISOString(),
    };

    manifest.unshift(newItem);
    writeManifest(manifest);

    return NextResponse.json({
      success: true,
      stageId,
      stageCode,
      message: `ফাইলটি সফলভাবে অস্থায়ী টেবিলে (${rawRows.length} টি সারি) সংরক্ষিত হয়েছে।`,
      item: newItem,
    });
  } catch (error: any) {
    console.error("Staging upload error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
