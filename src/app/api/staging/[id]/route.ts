import { NextResponse } from "next/server";
import { auth } from "@/auth";
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

const SAFE_ID_REGEX = /^[A-Za-z0-9_-]+$/;

function getSafeStagingFilePath(id: string): string | null {
  if (!SAFE_ID_REGEX.test(id)) return null;
  const resolvedDir = path.resolve(STAGING_DIR);
  const resolvedFile = path.resolve(STAGING_DIR, `${id}.json`);
  if (!resolvedFile.startsWith(resolvedDir + path.sep)) return null;
  return resolvedFile;
}

function canAccessStagedItem(sessionUser: any, item: any): boolean {
  const role = sessionUser?.role;
  if (role === "UNION_VIEWER") return false;
  if (role === "SUPER_ADMIN" || role === "DISTRICT_ADMIN" || role === "UPAZILA_ADMIN") return true;
  return Boolean(sessionUser?.id && item?.uploadedByUserId === sessionUser.id);
}

// GET /api/staging/[id]
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const dataFilePath = getSafeStagingFilePath(id);
    if (!dataFilePath) {
      return NextResponse.json({ success: false, error: "Invalid staged batch ID" }, { status: 400 });
    }

    const manifest = readManifest();
    const item = manifest.find((m) => m.id === id);

    if (!item) {
      return NextResponse.json({ success: false, error: "Staged batch not found" }, { status: 404 });
    }

    if (!canAccessStagedItem(session.user, item)) {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত: এই স্টেজড ব্যাচ দেখার অনুমতি আপনার নেই (Forbidden)" },
        { status: 403 }
      );
    }

    let rawRows: any[] = [];
    if (fs.existsSync(dataFilePath)) {
      rawRows = JSON.parse(fs.readFileSync(dataFilePath, "utf8"));
    }

    return NextResponse.json({
      success: true,
      stagedBatch: item,
      rawRows,
      previewRows: rawRows.slice(0, 30),
    });
  } catch (error: any) {
    console.error("Failed to read staged batch:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// DELETE /api/staging/[id]
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const dataFilePath = getSafeStagingFilePath(id);
    if (!dataFilePath) {
      return NextResponse.json({ success: false, error: "Invalid staged batch ID" }, { status: 400 });
    }

    let manifest = readManifest();
    const item = manifest.find((m) => m.id === id);
    if (!item) {
      return NextResponse.json({ success: false, error: "Staged batch not found" }, { status: 404 });
    }

    if (!canAccessStagedItem(session.user, item)) {
      return NextResponse.json(
        { success: false, error: "অননুমোদিত: এই স্টেজড ব্যাচ মুছে ফেলার অনুমতি আপনার নেই (Forbidden)" },
        { status: 403 }
      );
    }

    manifest = manifest.filter((m) => m.id !== id);
    writeManifest(manifest);

    if (fs.existsSync(dataFilePath)) {
      try {
        fs.unlinkSync(dataFilePath);
      } catch {}
    }

    return NextResponse.json({
      success: true,
      message: "অস্থায়ী ডাটা সফলভাবে মুছে ফেলা হয়েছে।",
    });
  } catch (error: any) {
    console.error("Failed to delete staged batch:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
