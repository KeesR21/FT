/**
 * Remove Next.js output folders. Use when you see:
 *   Cannot find module './NNNN.js'
 *   __webpack_modules__[moduleId] is not a function
 * Causes: corrupt/partial .next, mixing `next dev` then `next start` without `next build`,
 * or cloud sync (OneDrive) deleting or reordering files under `.next`.
 * Also try this when the browser shows only "HTTP ERROR 500" for every page.
 */
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
for (const name of [".next", "out"]) {
  const p = path.join(root, name);
  try {
    fs.rmSync(p, { recursive: true, force: true });
    process.stdout.write(`Removed ${name}/\n`);
  } catch (e) {
    process.stderr.write(`Could not remove ${name}: ${e && e.message}\n`);
    process.exitCode = 1;
  }
}
