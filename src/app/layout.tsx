import type { Metadata } from "next";
import { Hind_Siliguri, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/Navbar";
import { Providers } from "@/components/Providers";

const hindSiliguri = Hind_Siliguri({
  weight: ["300", "400", "500", "600", "700"],
  subsets: ["bengali", "latin"],
  variable: "--font-hind-siliguri",
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SSNP Redundancy & Deduplication System | Bangladesh Local Government",
  description:
    "Integrated Social Safety Net Program (SSNP) data deduplication, cross-scheme validation, and beneficiary redundancy detection portal for Upazila/Union administration.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="bn"
      className={`${hindSiliguri.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-900 font-sans">
        <Providers>
          <Navbar />
          <main className="flex-1">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
            <div className="max-w-7xl mx-auto px-4">
              <p className="font-medium text-slate-700">
                Integrated Social Safety Net Program (SSNP) Data Redundancy & Deduplication Management System
              </p>
              <p className="mt-1 text-slate-500">
                Local Government Division (LGD) • Upazila Administration • Role & Permission Matrix Structure
              </p>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
