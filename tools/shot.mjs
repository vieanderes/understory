import { chromium } from '@playwright/test';
const [, , url, out, w = '1440', h = '900', theme = 'light'] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, colorScheme: theme });
const p = await ctx.newPage();
p.on('console', (m) => {
  if (m.type() === 'error') console.log('console error:', m.text().slice(0, 300));
});
const r = await p.goto(url, { waitUntil: 'networkidle' });
console.log(r.status());
await p.screenshot({ path: out, fullPage: true });
await b.close();
