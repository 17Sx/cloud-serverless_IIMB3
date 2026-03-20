import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const codeDir = path.resolve(__dirname, "..");
const repoRoot = path.resolve(codeDir, "..");
const src = path.join(repoRoot, "assets", "test.png");
const dest = path.join(codeDir, "public", "assets", "test.png");

if (fs.existsSync(src)) {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  console.log("[sync-header-asset] assets/test.png → public/assets/test.png");
}
