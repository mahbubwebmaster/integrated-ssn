import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";


export async function GET() {
  try {
    const dbUrlConfigured = Boolean(process.env.DATABASE_URL);
    const authSecretConfigured = Boolean(process.env.AUTH_SECRET);

    // Test a lightweight query
    const userCount = await prisma.user.count();
    const adminUser = await prisma.user.findFirst({
      where: { role: "SUPER_ADMIN" },
      select: { email: true, name: true, role: true, isActive: true },
    });

    return NextResponse.json({
      status: "healthy",
      database: "connected",
      dbUrlConfigured,
      authSecretConfigured,
      userCount,
      adminUser,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "disconnected",
        dbUrlConfigured: Boolean(process.env.DATABASE_URL),
        authSecretConfigured: Boolean(process.env.AUTH_SECRET),
        error: error?.message || "Unknown database error",
        hint: !process.env.DATABASE_URL
          ? "DATABASE_URL environment variable is missing in Vercel settings."
          : "Database connection failed. Please verify Neon connection string and pooler.",
      },
      { status: 500 }
    );
  }
}
