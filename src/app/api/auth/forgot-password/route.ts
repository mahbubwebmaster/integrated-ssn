import { NextResponse } from "next/server";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { sendOtpEmail } from "@/lib/email";

const AUTH_SECRET = process.env.AUTH_SECRET || "ssnp-bangladesh-local-gov-secret-key-2026-audit-trail-sec";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // =========================================================================
    // 1. REQUEST OTP FOR PASSWORD RESET
    // =========================================================================
    if (action === "request_otp") {
      const email = String(body.email || "").trim().toLowerCase();
      if (!email) {
        return NextResponse.json(
          { success: false, error: "দয়া করে আপনার নিবন্ধিত ইমেইল ঠিকানা প্রদান করুন।" },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user || !user.isActive) {
        return NextResponse.json(
          {
            success: false,
            error: "এই ইমেইল ঠিকানা সংবলিত কোনো সক্রিয় ব্যবহারকারী অ্যাকাউন্ট পাওয়া যায়নি।",
          },
          { status: 404 }
        );
      }

      // Generate a secure 6-digit OTP
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      // Expiry: 15 minutes
      const expiry = Date.now() + 15 * 60 * 1000;

      // Cryptographic signature binding userId, email, otp, expiry, and current passwordHash
      const signature = crypto
        .createHmac("sha256", AUTH_SECRET)
        .update(`${user.id}:${user.email.toLowerCase()}:${otp}:${expiry}:${user.passwordHash}`)
        .digest("hex");

      const resetToken = Buffer.from(
        JSON.stringify({
          userId: user.id,
          email: user.email.toLowerCase(),
          expiry,
          signature,
        })
      ).toString("base64url");

      // Log the OTP in server console for local testing / developer inspection
      console.log(`[AUTH FORGOT PASSWORD] Generated OTP for ${email}: ${otp}`);

      // Record Audit Trail
      try {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            actionType: "PASSWORD_RESET_REQUESTED",
            details: `ব্যবহারকারী (${user.name}, ${user.email}) এর জন্য পাসওয়ার্ড পুনরুদ্ধারের ৬-ডিজিট ওটিপি কোড তৈরি করা হয়েছে।`,
          },
        });
      } catch (auditErr) {
        console.warn("Failed to create audit log for forgot password request:", auditErr);
      }

      // Attempt real email dispatch via Nodemailer / Gmail SMTP
      const emailResult = await sendOtpEmail({
        to: user.email,
        name: user.name,
        otp,
      });

      return NextResponse.json({
        success: true,
        message: emailResult.success
          ? `আপনার নিবন্ধিত ইমেইল ঠিকানায় (${email}) ৬ সংখ্যার যাচাইকরণ কোড পাঠানো হয়েছে। আপনার ইনবক্স অথবা স্প্যাম (Spam) ফোল্ডার চেক করুন।`
          : `আপনার নিবন্ধিত ইমেইল ঠিকানায় (${email}) ৬ সংখ্যার যাচাইকরণ কোড পাঠানো হয়েছে।`,
        resetToken,
        emailSent: emailResult.success,
      });
    }

    // =========================================================================
    // 2. VERIFY OTP & RESET PASSWORD
    // =========================================================================
    if (action === "reset_password") {
      const { resetToken, otp, newPassword } = body;

      if (!resetToken || !otp || !newPassword) {
        return NextResponse.json(
          { success: false, error: "যাচাইকরণ কোড ও নতুন পাসওয়ার্ড সঠিকভাবে পূরণ করুন।" },
          { status: 400 }
        );
      }

      if (String(newPassword).length < 6) {
        return NextResponse.json(
          { success: false, error: "নতুন পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে।" },
          { status: 400 }
        );
      }

      let payload: { userId: string; email: string; expiry: number; signature: string };
      try {
        payload = JSON.parse(Buffer.from(resetToken, "base64url").toString("utf8"));
      } catch {
        return NextResponse.json(
          { success: false, error: "অবৈধ বা ত্রুটিপূর্ণ রিসেট টোকেন (Invalid Token)।" },
          { status: 400 }
        );
      }

      const { userId, expiry, signature } = payload;

      // Check Expiry
      if (Date.now() > expiry) {
        return NextResponse.json(
          { success: false, error: "যাচাইকরণ কোডের মেয়াদ (১৫ মিনিট) উত্তীর্ণ হয়ে গেছে। অনুগ্রহ করে আবার কোড চান।" },
          { status: 400 }
        );
      }

      const user = await prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: "ব্যবহারকারী খুঁজে পাওয়া যায়নি।" },
          { status: 404 }
        );
      }

      // Recompute expected HMAC signature with provided OTP
      const expectedSignature = crypto
        .createHmac("sha256", AUTH_SECRET)
        .update(`${user.id}:${user.email.toLowerCase()}:${String(otp).trim()}:${expiry}:${user.passwordHash}`)
        .digest("hex");

      if (signature !== expectedSignature) {
        return NextResponse.json(
          { success: false, error: "ভুল যাচাইকরণ কোড (Invalid OTP) প্রবেশ করানো হয়েছে।" },
          { status: 400 }
        );
      }

      // Hash new password with bcrypt
      const newPasswordHash = bcrypt.hashSync(String(newPassword), 10);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: newPasswordHash,
          password: null, // Wipe old legacy plain password
        },
      });

      // Record Audit Trail
      try {
        await prisma.auditLog.create({
          data: {
            userId: user.id,
            actionType: "PASSWORD_RESET_COMPLETED",
            details: `ব্যবহারকারী (${user.name}, ${user.email}) এর পাসওয়ার্ড সফলভাবে পুনরুদ্ধার ও পরিবর্তন করা হয়েছে।`,
          },
        });
      } catch (auditErr) {
        console.warn("Failed to create audit log for forgot password reset:", auditErr);
      }

      return NextResponse.json({
        success: true,
        message: "আপনার পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে। নতুন পাসওয়ার্ড দিয়ে লগইন করুন।",
      });
    }

    return NextResponse.json(
      { success: false, error: "অবৈধ অ্যাকশন (Invalid action)" },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error("Forgot password route error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
