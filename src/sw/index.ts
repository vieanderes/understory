import { BUILD_ID } from './config';
import { cancelDownload, downloadCourse, warm } from './download';
import { deleteOldCaches, precache, pruneOldBuild } from './lifecycle';
import { isClientMessage, type WorkerMessage } from './messages';
import { isProtectedPath } from './protected';
import { classify } from './routing';
import { respond } from './strategies';
import type { Env, WorkerScope } from './types';

/*
 * The service worker: wiring only. What is cached and how is in routing.ts and
 * strategies.ts; docs/OFFLINE.md has the table and the reasons.
 */

const scope = self as unknown as WorkerScope;

const env: Env = {
  caches: scope.caches,
  fetch: (input, init) => scope.fetch(input, init),
  origin: scope.location.origin,
};

scope.addEventListener('install', (event) => {
  // No skipWaiting here. A new worker waits until the page says the moment is right,
  // so a lesson in progress is never reloaded underneath the learner.
  event.waitUntil(precache(env));
});

async function tidy(): Promise<void> {
  await deleteOldCaches(env);
  const windows = await scope.clients.matchAll({ type: 'window', includeUncontrolled: true });
  const busy = windows.some((client) => isProtectedPath(new URL(client.url).pathname));
  if (!busy) await pruneOldBuild(env);
}

scope.addEventListener('activate', (event) => {
  event.waitUntil(scope.clients.claim().then(tidy));
});

scope.addEventListener('fetch', (event) => {
  const response = respond(event.request, classify(event.request, env.origin), {
    ...env,
    waitUntil: (work) => event.waitUntil(work),
  });
  if (response) event.respondWith(response);
});

scope.addEventListener('message', (event) => {
  const message: unknown = event.data;
  if (!isClientMessage(message)) return;
  // A MessageChannel port when the page sent one, else the page itself.
  const reply = (answer: WorkerMessage): void =>
    (event.ports[0] ?? event.source)?.postMessage(answer);

  switch (message.type) {
    case 'SKIP_WAITING':
      event.waitUntil(scope.skipWaiting());
      break;
    case 'GET_BUILD_ID':
      reply({ type: 'BUILD_ID', buildId: BUILD_ID });
      break;
    case 'DOWNLOAD_COURSE':
      event.waitUntil(downloadCourse(env, message.id, message.urls, reply));
      break;
    case 'CANCEL_DOWNLOAD':
      cancelDownload(message.id);
      break;
    case 'WARM':
      event.waitUntil(
        warm(env, message.urls).then((stored) => reply({ type: 'WARM_DONE', stored })),
      );
      break;
  }
});
