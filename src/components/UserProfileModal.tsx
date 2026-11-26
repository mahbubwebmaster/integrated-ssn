"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  User,
  Camera,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Shield,
  Phone,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  X,
  UploadCloud,
  Check,
  Send,
  Building2,
  MapPin,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function UserProfileModal({ isOpen, onClose }: UserProfileModalProps) {
  const { currentUser, updateUserProfile } = useAuth();
  const { language, t, getDepartmentName } = useLanguage();

  const [activeTab, setActiveTab] = useState<"profile" | "verification" | "password">("profile");

  // Profile Form States
  const [name, setName] = useState(currentUser.name || "");
  const [designation, setDesignation] = useState(currentUser.designation || "");
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(currentUser.image || null);
  const [savingProfile, setSavingProfile] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Verification Form States
  const [phone, setPhone] = useState(currentUser.phone || "");
  const [phoneVerified, setPhoneVerified] = useState(Boolean(currentUser.phoneVerified));
  const [emailVerified, setEmailVerified] = useState(Boolean(currentUser.isEmailVerified));
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);
  const [verifyingPhone, setVerifyingPhone] = useState(false);
  const [verifyingEmail, setVerifyingEmail] = useState(false);

  // Password Form States
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // Feedback Notifications
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName(currentUser.name || "");
      setDesignation(currentUser.designation || "");
      setPhotoDataUrl(currentUser.image || null);
      setPhone(currentUser.phone || "");
      setPhoneVerified(Boolean(currentUser.phoneVerified));
      setEmailVerified(Boolean(currentUser.isEmailVerified));
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const showSuccess = (msg: string) => {
    setSuccessNotice(msg);
    setErrorNotice(null);
    setTimeout(() => setSuccessNotice(null), 5000);
  };

  const showError = (msg: string) => {
    setErrorNotice(msg);
    setSuccessNotice(null);
    setTimeout(() => setErrorNotice(null), 5000);
  };

  // Handle Photo Upload with client-side 256x256 JPEG compression (~15-25 KB)
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showError(language === "bn" ? "ছবির সাইজ সর্বোচ্চ ৫ মেগাবাইট হতে হবে।" : "Photo must be less than 5MB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const rawDataUrl = evt.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const MAX_DIM = 256;
        let { width, height } = img;
        if (width > MAX_DIM || height > MAX_DIM) {
          if (width > height) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          } else {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL("image/jpeg", 0.8);
          setPhotoDataUrl(compressed);
        } else {
          setPhotoDataUrl(rawDataUrl);
        }
      };
      img.onerror = () => setPhotoDataUrl(rawDataUrl);
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  // 1. Submit Profile Update
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setSavingProfile(true);
      setErrorNotice(null);

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          action: "update_profile",
          name: name.trim(),
          designation: designation.trim() || null,
          phone: phone.trim() || null,
          image: photoDataUrl,
        }),
      });

      const data = await res.json();
      if (data.success) {
        updateUserProfile({
          name: name.trim(),
          designation: designation.trim() || null,
          image: photoDataUrl,
          phone: phone.trim() || null,
        });
        showSuccess(t.profile.updateSuccess);
      } else {
        showError(data.error || t.common.error);
      }
    } catch (err) {
      console.error(err);
      showError(t.common.error);
    } finally {
      setSavingProfile(false);
    }
  };

  // 2. Send Mobile OTP (Simulation)
  const handleSendMobileOtp = () => {
    if (!phone || phone.trim().length < 11) {
      showError(
        language === "bn"
          ? "সঠিক ১১ ডিজিটের মোবাইল নম্বর প্রদান করুন।"
          : "Please enter a valid 11-digit mobile number."
      );
      return;
    }

    // Generate 4-digit code
    const generated = "1234";
    setDemoOtpHint(generated);
    setOtpSent(true);
    showSuccess(
      language === "bn"
        ? `আপনার নম্বরে (${phone}) ওটিপি কোড পাঠানো হয়েছে: ${generated}`
        : `OTP code sent to (${phone}): ${generated}`
    );
  };

  // Verify Mobile with OTP
  const handleVerifyPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode) return;

    try {
      setVerifyingPhone(true);
      setErrorNotice(null);

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          action: "verify_phone",
          phone: phone.trim(),
          otp: otpCode.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setPhoneVerified(true);
        setOtpSent(false);
        setOtpCode("");
        setDemoOtpHint(null);
        updateUserProfile({ phone: phone.trim(), phoneVerified: true });
        showSuccess(t.profile.phoneVerifySuccess);
      } else {
        showError(data.error || (language === "bn" ? "ভুল ওটিপি কোড।" : "Invalid OTP code."));
      }
    } catch (err) {
      console.error(err);
      showError(t.common.error);
    } finally {
      setVerifyingPhone(false);
    }
  };

  // Verify Email
  const handleVerifyEmail = async () => {
    try {
      setVerifyingEmail(true);
      setErrorNotice(null);

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          action: "verify_email",
        }),
      });

      const data = await res.json();
      if (data.success) {
        setEmailVerified(true);
        updateUserProfile({ isEmailVerified: true });
        showSuccess(t.profile.emailVerifySuccess);
      } else {
        showError(data.error || t.common.error);
      }
    } catch (err) {
      console.error(err);
      showError(t.common.error);
    } finally {
      setVerifyingEmail(false);
    }
  };

  // 3. Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword || !newPassword) return;

    if (newPassword.length < 6) {
      showError(t.profile.passLengthErr);
      return;
    }

    if (newPassword !== confirmPassword) {
      showError(t.profile.passMismatch);
      return;
    }

    try {
      setSavingPassword(true);
      setErrorNotice(null);

      const res = await fetch("/api/auth/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUser.id,
          action: "change_password",
          currentPassword,
          newPassword,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        showSuccess(t.profile.passSuccess);
      } else {
        showError(data.error || (language === "bn" ? "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।" : "Password change failed."));
      }
    } catch (err) {
      console.error(err);
      showError(t.common.error);
    } finally {
      setSavingPassword(false);
    }
  };

  const roleTitle =
    language === "bn"
      ? (t.roles[currentUser.role as keyof typeof t.roles] || currentUser.roleTitleBn || currentUser.role)
      : (currentUser.roleTitleEn || currentUser.role);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-3 sm:p-4">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-[95vw] shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header Card */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 p-4 sm:p-6 text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-3 top-3 text-slate-400 hover:text-white p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-full hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            {/* Avatar with click to upload */}
            <div className="relative group shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 border-2 border-emerald-300/40 overflow-hidden flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                {photoDataUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoDataUrl}
                    alt={currentUser.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{currentUser.name ? currentUser.name.charAt(0) : "U"}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-transform group-hover:scale-110"
                title={t.profile.changePhoto}
              >
                <Camera className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Officer Name & Badges */}
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-900/60 border border-emerald-500/40 text-[11px] font-bold text-emerald-300">
                  <Shield className="w-3 h-3" />
                  <span>{roleTitle}</span>
                </span>
                {currentUser.designation && (
                  <span className="px-2.5 py-0.5 rounded-full bg-indigo-900/60 border border-indigo-500/40 text-[11px] font-bold text-indigo-300">
                    {currentUser.designation}
                  </span>
                )}
              </div>
              <h2 className="text-xl font-black text-white tracking-tight">{currentUser.name}</h2>
              <p className="text-xs text-slate-300 font-mono">{currentUser.email}</p>
            </div>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png, image/jpeg, image/webp"
            className="hidden"
            onChange={handlePhotoSelect}
          />
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2 text-xs font-bold">
          <button
            type="button"
            onClick={() => setActiveTab("profile")}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "profile"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <User className="w-4 h-4" />
            <span>{t.profile.tabProfile}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("verification")}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "verification"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{t.profile.tabVerification}</span>
            {(!phoneVerified || !emailVerified) && (
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("password")}
            className={`pb-3 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === "password"
                ? "border-emerald-600 text-emerald-800"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            <KeyRound className="w-4 h-4" />
            <span>{t.profile.tabPassword}</span>
          </button>
        </div>

        {/* Notice Banners */}
        <div className="px-6 pt-4">
          {successNotice && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{successNotice}</span>
            </div>
          )}

          {errorNotice && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-900 text-xs font-semibold flex items-center gap-2 shadow-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
              <span>{errorNotice}</span>
            </div>
          )}
        </div>

        {/* Tab Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1 text-xs">
          {/* TAB 1: Profile & Photo */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Photo Upload Zone */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 overflow-hidden flex items-center justify-center font-bold text-slate-400 text-lg shadow-inner">
                    {photoDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={photoDataUrl} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-6 h-6 text-slate-400" />
                    )}
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{t.profile.changePhoto}</div>
                    <div className="text-[11px] text-slate-500">{t.profile.uploadPhotoNotice}</div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-semibold text-xs shadow-xs"
                  >
                    {t.profile.changePhoto}
                  </button>
                  {photoDataUrl && (
                    <button
                      type="button"
                      onClick={() => setPhotoDataUrl(null)}
                      className="p-1.5 rounded-xl border border-red-200 text-red-600 hover:bg-red-50"
                      title={t.profile.removePhoto}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Officer Full Name */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[11px]">
                  {t.profile.name} *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Designation / পদবি */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[11px]">
                  {language === "bn" ? "পদবি" : "Designation"} *
                </label>
                <input
                  type="text"
                  required
                  value={designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder={language === "bn" ? "যেমন: উপজেলা নির্বাহী অফিসার, জেলা প্রশাসক, ডিজি ইত্যাদি" : "e.g. UNO, DC, DG"}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              {/* Official Email (Read-Only) */}
              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[11px]">
                  {t.profile.email}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    disabled
                    value={currentUser.email}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-slate-600 font-mono text-xs cursor-not-allowed"
                  />
                  {emailVerified ? (
                    <span className="shrink-0 px-2.5 py-1 rounded-lg bg-emerald-100 text-emerald-800 font-bold text-[10px] flex items-center gap-1 border border-emerald-200">
                      <Check className="w-3 h-3" /> {t.profile.verified}
                    </span>
                  ) : (
                    <span className="shrink-0 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-800 font-bold text-[10px] border border-amber-200">
                      {t.profile.notVerified}
                    </span>
                  )}
                </div>
              </div>

              {/* Department or Union info */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">{t.profile.role}</span>
                  <div className="font-bold text-slate-900 text-xs mt-0.5">{roleTitle}</div>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-500 uppercase">
                    {currentUser.role.includes("DEPT")
                      ? t.profile.department
                      : currentUser.role === "UNION_VIEWER"
                      ? t.profile.union
                      : (language === "bn" ? "সার্বিক অধিক্ষেত্র" : "Jurisdiction")}
                  </span>
                  <div className="font-bold text-slate-900 text-xs mt-0.5">
                    {getDepartmentName({ name: currentUser.departmentName, nameBn: currentUser.departmentNameBn, nameEn: currentUser.departmentNameEn }, language) || currentUser.unionName || (language === "bn" ? "সমগ্র উপজেলা" : "Entire Upazila")}
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all"
                >
                  {savingProfile && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t.profile.saveChanges}
                </button>
              </div>
            </form>
          )}

          {/* TAB 2: Verification (Mobile & Email) */}
          {activeTab === "verification" && (
            <div className="space-y-6">
              {/* Mobile Verification Block */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-slate-900 text-sm">{t.profile.mobile}</span>
                  </div>
                  {phoneVerified ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                      <Check className="w-3 h-3 text-emerald-700" />
                      {t.profile.verified}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                      {t.profile.notVerified}
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="017XXXXXXXX"
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value);
                      setPhoneVerified(false);
                    }}
                    className="flex-1 px-3.5 py-2 rounded-xl border border-slate-300 bg-white font-mono text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  {!phoneVerified && (
                    <button
                      type="button"
                      onClick={handleSendMobileOtp}
                      className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs transition-all shadow-xs shrink-0"
                    >
                      <Send className="w-3 h-3" />
                      {t.profile.sendOtp}
                    </button>
                  )}
                </div>

                {/* OTP input section if sent */}
                {otpSent && !phoneVerified && (
                  <form onSubmit={handleVerifyPhone} className="p-3 bg-emerald-50/80 rounded-xl border border-emerald-200 space-y-2 mt-2">
                    <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-900">
                      <span>{t.profile.enterOtp}</span>
                      {demoOtpHint && (
                        <span className="text-[10px] text-emerald-700 font-mono">
                          (ডেমো কোড: {demoOtpHint})
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        maxLength={6}
                        required
                        placeholder="1234"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        className="w-36 px-3 py-2 rounded-xl border border-emerald-300 bg-white font-mono font-bold text-center text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 tracking-widest"
                      />
                      <button
                        type="submit"
                        disabled={verifyingPhone}
                        className="px-4 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-xs"
                      >
                        {verifyingPhone ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : t.profile.verifyNow}
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Email Verification Block */}
              <div className="p-4 rounded-2xl border border-slate-200 bg-slate-50/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-emerald-700" />
                    <span className="font-bold text-slate-900 text-sm">{t.profile.email}</span>
                  </div>
                  {emailVerified ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-300">
                      <Check className="w-3 h-3 text-emerald-700" />
                      {t.profile.verified}
                    </span>
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold border border-amber-300">
                      {t.profile.notVerified}
                    </span>
                  )}
                </div>

                <div className="flex items-center justify-between gap-3 p-3 bg-white rounded-xl border border-slate-200">
                  <span className="font-mono text-slate-800 text-xs font-semibold">{currentUser.email}</span>
                  {!emailVerified ? (
                    <button
                      type="button"
                      disabled={verifyingEmail}
                      onClick={handleVerifyEmail}
                      className="px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-bold text-[11px] shadow-xs transition-all"
                    >
                      {verifyingEmail ? <Loader2 className="w-3 h-3 animate-spin" /> : t.profile.verifyEmailBtn}
                    </button>
                  ) : (
                    <span className="text-[11px] text-emerald-700 font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> {language === "bn" ? "সুরক্ষিত ও সত্যায়িত" : "Secured & Verified"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: Change Password */}
          {activeTab === "password" && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[11px]">
                  {t.profile.currentPassword} *
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPass ? "text" : "password"}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono text-xs pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPass(!showCurrentPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrentPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[11px]">
                  {t.profile.newPassword} *
                </label>
                <div className="relative">
                  <input
                    type={showNewPass ? "text" : "password"}
                    required
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono text-xs pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPass(!showNewPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[10px] text-slate-400 mt-0.5">{t.profile.passLengthErr}</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1 uppercase tracking-wider text-[11px]">
                  {t.profile.confirmPassword} *
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPass ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono text-xs pr-10 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPass(!showConfirmPass)}
                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={savingPassword}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all"
                >
                  {savingPassword && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {t.profile.tabPassword}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
