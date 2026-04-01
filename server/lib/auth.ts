import bcrypt from "bcrypt";

const SALT_ROUNDS = 10;
export const PENDING_PLACEHOLDER = "__pending__";

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(plainText: string, hash: string): Promise<boolean> {
  if (!hash || hash === PENDING_PLACEHOLDER || !hash.startsWith("$2")) {
    return false;
  }
  return bcrypt.compare(plainText, hash);
}
