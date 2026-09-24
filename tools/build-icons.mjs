// Renders the Home Screen / favicon PNGs from tools/icon-art.js.
//   node tools/build-icons.mjs
// Needs Playwright with a Chromium available, e.g.
//   npm i -g playwright && NODE_PATH="$(npm root -g)" node tools/build-icons.mjs
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

// CommonJS require honours NODE_PATH, so a global Playwright install works
// without adding a package.json to this zero-dependency repo
const { chromium } = createRequire(import.meta.url)("playwright");

const root = resolve(fileURLToPath(import.meta.url), "../..");
const outDir = join(root, "icons");

const TARGETS = [
  { file: "apple-touch-icon.png", size: 180 },
  { file: "icon-192.png", size: 192 },
  { file: "icon-512.png", size: 512 },
  // Android crops maskable icons to as little as the centre 80% circle
  { file: "icon-maskable-512.png", size: 512, zoom: 0.8 },
  { file: "favicon-32.png", size: 32, zoom: 1.35 },
];

const TYPES = { ".js": "text/javascript", ".html": "text/html" };
const server = createServer(async (req, res) => {
  if (req.url === "/") {
    res.setHeader("content-type", "text/html");
    return res.end('<script type="module">import { drawIcon } from "/tools/icon-art.js"; window.drawIcon = drawIcon;</script>');
  }
  try {
    const body = await readFile(join(root, decodeURIComponent(req.url)));
    res.setHeader("content-type", TYPES[extname(req.url)] || "application/octet-stream");
    res.end(body);
  } catch {
    res.statusCode = 404;
    res.end();
  }
}).listen(0);
const { port } = server.address();

const browser = await chromium.launch(
  process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
);
try {
  const page = await browser.newPage();
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.drawIcon);
  await mkdir(outDir, { recursive: true });
  for (const t of TARGETS) {
    const dataUrl = await page.evaluate(({ size, zoom }) => {
      // render at 4x and downsample in steps for crisp small sizes
      const big = Math.max(size, 1024);
      const src = document.createElement("canvas");
      src.width = src.height = big;
      window.drawIcon(src.getContext("2d"), big, { zoom });
      let cur = src;
      while (cur.width / 2 >= size) {
        const next = document.createElement("canvas");
        next.width = next.height = cur.width / 2;
        const c = next.getContext("2d");
        c.imageSmoothingQuality = "high";
        c.drawImage(cur, 0, 0, next.width, next.height);
        cur = next;
      }
      const out = document.createElement("canvas");
      out.width = out.height = size;
      const c = out.getContext("2d");
      c.imageSmoothingQuality = "high";
      c.drawImage(cur, 0, 0, size, size);
      return out.toDataURL("image/png");
    }, { size: t.size, zoom: t.zoom ?? 1 });
    await writeFile(join(outDir, t.file), Buffer.from(dataUrl.split(",")[1], "base64"));
    console.log(`icons/${t.file}`);
  }
} finally {
  await browser.close();
  server.close();
}
