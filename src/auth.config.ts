import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLoginPage = nextUrl.pathname === "/login";
      const isNextAuthPublic =
        nextUrl.pathname.startsWith("/api/auth/callback") ||
        nextUrl.pathname.startsWith("/api/auth/signin") ||
        nextUrl.pathname.startsWith("/api/auth/signout") ||
        nextUrl.pathname.startsWith("/api/auth/session") ||
        nextUrl.pathname.startsWith("/api/auth/csrf") ||
        nextUrl.pathname.startsWith("/api/auth/providers") ||
        nextUrl.pathname.startsWith("/api/health");

      if (isNextAuthPublic) {
        return true;
      }

      if (isLoginPage) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.email = user.email;
        token.image = user.image || (user as any).image;
        token.phone = (user as any).phone;
        token.designation = (user as any).designation;
        token.role = (user as any).role;
        token.departmentId = (user as any).departmentId;
        token.district = (user as any).district || (user as any).districtName;
        token.districtName = (user as any).districtName || (user as any).district || "নেত্রকোণা";
        token.upazilaName = (user as any).upazilaName;
        token.unionName = (user as any).unionName;
      }
      return token;
    },
    session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        if (token.name) session.user.name = token.name as string;
        if (token.email) session.user.email = token.email as string;
        session.user.image = (token.image as string | null) || session.user.image || null;
        (session.user as any).phone = (token.phone as string | null) || null;
        session.user.designation = (token.designation as string | null) || null;
        session.user.role = token.role as string;
        session.user.departmentId = token.departmentId as string | null;
        (session.user as any).district = (token.district as string | null) || null;
        (session.user as any).districtName = (token.districtName as string | null) || (token.district as string | null) || null;
        (session.user as any).upazilaName = (token.upazilaName as string | null) || null;
        session.user.unionName = token.unionName as string | null;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
