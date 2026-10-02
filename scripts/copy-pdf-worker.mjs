import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(import.meta.url);
try {
  const src = path.join(path.dirname(require.resolve("pdfjs-dist/package.json")), "build", "pdf.worker.min.mjs");
  if (!existsSync("public")) mkdirSync("public");
  copyFileSync(src, "public/pdf.worker.min.mjs");
  console.log("✓ Copied pdf.js worker to /public");
} catch (e) {
  console.warn("Could not copy pdf.js worker:", e.message);
}
