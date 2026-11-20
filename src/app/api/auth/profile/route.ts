import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন (Unauthorized)" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || session.user.id;

    if (!userId) {
      return NextResponse.json({ success: false, error: "User ID is required." }, { status: 400 });
    }

    // Authorization check: User can view their own profile, or admins can view other profiles
    const requesterRole = session.user.role;
    const isSelf = session.user.id === userId;
    const isAdmin = requesterRole === "SUPER_ADMIN" || requesterRole === "DISTRICT_ADMIN" || requesterRole === "UPAZILA_ADMIN";

    if (!isSelf && !isAdmin) {
      return NextResponse.json({ success: false, error: "অ্যাক্সেস ডিনাইড: অন্য ব্যবহারকারীর প্রোফাইল দেখার অনুমতি নেই (Forbidden)" }, { status: 403 });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        name: user.name,
        designation: user.designation || null,
        email: user.email,
        role: user.role,
        phone: user.phone || null,
        phoneVerified: Boolean(user.phoneVerified),
        image: user.image || null,
        isEmailVerified: Boolean(user.isEmailVerified),
        departmentId: user.departmentId,
        departmentName: user.department?.name || null,
        departmentNameBn: user.department?.nameBn || null,
        departmentNameEn: user.department?.nameEn || null,
        district: user.district || "নেত্রকোণা",
        upazilaName: user.upazilaName || null,
        unionName: user.unionName || null,
        wardNo: user.wardNo || null,
      },
    });
  } catch (error: unknown) {
    console.error("Profile GET error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "অননুমোদিত অ্যাক্সেস। অনুগ্রহ করে লগইন করুন (Unauthorized)" }, { status: 401 });
    }

    const body = await request.json();
    const { userId, action } = body;

    if (!userId || !action) {
      return NextResponse.json(
        { success: false, error: "userId and action are required." },
        { status: 400 }
      );
    }

    // IDOR Protection: User can only update their own profile, or SUPER_ADMIN can perform administrative changes
    const isSelf = session.user.id === userId;
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";

    if (!isSelf && !isSuperAdmin) {
      return NextResponse.json(
        { success: false, error: "অ্যাক্সেস ডিনাইড: অন্য ব্যবহারকারীর প্রোফাইল বা পাসওয়ার্ড পরিবর্তন করার এখতিয়ার নেই (Forbidden)" },
        { status: 403 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { department: true },
    });

    if (!user) {
      return NextResponse.json({ success: false, error: "User not found." }, { status: 404 });
    }

    // 1. Update Profile (Name, Phone, Image, Designation)
    if (action === "update_profile") {
      const { name, phone, image, designation } = body;
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          name: name !== undefined ? String(name).trim() : user.name,
          designation: designation !== undefined ? (designation ? String(designation).trim() : null) : user.designation,
          phone: phone !== undefined ? String(phone).trim() : user.phone,
          image: image !== undefined ? image : user.image,
        },
        include: { department: true },
      });

      return NextResponse.json({
        success: true,
        user: {
          id: updated.id,
          name: updated.name,
          designation: updated.designation || null,
          email: updated.email,
          role: updated.role,
          phone: updated.phone || null,
          phoneVerified: Boolean(updated.phoneVerified),
          image: updated.image || null,
          isEmailVerified: Boolean(updated.isEmailVerified),
          departmentId: updated.departmentId,
          departmentName: updated.department?.name || null,
          departmentNameBn: updated.department?.nameBn || null,
          departmentNameEn: updated.department?.nameEn || null,
          unionName: updated.unionName || null,
          wardNo: updated.wardNo || null,
        },
      });
    }

    // 2. Verify Mobile
    if (action === "verify_phone") {
      const { phone, otp } = body;
      // Accept any valid 4-digit OTP or default simulation code '1234'
      if (!otp || String(otp).length < 4) {
        return NextResponse.json(
          { success: false, error: "Please enter a valid 4-digit OTP code." },
          { status: 400 }
        );
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          phone: phone ? String(phone).trim() : user.phone,
          phoneVerified: true,
        },
        include: { department: true },
      });

      return NextResponse.json({
        success: true,
        message: "Mobile number verified successfully.",
        user: {
          id: updated.id,
          name: updated.name,
          designation: updated.designation || null,
          email: updated.email,
          role: updated.role,
          phone: updated.phone || null,
          phoneVerified: true,
          image: updated.image || null,
          isEmailVerified: Boolean(updated.isEmailVerified),
          departmentId: updated.departmentId,
          departmentName: updated.department?.name || null,
          departmentNameBn: updated.department?.nameBn || null,
          departmentNameEn: updated.department?.nameEn || null,
          unionName: updated.unionName || null,
          wardNo: updated.wardNo || null,
        },
      });
    }

    // 3. Verify Email
    if (action === "verify_email") {
      const updated = await prisma.user.update({
        where: { id: userId },
        data: {
          isEmailVerified: true,
        },
        include: { department: true },
      });

      return NextResponse.json({
        success: true,
        message: "Email address verified successfully.",
        user: {
          id: updated.id,
          name: updated.name,
          designation: updated.designation || null,
          email: updated.email,
          role: updated.role,
          phone: updated.phone || null,
          phoneVerified: Boolean(updated.phoneVerified),
          image: updated.image || null,
          isEmailVerified: true,
          departmentId: updated.departmentId,
          departmentName: updated.department?.name || null,
          departmentNameBn: updated.department?.nameBn || null,
          departmentNameEn: updated.department?.nameEn || null,
          unionName: updated.unionName || null,
          wardNo: updated.wardNo || null,
        },
      });
    }

    // 4. Change Password
    if (action === "change_password") {
      const { currentPassword, newPassword } = body;

      if (!currentPassword || !newPassword) {
        return NextResponse.json(
          { success: false, error: "Both current and new password are required." },
          { status: 400 }
        );
      }

      if (String(newPassword).length < 6) {
        return NextResponse.json(
          { success: false, error: "New password must be at least 6 characters." },
          { status: 400 }
        );
      }

      // Verify current password against stored hash (or legacy plain password if present)
      const isMatch =
        verifyPassword(currentPassword, user.passwordHash) ||
        Boolean(user.password && currentPassword === user.password);

      if (!isMatch) {
        return NextResponse.json(
          { success: false, error: "Current password does not match." },
          { status: 400 }
        );
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: hashPassword(newPassword),
          password: null, // Clear legacy plain text password
        },
      });

      return NextResponse.json({
        success: true,
        message: "Password changed successfully.",
      });
    }

    return NextResponse.json({ success: false, error: "Unknown action" }, { status: 400 });
  } catch (error: unknown) {
    console.error("Profile PATCH error:", error);
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
