import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const dir = path.dirname(fileURLToPath(import.meta.url));
const iconsDir = path.join(dir, "..", "public", "icons");
const svgPath = path.join(iconsDir, "icon.svg");

for (const size of [192, 512]) {
  const outPath = path.join(iconsDir, `icon-${size}.png`);
  await sharp(svgPath).resize(size, size).png().toFile(outPath);
  console.log(`wrote ${outPath}`);
}
