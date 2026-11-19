import { DefaultSession } from "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    id?: string;
    designation?: string | null;
    role?: string;
    departmentId?: string | null;
    unionName?: string | null;
  }

  interface Session {
    user: {
      id?: string;
      designation?: string | null;
      role?: string;
      departmentId?: string | null;
      unionName?: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    designation?: string | null;
    role?: string;
    departmentId?: string | null;
    unionName?: string | null;
  }
}
