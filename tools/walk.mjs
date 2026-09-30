// Walks the first steps of a lesson and screenshots each stage. For manual design review.
import { chromium } from '@playwright/test';
const [, , url, out, w = '1440', h = '900', theme = 'light'] = process.argv;
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: +w, height: +h }, colorScheme: theme });
const p = await ctx.newPage();
p.on(
  'console',
  (m) => m.type() === 'error' && console.log('console error:', m.text().slice(0, 300)),
);
p.on('pageerror', (e) => console.log('page error:', e.message.slice(0, 300)));
await p.goto(url, { waitUntil: 'networkidle' });
await p.screenshot({ path: `${out}-0-opening.png` });
await p.getByRole('button', { name: 'Begin' }).click();
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}-1-step.png` });
await p.getByRole('radio').nth(1).check({ force: true });
await p.getByRole('radio', { name: 'Certain' }).check({ force: true });
await p.screenshot({ path: `${out}-2-answered.png` });
await p.getByRole('button', { name: 'Check' }).click();
await p.waitForTimeout(400);
await p.screenshot({ path: `${out}-3-checked.png` });
await b.close();
