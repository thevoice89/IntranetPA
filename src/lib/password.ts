import crypto from "node:crypto";

// Hashing password con scrypt (incluso in Node, nessuna dipendenza esterna).

export function hashPassword(password: string): { salt: string; hash: string } {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return { salt, hash };
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

export function verifyPassword(
  password: string,
  salt: string,
  hash: string
): boolean {
  const computed = crypto.scryptSync(password, salt, 64).toString("hex");
  return safeEqual(computed, hash);
}
