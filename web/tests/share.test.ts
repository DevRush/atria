import assert from "node:assert/strict";
import { test } from "node:test";
import { createShareSecret, isValidShareSecret, sha256 } from "../lib/share";

test("share secret is 43-char url-safe and validates", () => {
  const s = createShareSecret();
  assert.match(s, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(isValidShareSecret(s), true);
});

test("share secrets are unique", () => {
  const seen = new Set(Array.from({ length: 200 }, () => createShareSecret()));
  assert.equal(seen.size, 200);
});

test("isValidShareSecret rejects malformed tokens", () => {
  assert.equal(isValidShareSecret(""), false);
  assert.equal(isValidShareSecret("short"), false);
  assert.equal(isValidShareSecret("has spaces and bad chars!!"), false);
  assert.equal(isValidShareSecret("a".repeat(44)), false);
});

test("sha256 is stable and hex", () => {
  const h = sha256("hello");
  assert.equal(h, "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824");
  assert.equal(sha256("hello"), h);
  assert.notEqual(sha256("hello"), sha256("hellp"));
});
