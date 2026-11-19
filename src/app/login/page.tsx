"use client";

import React, { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  Lock,
  Mail,
  ShieldCheck,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  KeyRound,
  Globe,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const { language, t } = useLanguage();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setErrorMessage(t.login.errMissingFields);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage(null);

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

  const handleQuickFill = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setErrorMessage(null);
  };

  return (
    <div className="max-w-md w-full bg-white/95 backdrop-blur-md rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/80 space-y-6">
      <div>
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
          <Lock className="w-4 h-4 text-emerald-700" />
          {t.login.loginBoxTitle}
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          {t.login.loginBoxSub}
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2.5 shadow-xs">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
          <div className="font-semibold">{errorMessage}</div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            {t.login.labelEmail}
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="officer@upazila.gov.bd"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wider">
            {t.login.labelPassword}
          </label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3.5" />
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-slate-300 text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl bg-emerald-800 hover:bg-emerald-900 disabled:opacity-50 text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-2 mt-2"
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

      {/* Quick Demo Persona Credentials */}
      <div className="pt-4 border-t border-slate-100 space-y-2">
        <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
          <KeyRound className="w-3.5 h-3.5 text-emerald-700" />
          {t.login.quickDemoTitle}
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            type="button"
            onClick={() => handleQuickFill("admin@upazila.gov.bd", "admin123")}
            className="p-2.5 text-left rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100 transition-colors"
          >
            <div className="font-bold text-purple-900 text-[11px]">{t.login.btnDemoSuperAdmin}</div>
            <div className="text-[10px] text-purple-700">admin@upazila.gov.bd</div>
            <div className="text-[9px] text-purple-600 font-mono mt-0.5">Role: SUPER_ADMIN</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickFill("dss@upazila.gov.bd", "admin123")}
            className="p-2.5 text-left rounded-xl border border-blue-200 bg-blue-50/70 hover:bg-blue-100 transition-colors"
          >
            <div className="font-bold text-blue-900 text-[11px]">{t.login.btnDemoDss}</div>
            <div className="text-[10px] text-blue-700">dss@upazila.gov.bd</div>
            <div className="text-[9px] text-blue-600 font-mono mt-0.5">Role: DEPT_OFFICER</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickFill("dwa@upazila.gov.bd", "admin123")}
            className="p-2.5 text-left rounded-xl border border-pink-200 bg-pink-50/70 hover:bg-pink-100 transition-colors"
          >
            <div className="font-bold text-pink-900 text-[11px]">{t.login.btnDemoDwa}</div>
            <div className="text-[10px] text-pink-700">dwa@upazila.gov.bd</div>
            <div className="text-[9px] text-pink-600 font-mono mt-0.5">Role: DEPT_OFFICER</div>
          </button>

          <button
            type="button"
            onClick={() => handleQuickFill("bahadurpur@upazila.gov.bd", "admin123")}
            className="p-2.5 text-left rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100 transition-colors"
          >
            <div className="font-bold text-emerald-900 text-[11px]">{t.login.btnDemoUnion}</div>
            <div className="text-[10px] text-emerald-700">bahadurpur@upazila.gov.bd</div>
            <div className="text-[9px] text-emerald-600 font-mono mt-0.5">Role: UNION_VIEWER</div>
          </button>
        </div>
        <p className="text-[10px] text-slate-400 text-center pt-1">
          {t.login.defaultPass} <code className="font-mono font-bold text-slate-600">admin123</code>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  const { language, setLanguage, t } = useLanguage();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 flex flex-col justify-center items-center p-4 sm:p-6 lg:p-8 relative">
      {/* Top Floating Language Switcher */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <div className="inline-flex items-center rounded-xl bg-slate-800/80 border border-slate-700/80 p-1 text-xs shadow-lg backdrop-blur-md">
          <Globe className="w-3.5 h-3.5 text-emerald-400 ml-2 mr-1" />
          <button
            type="button"
            onClick={() => setLanguage("bn")}
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
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
            className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
              language === "en"
                ? "bg-emerald-600 text-white shadow-xs"
                : "text-slate-300 hover:text-white"
            }`}
          >
            English
          </button>
        </div>
      </div>

      {/* Bangladesh Govt Official Header Badge */}
      <div className="text-center max-w-md w-full mb-6 space-y-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-900/60 border border-emerald-500/40 text-emerald-300 text-xs font-semibold shadow-inner">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          {t.login.govtBadge}
        </div>
        <div className="flex justify-center my-3">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-600 to-teal-500 text-white flex items-center justify-center shadow-lg border border-emerald-300/30">
            <Building2 className="w-8 h-8 text-white" />
          </div>
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">
          {t.login.portalTitle}
        </h1>
        <p className="text-xs text-slate-300 font-medium">
          {t.login.portalSubtitle}
        </p>
      </div>

      <Suspense
        fallback={
          <div className="max-w-md w-full bg-white p-8 rounded-3xl text-center space-y-3">
            <Loader2 className="w-8 h-8 animate-spin text-emerald-700 mx-auto" />
            <p className="text-xs text-slate-500">{t.common.loading}</p>
          </div>
        }
      >
        <LoginForm />
      </Suspense>

      <div className="text-center text-[11px] text-slate-400 mt-6 max-w-sm">
        {t.login.securityNotice}
      </div>
    </div>
  );
}
