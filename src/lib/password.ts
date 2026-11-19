import bcrypt from "bcryptjs";

/**
 * Creates a salted bcrypt hash of a plain text password.
 */
export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

/**
 * Verifies a plain text password against a stored bcrypt hash.
 */
export function verifyPassword(password: string, hash: string): boolean {
  if (!hash) return false;
  try {
    return bcrypt.compareSync(password, hash);
  } catch {
    return false;
  }
}
