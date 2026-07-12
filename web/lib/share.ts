import { createHash, randomBytes } from "node:crypto";

/**
 * Bearer-link crypto for shareable who's-on-call links (adapted from Codex's
 * Atria). A 256-bit secret is generated once and shown to the creator; only its
 * SHA-256 hash is stored, so a database leak never yields a working link. Links
 * are revocable and expirable.
 */

/** 256-bit URL-safe secret (43 chars). Returned to the creator exactly once. */
export function createShareSecret(): string {
  return randomBytes(32).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function isValidShareSecret(value: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(value);
}

export function nowIso(): string {
  return new Date().toISOString();
}
