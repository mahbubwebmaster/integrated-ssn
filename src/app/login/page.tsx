"use client";

import React, { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Lock,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Globe,
  ArrowLeft,
  Shield,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { BdGovLogo } from "@/components/BdGovLogo";

function LoginCard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { language, t } = useLanguage();

  // Mode: "login" or "forgot"
  const [view, setView] = useState<"login" | "forgot">("login");

  // Login Form States
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Forgot Password States
  const [forgotStep, setForgotStep] = useState<1 | 2 | 3>(1);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotOtp, setForgotOtp] = useState("");
  const [forgotNewPass, setForgotNewPass] = useState("");
  const [forgotConfirmPass, setForgotConfirmPass] = useState("");
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [demoOtpHint, setDemoOtpHint] = useState<string | null>(null);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [forgotError, setForgotError] = useState<string | null>(null);

  // =========================================================================
  // LOGIN SUBMIT HANDLER
  // =========================================================================
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage(t.login.errMissingFields);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);
      setSuccessMessage(null);

      const res = await signIn("credentials", {
        email: email.trim().toLowerCase(),
        password: password,
        redirect: false,
        callbackUrl,
      });

      if (res?.error) {
        setErrorMessage(t.login.errInvalid);
      } else {
        router.push(callbackUrl);
        router.refresh();
      }
    } catch (err) {
      console.error("Login failed:", err);
      setErrorMessage(t.login.errServer);
    } finally {
      setLoading(false);
    }
  };

  // Open Forgot Password View
  const handleOpenForgot = () => {
    setForgotEmail(email.trim());
    setForgotStep(1);
    setForgotError(null);
    setForgotOtp("");
    setForgotNewPass("");
    setForgotConfirmPass("");
    setDemoOtpHint(null);
    setView("forgot");
  };

  // Return to Login View
  const handleBackToLogin = () => {
    setForgotError(null);
    setView("login");
  };

  // =========================================================================
  // FORGOT PASSWORD: STEP 1 (REQUEST OTP)
  // =========================================================================
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = forgotEmail.trim().toLowerCase();
    if (!targetEmail) {
      setForgotError(language === "bn" ? "দয়া করে আপনার নিবন্ধিত ইমেইল ঠিকানা দিন।" : "Please enter your registered email address.");
      return;
    }

    try {
      setForgotLoading(true);
      setForgotError(null);

      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "request_otp",
          email: targetEmail,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setForgotError(data.error || (language === "bn" ? "ওটিপি পাঠাতে সমস্যা হয়েছে।" : "Failed to send OTP code."));
        return;
      }

      setResetToken(data.resetToken);
      if (data.demoOtp) {
        setDemoOtpHint(data.demoOtp);
      }
      setForgotStep(2);
    } catch (err) {
      console.error("Request OTP error:", err);
      setForgotError(language === "bn" ? "সার্ভারে যোগাযোগ করতে ব্যর্থ হয়েছে।" : "Network connection failed.");
    } finally {
      setForgotLoading(false);
    }
  };

  // =========================================================================
  // FORGOT PASSWORD: STEP 2 (RESET PASSWORD)
  // =========================================================================
  const handleResetPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotOtp.trim()) {
      setForgotError(language === "bn" ? "৬-সংখ্যার যাচাইকরণ কোড (OTP) প্রদান করুন।" : "Please enter the 6-digit OTP code.");
      return;
    }
    if (!forgotNewPass || forgotNewPass.length < 6) {
      setForgotError(language === "bn" ? "নতুন পাসওয়ার্ড ন্যূনতম ৬ অক্ষরের হতে হবে।" : "New password must be at least 6 characters.");
      return;
    }
    if (forgotNewPass !== forgotConfirmPass) {
      setForgotError(t.login.passMismatch || (language === "bn" ? "নতুন পাসওয়ার্ড এবং নিশ্চিতকরণ পাসওয়ার্ড মিলছে না।" : "Passwords do not match."));
      return;
    }

    try {
      setForgotLoading(true);
      setForgotError(null);

      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reset_password",
          resetToken,
          otp: forgotOtp.trim(),
          newPassword: forgotNewPass,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setForgotError(data.error || (language === "bn" ? "পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।" : "Failed to reset password."));
        return;
      }

      // Pre-populate login email with this verified email
      setEmail(forgotEmail.trim());
      setPassword("");
      setForgotStep(3);
    } catch (err) {
      console.error("Reset password error:", err);
      setForgotError(language === "bn" ? "সার্ভারে যোগাযোগ করতে ব্যর্থ হয়েছে।" : "Network connection failed.");
    } finally {
      setForgotLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-2xl sm:rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200/80 transition-all">
      {/* =======================================================================
          VIEW 1: CLEAN OFFICIAL LOGIN FORM
      ======================================================================= */}
      {view === "login" && (
        <div className="space-y-4 sm:space-y-5">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <Lock className="w-4 h-4 text-emerald-700" />
              {t.login.loginBoxTitle}
            </h2>
            <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
              {t.login.loginBoxSub}
            </p>
          </div>

          {/* Success Alert */}
          {successMessage && (
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2 shadow-xs">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <div className="font-semibold">{successMessage}</div>
            </div>
          )}

          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2 shadow-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="font-semibold">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleLoginSubmit} className="space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                {t.login.labelEmail}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="officer@netrokona.gov.bd"
                  className="w-full h-10 pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white shadow-2xs transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                {t.login.labelPassword}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-10 pl-9 pr-10 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white shadow-2xs transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600"
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Forgot Password Link Row */}
            <div className="flex items-center justify-between pt-0.5">
              <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-slate-500 font-medium">
                <Shield className="w-3.5 h-3.5 text-emerald-600" />
                <span>{language === "bn" ? "নিরাপদ এনক্রিপশন" : "256-bit Secure"}</span>
              </div>
              <button
                type="button"
                onClick={handleOpenForgot}
                className="text-xs font-bold text-emerald-700 hover:text-emerald-900 hover:underline transition-colors cursor-pointer flex items-center gap-1 py-0.5"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>{t.login.forgotPassword || "পাসওয়ার্ড ভুলে গেছেন?"}</span>
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-10 sm:h-11 py-2 px-4 rounded-xl bg-gradient-to-r from-emerald-800 to-teal-900 hover:from-emerald-900 hover:to-teal-950 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer mt-1"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t.login.authenticating}
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4" />
                  {t.login.btnSignIn}
                </>
              )}
            </button>
          </form>

          {/* Clean Government Trust Footer Note */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] sm:text-[11px] text-slate-400 text-center font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span>
              {language === "bn"
                ? "জেলা প্রশাসন, নেত্রকোণা • কর্মকর্তা সেন্ট্রাল অথেনটিকেশন"
                : "District Administration, Netrokona • Officer Central Auth"}
            </span>
          </div>
        </div>
      )}

      {/* =======================================================================
          VIEW 2: FORGOT PASSWORD (EMAIL RECOVERY FLOW)
      ======================================================================= */}
      {view === "forgot" && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-700" />
                {t.login.forgotPasswordModalTitle || "পাসওয়ার্ড পুনরুদ্ধার"}
              </h2>
              <p className="text-[11px] sm:text-xs text-slate-500 mt-0.5">
                {t.login.forgotPasswordModalSub || "আপনার নিবন্ধিত ইমেইলের মাধ্যমে নতুন পাসওয়ার্ড সেট করুন"}
              </p>
            </div>
            <button
              type="button"
              onClick={handleBackToLogin}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
              title={t.login.backToLogin || "লগইনে ফিরে যান"}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
          </div>

          {/* Error Alert */}
          {forgotError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2 shadow-xs">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="font-semibold">{forgotError}</div>
            </div>
          )}

          {/* STEP 1: ENTER REGISTERED EMAIL */}
          {forgotStep === 1 && (
            <form onSubmit={handleRequestOtp} className="space-y-3.5">
              <div className="p-3 bg-emerald-50/60 rounded-xl border border-emerald-100 text-[11px] text-emerald-900 leading-relaxed">
                {language === "bn"
                  ? "আপনার পোর্টাল ইউজার অ্যাকাউন্টে নিবন্ধিত সরকারি ইমেইল ঠিকানাটি নিচে লিখুন। একটি ৬-সংখ্যার যাচাইকরণ কোড পাঠানো হবে।"
                  : "Enter your registered official email address. A 6-digit verification code will be dispatched."}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  {t.login.labelEmail}
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="email"
                    required
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    placeholder="officer@netrokona.gov.bd"
                    className="w-full h-10 pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white shadow-2xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full h-10 py-2 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {forgotLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.login.sendingOtp || "কোড পাঠানো হচ্ছে..."}
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    {t.login.btnSendOtp || "যাচাইকরণ কোড পাঠান"}
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 2: ENTER OTP & NEW PASSWORD */}
          {forgotStep === 2 && (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-3.5">
              <div className="p-2.5 bg-blue-50/80 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5 text-xs">
                  <Mail className="w-3.5 h-3.5 text-blue-600" />
                  <span className="truncate">{forgotEmail}</span>
                </div>
                <div className="text-[10px] text-blue-700">
                  {t.login.otpSentNotice || "এই ইমেইল ঠিকানায় ৬-সংখ্যার যাচাইকরণ কোড পাঠানো হয়েছে (মেয়াদ ১৫ মিনিট)।"}
                </div>
              </div>

              {/* Demo OTP Helper Pill */}
              {demoOtpHint && (
                <div className="p-2 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center justify-between">
                  <span className="font-semibold text-[10px] flex items-center gap-1">
                    <KeyRound className="w-3.5 h-3.5 text-amber-700" />
                    {language === "bn" ? "টেস্ট ওটিপি কোড:" : "Testing OTP Code:"}
                  </span>
                  <span className="font-mono font-black text-xs tracking-widest text-amber-950 bg-amber-200/80 px-2 py-0.5 rounded">
                    {demoOtpHint}
                  </span>
                </div>
              )}

              {/* 6-digit OTP Input */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  {t.login.enterOtpLabel || "৬-সংখ্যার যাচাইকরণ কোড (OTP)"}
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  inputMode="numeric"
                  value={forgotOtp}
                  onChange={(e) => setForgotOtp(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full h-10 text-center tracking-widest font-mono text-base font-black py-1.5 rounded-xl border border-slate-300 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white shadow-2xs"
                />
              </div>

              {/* New Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  {t.login.newPasswordLabel || "নতুন পাসওয়ার্ড"}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showForgotPass ? "text" : "password"}
                    required
                    minLength={6}
                    value={forgotNewPass}
                    onChange={(e) => setForgotNewPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 pl-9 pr-9 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowForgotPass(!showForgotPass)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-slate-600"
                    aria-label="Toggle password visibility"
                  >
                    {showForgotPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1 uppercase tracking-wider">
                  {t.login.confirmPasswordLabel || "নতুন পাসওয়ার্ড নিশ্চিত করুন"}
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type={showForgotPass ? "text" : "password"}
                    required
                    minLength={6}
                    value={forgotConfirmPass}
                    onChange={(e) => setForgotConfirmPass(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-10 pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white shadow-2xs"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={forgotLoading}
                className="w-full h-10 py-2 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {forgotLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t.login.resettingPassword || "পাসওয়ার্ড আপডেট হচ্ছে..."}
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    {t.login.btnResetPassword || "পাসওয়ার্ড পরিবর্তন ও নিশ্চিত করুন"}
                  </>
                )}
              </button>
            </form>
          )}

          {/* STEP 3: SUCCESS CONFIRMATION */}
          {forgotStep === 3 && (
            <div className="text-center py-3 space-y-3">
              <div className="w-11 h-11 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto shadow-inner">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  {language === "bn" ? "পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে!" : "Password Successfully Reset!"}
                </h3>
                <p className="text-xs text-slate-600">
                  {language === "bn"
                    ? "আপনার নতুন পাসওয়ার্ড দিয়ে এখন পোর্টালে লগইন করতে পারবেন।"
                    : "You can now sign in to the portal using your new credentials."}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setSuccessMessage(t.login.passwordResetSuccess || (language === "bn" ? "পাসওয়ার্ড সফলভাবে পরিবর্তিত হয়েছে! নতুন পাসওয়ার্ড দিয়ে প্রবেশ করুন।" : "Password reset successfully! Please sign in."));
                  handleBackToLogin();
                }}
                className="w-full h-10 py-2 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white text-xs sm:text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{language === "bn" ? "লগইন স্ক্রিনে যান" : "Go to Login"}</span>
              </button>
            </div>
          )}

          {/* Back to Login Footer */}
          {forgotStep !== 3 && (
            <div className="pt-1 text-center">
              <button
                type="button"
                onClick={handleBackToLogin}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>{t.login.backToLogin || "লগইনে ফিরে যান"}</span>
              </button>
            </div>
          )}

          {/* Clean Government Trust Footer Note */}
          <div className="pt-2.5 border-t border-slate-100 flex items-center justify-center gap-2 text-[10px] sm:text-[11px] text-slate-400 text-center font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0"></span>
            <span>
              {language === "bn"
                ? "জেলা প্রশাসন, নেত্রকোণা • কর্মকর্তা সেন্ট্রাল অথেনটিকেশন"
                : "District Administration, Netrokona • Officer Central Auth"}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="h-screen max-h-screen overflow-y-auto lg:overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center items-center px-4 py-3 sm:px-6 relative select-none">
      {/* Top Floating Language Switcher */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20">
        <div className="inline-flex items-center rounded-xl bg-slate-800/80 border border-slate-700/80 p-0.5 text-xs shadow-lg backdrop-blur-md">
          <Globe className="w-3.5 h-3.5 text-emerald-400 ml-2 mr-1" />
          <button
            type="button"
            onClick={() => setLanguage("bn")}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              language === "bn"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-300 hover:text-white"
            }`}
          >
            বাংলা
          </button>
          <button
            type="button"
            onClick={() => setLanguage("en")}
            className={`px-2.5 py-1 rounded-lg font-bold text-xs transition-all cursor-pointer ${
              language === "en"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-300 hover:text-white"
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Header with Official Logo */}
      <div className="text-center max-w-xl w-full mb-3 sm:mb-4">
        <div className="flex justify-center mb-2">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 backdrop-blur-md p-1 flex items-center justify-center shadow-2xl border border-white/20 hover:scale-105 transition-transform">
            <BdGovLogo className="w-full h-full" />
          </div>
        </div>
        <h1 className="text-xl sm:text-2xl md:text-[26px] font-black text-white tracking-tight leading-tight">
          {t.login.portalTitle}
        </h1>
        <p className="text-sm sm:text-base text-emerald-300 font-bold mt-1.5">
          {t.login.portalSubtitle}
        </p>
      </div>

      <Suspense
        fallback={
          <div className="max-w-md w-full bg-white p-6 rounded-2xl text-center space-y-2">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-700 mx-auto" />
            <p className="text-xs text-slate-500">{t.common.loading}</p>
          </div>
        }
      >
        <LoginCard />
      </Suspense>

      <div className="text-center text-[10px] sm:text-[11px] text-slate-400 mt-3 max-w-sm">
        {t.login.securityNotice}
      </div>
    </div>
  );
}
