import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

// GMAIL_TOKEN_KEY is preferred; falling back to JWT_SECRET keeps setup to the Google client id/secret.
// Changing the key makes stored tokens unreadable, and everyone would need to reconnect Gmail.
function key() {
  const secret = process.env.GMAIL_TOKEN_KEY || process.env.JWT_SECRET;
  if (!secret) throw new Error("GMAIL_TOKEN_KEY (or JWT_SECRET) must be set to store Gmail tokens");
  return createHash("sha256").update(secret).digest();
}

/** AES-256-GCM → "iv.tag.ciphertext" (base64url) */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64url")).join(".");
}

export function decrypt(stored: string): string {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64url"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
