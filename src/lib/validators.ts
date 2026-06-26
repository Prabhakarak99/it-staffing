// Shared field validators — used across all forms

/** Accepts: 555-000-0000 | (555) 000 0000 | +1 5550000000 | 7–15 digits */
export const isValidPhone = (v: string): boolean =>
  /^\+?[\d\s\-().]{7,20}$/.test(v.trim()) && v.replace(/\D/g, "").length >= 7;

/** RFC-style email: local@domain.tld (tld ≥ 2 chars) */
export const isValidEmail = (v: string): boolean =>
  /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Must start with http:// or https:// */
export const isValidUrl = (v: string): boolean =>
  /^https?:\/\/.{3,}/.test(v.trim());

/** Optional phone — only validated when non-empty */
export const validateOptionalPhone = (v: string): string | undefined =>
  v.trim() && !isValidPhone(v) ? "Invalid phone format (e.g. 555-000-0000)" : undefined;

/** Optional email — only validated when non-empty */
export const validateOptionalEmail = (v: string): string | undefined =>
  v.trim() && !isValidEmail(v) ? "Invalid email address" : undefined;

/** Optional URL — only validated when non-empty */
export const validateOptionalUrl = (v: string): string | undefined =>
  v.trim() && !isValidUrl(v) ? "Must start with https://" : undefined;

/** Password: min 8 chars, at least one letter and one number */
export const validatePassword = (v: string): string | undefined => {
  if (v.length < 8) return "Minimum 8 characters";
  if (!/[a-zA-Z]/.test(v)) return "Must contain at least one letter";
  if (!/\d/.test(v)) return "Must contain at least one number";
  return undefined;
};
