"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import {
  Language,
  translations,
  formatNumber as formatNumHelper,
  formatCurrency as formatCurrHelper,
  getDepartmentName as getDeptHelper,
  getSchemeName as getSchemeHelper,
  getCommodityName as getCommHelper,
  getCommodityUnit as getUnitHelper,
} from "@/lib/translations";

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  t: typeof translations.bn;
  formatNumber: (value: number | string | null | undefined, overrideLang?: Language) => string;
  formatCurrency: (amount: number | null | undefined, overrideLang?: Language) => string;
  getDepartmentName: (dept: any, overrideLang?: Language) => string;
  getSchemeName: (scheme: any, overrideLang?: Language) => string;
  getCommodityName: (scheme: any, overrideLang?: Language) => string;
  getCommodityUnit: (scheme: any, overrideLang?: Language) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("bn");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("ssnp_lang") as Language;
      if (saved === "bn" || saved === "en") {
        setLanguageState(saved);
      }
    } catch (e) {
      // localStorage may not be available in private mode or SSR
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("ssnp_lang", lang);
    } catch (e) {}
  };

  const toggleLanguage = () => {
    const nextLang = language === "bn" ? "en" : "bn";
    setLanguage(nextLang);
  };

  const t = translations[language];

  const formatNumber = (value: number | string | null | undefined, overrideLang?: Language) => {
    return formatNumHelper(value, overrideLang || language);
  };

  const formatCurrency = (amount: number | null | undefined, overrideLang?: Language) => {
    return formatCurrHelper(amount, overrideLang || language);
  };

  const getDepartmentName = (dept: any, overrideLang?: Language) => {
    return getDeptHelper(dept, overrideLang || language);
  };

  const getSchemeName = (scheme: any, overrideLang?: Language) => {
    return getSchemeHelper(scheme, overrideLang || language);
  };

  const getCommodityName = (scheme: any, overrideLang?: Language) => {
    return getCommHelper(scheme, overrideLang || language);
  };

  const getCommodityUnit = (scheme: any, overrideLang?: Language) => {
    return getUnitHelper(scheme, overrideLang || language);
  };

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        toggleLanguage,
        t,
        formatNumber,
        formatCurrency,
        getDepartmentName,
        getSchemeName,
        getCommodityName,
        getCommodityUnit,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
