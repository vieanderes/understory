// Development serves no offline worker. A worker left by a production build on the same
// origin caches /_next/static cache-first, and dev chunk names do not change with their
// contents, so it would keep serving old code over the dev server. The browser re-checks
// /sw.js on every navigation; this one clears every cache, unregisters itself and reloads
// the open tabs. `pnpm build` writes the real worker over it.
import { writeFileSync } from 'node:fs';

writeFileSync(
  new URL('../public/sw.js', import.meta.url),
  `self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key);
      await self.registration.unregister();
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url);
    })(),
  );
});
`,
);
