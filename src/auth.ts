import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  trustHost: true,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const email = String(credentials.email).trim().toLowerCase();
        const password = String(credentials.password);

        try {
          const user = await prisma.user.findUnique({
            where: { email },
          });

          if (!user || !user.isActive) {
            console.warn(`[Auth] User not found or inactive: ${email}`);
            return null;
          }

          const isHashValid = user.passwordHash
            ? bcrypt.compareSync(password, user.passwordHash)
            : false;
          const isPlainValid = Boolean(user.password && user.password === password);

          if (!isHashValid && !isPlainValid) {
            console.warn(`[Auth] Password mismatch for: ${email}`);
            return null;
          }

          return {
            id: user.id,
            name: user.name,
            email: user.email,
            designation: user.designation,
            role: user.role,
            departmentId: user.departmentId,
            district: user.district,
            upazilaName: user.upazilaName,
            unionName: user.unionName,
          };
        } catch (error) {
          console.error("Auth authorization error:", error);
          return null;
        }
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET || "ssnp-bangladesh-local-gov-secret-key-2026-audit-trail-sec",
});
