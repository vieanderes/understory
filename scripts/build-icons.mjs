// Rasterises the mark into the PNG sizes that iOS, Android and the install prompt need.
// Run by hand after changing the mark: `node scripts/build-icons.mjs`. The outputs are
// committed, so CI and Vercel never need a browser to build icons.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const INK = '#161d19';
const PAPER = '#e7e5da';
const ACCENT = '#9aa1f7';

/** `pad` is the safe zone: maskable icons get cropped to a circle by Android. */
function svg(size, pad, radius) {
  const s = size;
  const inner = s - pad * 2;
  const x = (f) => pad + inner * f;
  const w = Math.round(s * 0.09);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <rect width="${s}" height="${s}" rx="${radius}" fill="${INK}"/>
  <g fill="none" stroke-width="${w}" stroke-linecap="round">
    <path d="M${x(0.33)} ${x(0.28)}H${x(0.67)}" stroke="${PAPER}" stroke-opacity=".5"/>
    <path d="M${x(0.2)} ${x(0.5)}H${x(0.8)}" stroke="${ACCENT}"/>
    <path d="M${x(0.27)} ${x(0.72)}H${x(0.73)}" stroke="${PAPER}"/>
  </g></svg>`;
}

const targets = [
  ['src/app/apple-icon.png', 180, 0, 0], // iOS rounds the corners itself
  ['public/icons/icon-192.png', 192, 0, 42],
  ['public/icons/icon-512.png', 512, 0, 112],
  ['public/icons/maskable-512.png', 512, 64, 0],
];

const browser = await chromium.launch();
for (const [file, size, pad, radius] of targets) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg(size, pad, radius)}</body>`);
  writeFileSync(file, await page.screenshot({ omitBackground: true }));
  await page.close();
  console.log(file);
}
await browser.close();
