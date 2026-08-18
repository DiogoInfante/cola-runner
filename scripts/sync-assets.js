/**
 * Syncs sprites directory into public/assets directory before build.
 */
import fs from "fs";
import path from "path";

const srcDir = path.resolve("sprites");
const destDir = path.resolve("public/assets");

if (fs.existsSync(srcDir)) {
  fs.mkdirSync(destDir, { recursive: true });
  fs.cpSync(srcDir, destDir, { recursive: true, force: true });
}

