"use client";

import React from "react";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";

export function Providers({
  children,
  session,
}: {
  children: React.ReactNode;
  session?: any;
}) {
  return (
    <SessionProvider session={session}>
      <AuthProvider initialSession={session}>
        <LanguageProvider>{children}</LanguageProvider>
      </AuthProvider>
    </SessionProvider>
  );
}
