// Prints every axe violation on a URL with the failing node. `node tools/axe.mjs <url>`
import AxeBuilder from '@axe-core/playwright';
import { chromium } from '@playwright/test';

const url = process.argv[2];
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();
await page.goto(url);
const results = await new AxeBuilder({ page })
  .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
  .analyze();
for (const v of results.violations)
  for (const n of v.nodes)
    console.log(v.id, '|', n.target.join(' '), '|', (n.failureSummary ?? '').split('\n')[1]);
await browser.close();
