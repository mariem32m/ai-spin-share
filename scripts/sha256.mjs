// Prints the SHA-256 hex digest of a password so it can be placed
// in VITE_HOST_HASH instead of storing the plaintext password in code.
// Usage: node scripts/sha256.mjs "your-host-password"
import { createHash } from "node:crypto";

const value = process.argv[2];
if (!value) {
  console.error("Usage: node scripts/sha256.mjs \"your-host-password\"");
  process.exit(1);
}
console.log(createHash("sha256").update(value).digest("hex"));