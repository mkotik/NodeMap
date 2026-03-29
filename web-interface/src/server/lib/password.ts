import bcrypt from "bcryptjs";

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export function comparePassword(
  password: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
