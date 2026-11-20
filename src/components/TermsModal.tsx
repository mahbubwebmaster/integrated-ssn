"use client";

import React from "react";
import { X, ShieldCheck, FileText, Lock, Building2 } from "lucide-react";
import { BdGovLogo } from "@/components/BdGovLogo";

interface TermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  language: "bn" | "en";
}

export function TermsModal({ isOpen, onClose, language }: TermsModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-slate-100 bg-slate-50/80">
          <div className="flex items-center gap-3">
            <BdGovLogo className="w-8 h-8" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span>
                  {language === "bn"
                    ? "ব্যবহারের শর্তাবলী ও নীতিমালা (Terms and Conditions)"
                    : "Terms and Conditions"}
                </span>
              </h2>
              <p className="text-xs text-slate-500">
                {language === "bn"
                  ? "সমন্বিত সামাজিক নিরাপত্তা ডাটাবেস ও অডিট পোর্টাল"
                  : "Integrated Social Safety Net Data & Audit Portal"}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs sm:text-sm text-slate-700 leading-relaxed custom-scrollbar">
          {/* Section 1 */}
          <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-100 space-y-1.5">
            <div className="font-bold text-emerald-950 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>
                {language === "bn"
                  ? "১. অনুমোদিত প্রবেশাধিকার ও নিরাপত্তা"
                  : "1. Authorized Access & Security"}
              </span>
            </div>
            <p className="text-xs text-emerald-900 leading-relaxed">
              {language === "bn"
                ? "এই পোর্টালটি শুধুমাত্র গণপ্রজাতন্ত্রী বাংলাদেশ সরকারের অনুমোদিত জেলা ও উপজেলা প্রশাসনিক কর্মকর্তা এবং নির্ধারিত লাইন দপ্তরের কর্মকর্তাদের দাপ্তরিক দায়িত্ব পালনের জন্য সংরক্ষিত। অননুমোদিত প্রবেশ, পাসওয়ার্ড আদান-প্রদান বা সিস্টেমের অপব্যবহার দেশের সাইবার নিরাপত্তা আইন ও সরকারি কর্মচারী আচরণবিধি অনুযায়ী আইনত দণ্ডনীয়।"
                : "This portal is strictly restricted to authorized administrative officers and line-department personnel of the Government of the People's Republic of Bangladesh. Unauthorized access or credential sharing is strictly prohibited under applicable cyber laws."}
            </p>
          </div>

          {/* Section 2 */}
          <div className="space-y-1.5">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-slate-700 shrink-0" />
              <span>
                {language === "bn"
                  ? "২. তথ্যের গোপনীয়তা ও সুবিধাভোগী ডাটা সংরক্ষণ"
                  : "2. Data Privacy & Beneficiary Confidentiality"}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === "bn"
                ? "সামাজিক নিরাপত্তা কর্মসূচির আওতায় সংগৃহীত সকল নাগরিকের জাতীয় পরিচয়পত্র (NID), মোবাইল ব্যাংকিং ও পারিবারিক তথ্য সম্পূর্ণ রাষ্ট্রীয় গোপনীয়তার আওতাভুক্ত। কোনো অবস্থাতেই অনুমতি ছাড়া এই ডাটা প্রকাশ বা বাণিজ্যিক উদ্দেশ্যে ব্যবহার করা যাবে না।"
                : "All citizen beneficiary records, National ID (NID) data, and payment information processed through this system are confidential. Data must not be disclosed or distributed to third parties."}
            </p>
          </div>

          {/* Section 3 */}
          <div className="space-y-1.5">
            <div className="font-bold text-slate-900 flex items-center gap-1.5">
              <Building2 className="w-4 h-4 text-slate-700 shrink-0" />
              <span>
                {language === "bn"
                  ? "৩. অডিট ট্রেইল ও স্বয়ংক্রিয় নজরদারি"
                  : "3. Audit Trail & Automated Monitoring"}
              </span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {language === "bn"
                ? "পোর্টালে সম্পাদিত প্রতিটি কার্যক্রম (লগইন, এক্সেল আপলোড, সুবিধাভোগী ডাটা পরিবর্তন, অডিট এবং ডুপ্লিকেশন রিমুভাল রিকোয়েস্ট) কর্মকর্তার ইউজার আইডি, আইপি অ্যাড্রেস এবং সময় সহ অপরিবর্তনীয় অডিট ট্রেইলে স্বয়ংক্রিয়ভাবে সংরক্ষিত হয়।"
                : "Every transaction, including Excel file uploads, beneficiary verification, profile updates, and removal requests, is permanently logged with user attribution, IP address, and cryptographic timestamps."}
            </p>
          </div>

          {/* Section 4 */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 space-y-1">
            <div className="font-bold text-slate-900">
              {language === "bn"
                ? "৪. স্বত্বাধিকার ও কারিগরি সহায়তা"
                : "4. Copyright & Technical Assistance"}
            </div>
            <p>
              All right reserved: Department of Information and Communication Technology (DOICT).
            </p>
            <p>
              Technical Assistance: Upazila ICT Office Kalmakanda, Netrokona.
            </p>
            <p className="font-semibold text-slate-700 pt-1">
              Copyright@2026. All rights reserved.
            </p>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-800 hover:bg-emerald-900 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
          >
            {language === "bn" ? "সম্মতি ও বন্ধ করুন" : "Close"}
          </button>
        </div>
      </div>
    </div>
  );
}
