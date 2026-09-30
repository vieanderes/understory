import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV === 'development';

/**
 * A static CSP, set here rather than per-request in proxy.ts. Nonces would force every
 * page to render dynamically, and Understory's pages are static so they can be cached by
 * a CDN and by the service worker for offline use. The price is 'unsafe-inline' for
 * scripts, acceptable while there is no login and no user-generated content on the
 * origin. Revisit when sync adds accounts (docs/ARCHITECTURE.md).
 *
 * frame-src 'self' allows exactly one frame: the code sandbox below.
 */
const appCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

/**
 * The sandbox runner executes learner code. The `sandbox` directive in the HEADER is the
 * important part: it forces an opaque origin even when someone opens the runner URL as a
 * top-level page and posts code at it. Without it that code would run on the app origin,
 * next to the learner's IndexedDB. 'unsafe-eval' is the point of the page.
 */
const sandboxCsp = [
  'sandbox allow-scripts',
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval' blob:",
  'worker-src blob:',
  "style-src 'unsafe-inline'",
  "frame-ancestors 'self'",
].join('; ');

/**
 * The SQL worker (src/adapters/sql/worker.ts) and PGlite's files. A dedicated worker takes
 * its policy from its own response, so this is what the worker runs under: its own script,
 * PGlite's wasm compiled from its own fetch ('wasm-unsafe-eval', which allows compiling
 * WebAssembly and nothing else, unlike 'unsafe-eval'), and no other request of any kind.
 * The app's pages keep their policy without it.
 */
const sqlCsp = [
  "default-src 'none'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
  // The machine-readable opt-out from text and data mining (W3C TDMRep), which is what the
  // EU copyright directive asks for. robots.ts only asks politely.
  { key: 'tdm-reservation', value: '1' },
];

const nextConfig: NextConfig = {
  // Parallel builds (several e2e runs at once) each need their own output directory.
  distDir: process.env.NEXT_DIST_DIR || '.next',
  // The Docker image for a VPS sets BUILD_STANDALONE=1 to get a self-contained server
  // bundle (docs/DEPLOYMENT.md). Vercel and `next start` use the default output.
  output: process.env.BUILD_STANDALONE === '1' ? 'standalone' : undefined,
  reactStrictMode: true,
  poweredByHeader: false,
  // For a few hours on 29 September 2026 the learning paths were called courses.
  redirects() {
    return [
      { source: '/courses', destination: '/paths', permanent: true },
      { source: '/courses/:id', destination: '/paths/:id', permanent: true },
    ];
  },
  async headers() {
    return [
      {
        // Everything except the sandbox runner and the SQL worker.
        source: '/((?!sandbox/|sql/).*)',
        headers: [{ key: 'Content-Security-Policy', value: appCsp }, ...securityHeaders],
      },
      {
        source: '/sandbox/:path*',
        headers: [{ key: 'Content-Security-Policy', value: sandboxCsp }, ...securityHeaders],
      },
      {
        source: '/sql/:path*',
        headers: [{ key: 'Content-Security-Policy', value: sqlCsp }, ...securityHeaders],
      },
      {
        // The worker decides what is cached, so it must never be cached itself. The scope
        // header lets a worker served from /sw.js control every page.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        // The Pyodide version is in the path (src/adapters/pyodide/assets.ts).
        source: '/pyodide/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      {
        // Lecture PDFs keep their name across content changes; the link adds ?rev=.
        source: '/pdf/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, must-revalidate' }],
      },
      {
        // Lesson files carry a content hash in their name and never change.
        source: '/content/v1/lessons/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },
};

export default nextConfig;
