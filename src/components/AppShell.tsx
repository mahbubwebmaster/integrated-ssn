"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Menu,
  X,
  LayoutDashboard,
  UploadCloud,
  ShieldAlert,
  ShieldCheck,
  Users,
  Layers,
  KeyRound,
  History,
  LogOut,
  Globe,
  Building2,
  Shield,
  User,
  ChevronRight,
  ExternalLink,
  Lock,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { ROLE_CONFIG } from "@/lib/auth";
import { UserProfileModal } from "@/components/UserProfileModal";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const { currentUser, permissions } = useAuth();
  const { language, setLanguage, t } = useLanguage();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [pendingRemovalCount, setPendingRemovalCount] = useState<number>(0);

  const isDeptOfficer =
    currentUser.role === "DEPT_OFFICER" || currentUser.role === "DEPARTMENT_OFFICER";
  const isUnionViewer = currentUser.role === "UNION_VIEWER";
  const isSuperAdmin = currentUser.role === "SUPER_ADMIN";
  const isUpazilaAdmin = currentUser.role === "UPAZILA_ADMIN";

  // Fetch pending removal requests count for live badge
  useEffect(() => {
    if (isUpazilaAdmin || isSuperAdmin) {
      fetch("/api/removal-requests?status=PENDING")
        .then((res) => res.json())
        .then((data) => {
          if (data.success && Array.isArray(data.requests)) {
            setPendingRemovalCount(data.requests.length);
          }
        })
        .catch(() => {});
    }
  }, [isUpazilaAdmin, isSuperAdmin, pathname]);

  // Auto-close mobile drawer when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  // Handle escape key to close mobile drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Prevent background scrolling when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  // Do not render shell on login page
  if (pathname === "/login") {
    return <>{children}</>;
  }

  const currentRoleTitle =
    language === "bn"
      ? t.roles[currentUser.role as keyof typeof t.roles] ||
        currentUser.roleTitleBn ||
        currentUser.role
      : currentUser.roleTitleEn ||
        ROLE_CONFIG[currentUser.role]?.nameEn ||
        currentUser.role;

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
      badge:
        (isUpazilaAdmin || isSuperAdmin) && pendingRemovalCount > 0
          ? language === "bn"
            ? `${pendingRemovalCount} টি`
            : `${pendingRemovalCount}`
          : undefined,
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
      icon: KeyRound,
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

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* =========================================================================
          1. DESKTOP PERMANENT LEFT SIDEBAR (lg:flex w-64)
      ========================================================================= */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-64 bg-slate-900 border-r border-slate-800 text-white z-30 flex-col shadow-xl select-none">
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/60">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white shadow-inner font-bold text-lg border border-emerald-400/30 group-hover:scale-105 transition-transform shrink-0">
              <Building2 className="w-5 h-5 text-emerald-100" />
            </div>
            <div className="overflow-hidden">
              <div className="font-bold text-sm leading-tight text-white truncate flex items-center gap-1.5">
                <span>{language === "bn" ? "ডুপ্লিকেশন পোর্টাল" : "SSNP Portal"}</span>
                <span className="text-[9px] font-bold bg-emerald-800 text-emerald-200 px-1.5 py-0.5 rounded-full uppercase">
                  {language === "bn" ? "নেত্রকোণা" : "Netrokona"}
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate mt-0.5 font-medium">
                {currentUser.upazilaName
                  ? `${currentUser.upazilaName} প্রশাসন`
                  : language === "bn"
                  ? "সমগ্র জেলা প্রশাসন"
                  : "District Administration"}
              </p>
            </div>
          </Link>
        </div>

        {/* Navigation Links (Scrollable) */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1 custom-scrollbar">
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {language === "bn" ? "প্রধান মেনু" : "Navigation Menu"}
          </div>

          {navLinks.map((item) => {
            if (!item.show) return null;
            const Icon = item.icon;
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                  isActive
                    ? "bg-emerald-700 text-white shadow-md shadow-emerald-950/40"
                    : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon
                    className={`w-4 h-4 shrink-0 transition-colors ${
                      isActive ? "text-emerald-100" : "text-slate-400 group-hover:text-slate-200"
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ml-2 ${
                      item.badgeColor ||
                      "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </div>

        {/* User Card & Controls (Bottom of Sidebar) */}
        <div className="p-3 border-t border-slate-800/80 bg-slate-950/70 space-y-2.5">
          {/* Language Switcher */}
          <div className="flex items-center justify-between bg-slate-900 rounded-xl p-1 border border-slate-800 text-xs">
            <div className="flex items-center gap-1.5 pl-2 text-slate-400 text-[11px] font-medium">
              <Globe className="w-3.5 h-3.5 text-emerald-400" />
              <span>{language === "bn" ? "ভাষা" : "Lang"}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setLanguage("bn")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  language === "bn"
                    ? "bg-emerald-600 text-white shadow-xs font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                বাংলা
              </button>
              <button
                type="button"
                onClick={() => setLanguage("en")}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all ${
                  language === "en"
                    ? "bg-emerald-600 text-white shadow-xs font-black"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                EN
              </button>
            </div>
          </div>

          {/* User Profile Summary Button */}
          <button
            type="button"
            onClick={() => setProfileModalOpen(true)}
            className="w-full flex items-center gap-2.5 p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-800 text-left transition-all group"
            title={language === "bn" ? "প্রোফাইল ও পাসওয়ার্ড পরিবর্তন" : "Profile & Security Settings"}
          >
            {currentUser.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={currentUser.image}
                alt={currentUser.name}
                className="w-8 h-8 rounded-full object-cover border border-emerald-400 shrink-0"
              />
            ) : (
              <div className="w-8 h-8 rounded-full bg-emerald-900/80 border border-emerald-600/50 flex items-center justify-center text-emerald-300 shrink-0">
                <User className="w-4 h-4" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-xs font-bold text-white truncate group-hover:text-emerald-300 transition-colors">
                {currentUser.name}
              </div>
              <div className="text-[10px] text-emerald-400 font-medium truncate">
                {currentRoleTitle}
              </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-slate-300 shrink-0" />
          </button>

          {/* Sign Out Button */}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-950/70 border border-red-900/40 transition-all hover:text-red-200"
          >
            <LogOut className="w-3.5 h-3.5 text-red-400" />
            <span>{t.common.signOut}</span>
          </button>
        </div>
      </aside>

      {/* =========================================================================
          2. MOBILE & TABLET STICKY TOP NAVBAR (lg:hidden)
      ========================================================================= */}
      <div className="lg:hidden sticky top-0 z-40 bg-slate-900 border-b border-slate-800 text-white shadow-md no-print">
        {/* Micro Govt Top Notice */}
        <div className="bg-emerald-950 px-3 py-1 text-[11px] text-emerald-200 border-b border-emerald-900/50 flex items-center justify-between">
          <div className="flex items-center gap-1.5 truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
            <span className="truncate">{t.common.govtTopBar}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => setLanguage("bn")}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                language === "bn" ? "bg-emerald-600 text-white" : "text-slate-400"
              }`}
            >
              বাং
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                language === "en" ? "bg-emerald-600 text-white" : "text-slate-400"
              }`}
            >
              EN
            </button>
          </div>
        </div>

        {/* Main Mobile Header Bar */}
        <div className="px-4 py-2.5 flex items-center justify-between gap-2">
          {/* Left: Hamburger Button + Logo */}
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen(true)}
              className="p-2 -ml-1 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Open mobile menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <Link href="/" className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-bold shrink-0 shadow-sm border border-emerald-400/30">
                <Building2 className="w-4 h-4 text-emerald-100" />
              </div>
              <div className="truncate">
                <div className="font-bold text-xs leading-tight text-white truncate">
                  {language === "bn" ? "ডুপ্লিকেশন পোর্টাল" : "SSNP Portal"}
                </div>
                <div className="text-[10px] text-slate-400 truncate">
                  {currentUser.upazilaName || (language === "bn" ? "নেত্রকোণা জেলা" : "Netrokona District")}
                </div>
              </div>
            </Link>
          </div>

          {/* Right: Role Badge & Profile Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold border transition-all shadow-xs ${
                isSuperAdmin
                  ? "bg-purple-950 text-purple-200 border-purple-500/60"
                  : isDeptOfficer
                  ? "bg-blue-950 text-blue-200 border-blue-500/60"
                  : "bg-emerald-950 text-emerald-200 border-emerald-500/60"
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
              <span className="truncate max-w-[100px]">{currentRoleTitle}</span>
            </button>

            {/* Quick Pending Badge on Mobile for UNO */}
            {(isUpazilaAdmin || isSuperAdmin) && pendingRemovalCount > 0 && (
              <Link
                href="/admin/removal-requests"
                className="flex items-center justify-center w-7 h-7 rounded-full bg-red-600 text-white text-[10px] font-bold animate-pulse shadow-md"
                title={`${pendingRemovalCount} pending removal requests`}
              >
                {pendingRemovalCount}
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* =========================================================================
          3. MOBILE SLIDE-OVER DRAWER & BACKDROP
      ========================================================================= */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          {/* Dark Backdrop Overlay */}
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity duration-300"
            onClick={() => setIsMobileMenuOpen(false)}
            aria-hidden="true"
          />

          {/* Slide-over Drawer Panel */}
          <div className="relative w-72 sm:w-80 max-w-[85vw] bg-slate-900 text-white z-50 flex flex-col shadow-2xl border-r border-slate-800 animate-in slide-in-from-left duration-300">
            {/* Drawer Header */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/70 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-800 flex items-center justify-center text-white font-bold shrink-0 border border-emerald-400/30">
                  <Building2 className="w-4 h-4 text-emerald-100" />
                </div>
                <div>
                  <div className="font-bold text-xs text-white">
                    {language === "bn" ? "সামাজিক নিরাপত্তা পোর্টাল" : "SSNP Portal"}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-semibold">
                    {language === "bn" ? "নেত্রকোণা জেলা" : "Netrokona District"}
                  </div>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Officer Information Card in Drawer */}
            <div className="p-4 border-b border-slate-800 bg-slate-950/40">
              <div className="flex items-center gap-3">
                {currentUser.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={currentUser.image}
                    alt={currentUser.name}
                    className="w-10 h-10 rounded-full object-cover border-2 border-emerald-400 shrink-0"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-emerald-900 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-300 shrink-0">
                    <User className="w-5 h-5" />
                  </div>
                )}
                <div className="min-w-0">
                  <div className="font-bold text-xs text-white truncate">
                    {currentUser.name}
                  </div>
                  <div className="text-[11px] text-slate-400 truncate">
                    {currentUser.designation || currentRoleTitle}
                  </div>
                  <div className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-600/40">
                    {currentRoleTitle} {currentUser.upazilaName ? `• ${currentUser.upazilaName}` : ""}
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Navigation Links */}
            <div className="flex-1 overflow-y-auto px-3 py-4 space-y-1.5 custom-scrollbar">
              <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {language === "bn" ? "মেনু নির্বাচন" : "Navigation"}
              </div>

              {navLinks.map((item) => {
                if (!item.show) return null;
                const Icon = item.icon;
                const isActive = pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center justify-between px-3.5 py-3 rounded-xl text-xs font-semibold transition-all ${
                      isActive
                        ? "bg-emerald-700 text-white shadow-md"
                        : "text-slate-300 hover:text-white hover:bg-slate-800/80"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Icon
                        className={`w-4 h-4 shrink-0 ${
                          isActive ? "text-emerald-100" : "text-slate-400"
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                    </div>

                    {item.badge && (
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold shrink-0 ml-2 ${
                          item.badgeColor ||
                          "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Drawer Bottom Controls */}
            <div className="p-4 border-t border-slate-800 bg-slate-950/80 space-y-3">
              {/* Profile & Security Modal Button */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  setProfileModalOpen(true);
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 transition-all"
              >
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>{language === "bn" ? "প্রোফাইল ও নিরাপত্তা" : "Profile & Security"}</span>
              </button>

              {/* Logout Button */}
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  signOut({ callbackUrl: "/login" });
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-semibold text-red-200 bg-red-950/60 hover:bg-red-900/80 border border-red-800/60 transition-all"
              >
                <LogOut className="w-3.5 h-3.5 text-red-400" />
                <span>{t.common.signOut}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          4. MAIN APPLICATION CONTENT AREA (lg:pl-64)
      ========================================================================= */}
      <div className="lg:pl-64 flex flex-col flex-1 min-h-screen">
        {/* Desktop Top Micro Bar */}
        <header className="hidden lg:flex no-print bg-slate-900 border-b border-slate-800 px-6 py-2.5 items-center justify-between text-xs text-slate-300 shadow-sm sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span className="font-semibold text-slate-200">{t.common.govtTopBar}</span>
            <span className="text-slate-600">•</span>
            <span className="text-emerald-400 font-bold">
              {currentUser.upazilaName
                ? `${currentUser.upazilaName} উপজেলা প্রশাসন`
                : language === "bn"
                ? "নেত্রকোণা জেলা কেন্দ্রীয় মনিটরিং"
                : "Netrokona District Central Monitoring"}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Role Badge */}
            <div
              className={`px-3 py-1 rounded-full text-[11px] font-bold border ${
                isSuperAdmin
                  ? "bg-purple-950/80 text-purple-200 border-purple-500/60"
                  : isDeptOfficer
                  ? "bg-blue-950/80 text-blue-200 border-blue-500/60"
                  : "bg-emerald-950/80 text-emerald-200 border-emerald-500/60"
              }`}
            >
              {currentRoleTitle}
            </div>

            {/* Quick Profile Button */}
            <button
              type="button"
              onClick={() => setProfileModalOpen(true)}
              className="px-3 py-1 rounded-full text-[11px] font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all"
            >
              {language === "bn" ? "প্রোফাইল" : "Profile"}
            </button>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 w-full">{children}</main>

        {/* Global Footer */}
        <footer className="no-print border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4">
            <p className="font-medium text-slate-700">
              Integrated Social Safety Net Program (SSNP) Data Redundancy & Deduplication Management System
            </p>
            <p className="mt-1 text-slate-500">
              Local Government Division (LGD) • Upazila Administration • Role & Permission Matrix Structure
            </p>
          </div>
        </footer>
      </div>

      {/* Profile & Security Modal */}
      <UserProfileModal
        isOpen={profileModalOpen}
        onClose={() => setProfileModalOpen(false)}
      />
    </div>
  );
}
