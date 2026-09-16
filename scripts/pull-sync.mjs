// Vendors the closed sync module (physio-sync) into src/sync/vendor/ (gitignored) so Vite
// can bundle it. Keeps the sync source out of this PUBLIC repo while still building it in.
// Source: ../physio-sync/src (local sibling) or PHYSIO_SYNC_SRC env (CI checkout path).
// If the source is missing, does nothing — the build then uses the local-only stub.

import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const src = process.env.PHYSIO_SYNC_SRC || join(here, "..", "..", "physio-sync", "src");
const dest = join(here, "..", "src", "sync", "vendor");

if (!existsSync(src)) {
  console.log(`pull-sync: source not found at ${src}; skipping (build will use the local-only stub).`);
  process.exit(0);
}

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(src, dest, { recursive: true });
console.log(`pull-sync: vendored ${src} -> ${dest}`);
