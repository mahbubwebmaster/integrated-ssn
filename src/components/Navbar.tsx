"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  UploadCloud,
  LayoutDashboard,
  Users,
  ShieldAlert,
  Layers,
  Building2,
  Shield,
  KeyRound,
  LogOut,
  Globe,
  User,
  History,
  ShieldCheck,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { ROLE_CONFIG } from "@/lib/auth";
import { UserProfileModal } from "@/components/UserProfileModal";

export function Navbar() {
  const pathname = usePathname();
  const { currentUser, permissions } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [pendingRemovalCount, setPendingRemovalCount] = useState<number>(0);

  const isDeptOfficer =
    currentUser.role === "DEPT_OFFICER" || currentUser.role === "DEPARTMENT_OFFICER";
  const isUnionViewer = currentUser.role === "UNION_VIEWER";
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
  const isUpazilaAdmin = currentUser.role === "UPAZILA_ADMIN";

  // Fetch pending removal requests count for live badge
  useEffect(() => {
    if (isUpazilaAdmin) {
      fetch("/api/removal-requests?status=PENDING")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.requests)) {
            setPendingRemovalCount(data.requests.length);
          }
        })
        .catch(() => {});
    }
  }, [isUpazilaAdmin, pathname]);

  if (pathname === "/login") {
    return null;
  }

  const navLinks = [
    {
      href: "/",
      label: t.nav.dashboard,
      icon: LayoutDashboard,
      show: true,
    },
    {
      href: "/upload",
      label: t.nav.upload,
      icon: UploadCloud,
      show: !isUnionViewer && permissions.canUploadExcel,
      badge: isDeptOfficer ? t.nav.myDept : undefined,
    },
    {
      href: "/duplicates",
      label: t.nav.duplicates,
      icon: ShieldAlert,
      show: true,
      badge: isUnionViewer ? t.nav.myUnion : isDeptOfficer ? t.nav.conflict : undefined,
    },
    {
      href: "/admin/removal-requests",
      label: language === "bn" ? "অনুমোদন ইনবক্স" : "Approval Inbox",
      icon: ShieldCheck,
      show: isUpazilaAdmin || isSuperAdmin || isDeptOfficer,
      badge: isUpazilaAdmin && pendingRemovalCount > 0 ? (language === "bn" ? `${pendingRemovalCount} টি` : `${pendingRemovalCount}`) : undefined,
      badgeColor: "bg-red-600 text-white font-black animate-pulse shadow-xs",
      adminOnly: true,
    },
    {
      href: "/beneficiaries",
      label: t.nav.beneficiaries,
      icon: Users,
      show: true,
    },
    {
      href: "/schemes",
      label: t.nav.schemes,
      icon: Layers,
      show: true,
    },
    {
      href: "/admin/users",
      label: language === "bn" ? "ইউজার ও পারমিশন" : "Users & Permissions",
      icon: Users,
      show: isSuperAdmin || isUpazilaAdmin,
      adminOnly: true,
    },
    {
      href: "/admin/audit-logs",
      label: language === "bn" ? "ব্যাচ ও অডিট" : "Batch & Audit Logs",
      icon: History,
      show: isSuperAdmin || isUpazilaAdmin || isDeptOfficer,
      adminOnly: true,
    },
  ];

  const currentRoleTitle =
    language === "bn"
      ? (t.roles[currentUser.role as keyof typeof t.roles] || currentUser.roleTitleBn || currentUser.role)
      : (currentUser.roleTitleEn || ROLE_CONFIG[currentUser.role]?.nameEn || currentUser.role);

  return (
    <>
      <header className="no-print border-b border-emerald-900/20 bg-slate-900 text-white sticky top-0 z-40 shadow-md">
        {/* Top Govt Bar */}
        <div className="bg-emerald-950/90 px-4 py-1.5 text-xs text-emerald-200 border-b border-emerald-800/40">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="font-medium tracking-wide">
                {t.common.govtTopBar}
              </span>
            </div>

            <div className="flex items-center gap-3">
              {/* Language Switcher */}
              <div className="flex items-center bg-slate-900/90 rounded-full p-0.5 border border-emerald-700/50 text-[11px] font-bold shadow-inner">
                <Globe className="w-3 h-3 text-emerald-400 ml-2 mr-1" />
                <button
                  type="button"
                  onClick={() => setLanguage("bn")}
                  className={`px-2.5 py-0.5 rounded-full transition-all ${
                    language === "bn"
                      ? "bg-emerald-600 text-white shadow-xs font-black"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="বাংলা ভাষায় দেখুন"
                >
                  বাংলা
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage("en")}
                  className={`px-2.5 py-0.5 rounded-full transition-all ${
                    language === "en"
                      ? "bg-emerald-600 text-white shadow-xs font-black"
                      : "text-slate-300 hover:text-white"
                  }`}
                  title="Switch to English"
                >
                  English
                </button>
              </div>

              {/* Logged-in User Profile & Role Button */}
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-slate-400 hidden lg:inline">
                  {t.common.activeRole}
                </span>

                <button
                  type="button"
                  onClick={() => setProfileModalOpen(true)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border transition-all shadow-xs hover:brightness-125 cursor-pointer ${
                    isSuperAdmin
                      ? "bg-purple-950/80 text-purple-200 border-purple-500/60 hover:bg-purple-900/80"
                      : isDeptOfficer
                      ? "bg-blue-950/80 text-blue-200 border-blue-500/60 hover:bg-blue-900/80"
                      : "bg-emerald-950/80 text-emerald-200 border-emerald-500/60 hover:bg-emerald-900/80"
                  }`}
                  title={language === "bn" ? "প্রোফাইল আপডেট, ছবি ও পাসওয়ার্ড পরিবর্তন" : "Profile, Photo & Security"}
                >
                  {currentUser.image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={currentUser.image}
                      alt={currentUser.name}
                      className="w-4 h-4 rounded-full object-cover border border-emerald-400"
                    />
                  ) : (
                    <Shield className="w-3 h-3 text-emerald-300" />
                  )}
                  <span className="font-bold">{currentRoleTitle}</span>
                  {currentUser.upazilaName ? (
                    <span className="text-amber-300 font-bold hidden sm:inline bg-amber-950/60 px-1.5 py-0.5 rounded border border-amber-600/40 text-[10px]">
                      {currentUser.upazilaName}
                    </span>
                  ) : (
                    <span className="text-purple-300 font-bold hidden sm:inline bg-purple-950/60 px-1.5 py-0.5 rounded border border-purple-600/40 text-[10px]">
                      {language === "bn" ? "সমগ্র নেত্রকোণা জেলা" : "Netrokona District"}
                    </span>
                  )}
                  {currentUser.designation && (
                    <span className="text-emerald-300 font-medium hidden md:inline">
                      • {currentUser.designation}
                    </span>
                  )}
                  <span className="text-slate-300 font-normal hidden lg:inline">({currentUser.name})</span>
                </button>
              </div>

              {/* Sign Out Button */}
              <button
                type="button"
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold bg-red-950/70 hover:bg-red-900/90 text-red-200 border border-red-800/60 transition-all shadow-xs"
                title={t.common.signOut}
              >
                <LogOut className="w-3 h-3 text-red-400" />
                <span className="hidden sm:inline">{t.common.signOut}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Nav */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Portal Title */}
            <Link href="/" className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white shadow-inner font-bold text-lg border border-emerald-400/30 group-hover:scale-105 transition-transform">
                <Building2 className="w-5 h-5 text-emerald-100" />
              </div>
              <div>
                <div className="font-bold text-base leading-tight tracking-tight text-white flex items-center gap-2">
                  {language === "bn" ? "সমন্বিত সুবিধাভোগী ব্যবস্থাপনা" : "Integrated Beneficiary Management"}
                </div>
                <div className="text-xs text-emerald-400 font-medium">
                  {currentUser.upazilaName
                    ? (currentUser.upazilaName.includes("উপজেলা") ? currentUser.upazilaName : `${currentUser.upazilaName} উপজেলা`)
                    : (language === "bn" ? "কলমাকান্দা উপজেলা" : "Kalmakanda Upazila")}
                </div>
                <div className="text-xs text-slate-400 font-normal">
                  {currentUser.designation ? (
                    <span>
                      {currentUser.designation} &bull; {currentUser.name}
                    </span>
                  ) : currentUser.role === "SUPER_ADMIN" ? (
                    language === "bn" ? "কেন্দ্রীয় অ্যাডমিনিস্ট্রেশন ও মনিটরিং" : "Central Administration & Monitoring"
                  ) : (
                    language === "bn" ? "দাপ্তরিক এক্সেস" : "Official Access"
                  )}
                </div>
              </div>
            </Link>

            {/* Links */}
            <nav className="hidden lg:flex items-center gap-1">
              {navLinks.map((item) => {
                if (!item.show) return null;
                const Icon = item.icon;
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold transition-all relative ${
                      isActive
                        ? "bg-emerald-800 text-white shadow-sm"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-emerald-200" : "text-slate-400"}`} />
                    <span>{item.label}</span>
                    {item.badge && (
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                          (item as any).badgeColor || "bg-amber-500/20 text-amber-300 font-medium border border-amber-500/30"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      </header>

      {/* User Profile, Photo, Verification & Password Modal */}
      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </>
  );
}
