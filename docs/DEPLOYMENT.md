# Deployment

Understory is a set of static pages, a static content bundle and one tiny health route. It
needs no database and no environment variables. That keeps every host an option.

| Decision   | Choice                                | Reason                                                                  |
| ---------- | ------------------------------------- | ----------------------------------------------------------------------- |
| First host | Vercel                                | Zero configuration for Next.js, previews per branch, free for this size |
| Later host | A VPS (Hetzner) with Docker and Caddy | Full control, fixed cost, same build                                    |
| Lock-in    | None                                  | No Vercel-only service is used: no Vercel Cron, KV, Blob or Edge Config |
| News cron  | GitHub Actions                        | It commits JSON to the repo, so it works with any host                  |
| CSP        | Static, in `next.config.ts`           | Pages stay static and cacheable. Nonces would force dynamic rendering   |

## The assistant routes

The online-test simulator's assistant (docs/ONLINE-TEST.md, section 6) adds the only
per-request server code: `/api/assistant`, `/api/assistant/local`, `/api/assistant/bridge`
and `/api/mcp`. Each is rate-limited per client
(`src/adapters/assistant/server/rate-limit.ts`): 30 replies a minute, 240 bridge or MCP
calls a minute, and a client that sends twenty wrong pairing codes or tab secrets is shut
out for ten minutes. The API key route spends the candidate's own key, never one of ours. The
local route answers only on the candidate's machine. The MCP bridge keeps sessions in
memory by default, which is enough on the VPS. On Vercel, create a free Upstash Redis
database (or add Vercel's Redis integration) and set `UPSTASH_REDIS_REST_URL` and
`UPSTASH_REDIS_REST_TOKEN` (or `KV_REST_API_URL` and `KV_REST_API_TOKEN`): every instance then
shares the sessions, and connecting Claude through MCP works there too. The rate limits
are counted in the same store, so with Redis they hold across every instance; without it,
each instance keeps its own count, a floor rather than a ceiling. How the MCP connection
stays safe without a sign-in is in docs/ONLINE-TEST.md, section 6.

## Vercel

1. Import the GitHub repo `vieanderes/understory`.
2. Framework preset: Next.js. Build command and output directory: defaults.
3. Node.js version: 24.x. The install uses `pnpm` from `packageManager`.
4. Environment variable: `NEXT_PUBLIC_SITE_URL` with the production origin.
5. Deploy. Every push to `main` redeploys, including the daily Signal commit.

`pnpm build` runs `pnpm build:content` first (the `prebuild` script), so the content bundle
in `public/content/v1/` always matches the lessons in the commit.

## A VPS with Docker and Caddy

```sh
ssh root@server
git clone git@github.com:vieanderes/understory.git && cd understory
DOMAIN=understory.example docker compose -f deployment/compose.yml up -d --build
```

- `Dockerfile` builds the standalone server (`BUILD_STANDALONE=1`) into a small Alpine image
  that runs as a non-root user with a read-only file system.
- `deployment/compose.yml` runs the app behind Caddy. Caddy gets and renews the TLS
  certificate by itself and serves HTTP/3.
- Point the domain's A and AAAA records at the server before the first start, or Caddy
  cannot complete the certificate challenge.
- The container healthcheck calls `/api/health`. Caddy starts only once the app is healthy.

### Updating

```sh
git pull && DOMAIN=understory.example docker compose -f deployment/compose.yml up -d --build
```

Compose replaces the container after the new image is built. The gap is a second or two.
For a release with no gap, run two app replicas and let Caddy load-balance between them
while one restarts (`reverse_proxy app1:3000 app2:3000` with `health_uri /api/health`).

### Signal on a VPS

On Vercel, the daily news commit triggers a redeploy. On a VPS choose one:

1. Keep GitHub Actions committing, and pull and rebuild on a timer or a webhook.
2. Run `pnpm news` from a systemd timer on the server and switch the `NewsStore` adapter
   to Postgres. The port is in `src/core/ports/news-store.ts`. See `docs/SIGNAL.md`.

### Hardening checklist

- SSH keys only, no root password login, `ufw` allowing 22, 80, 443.
- Unattended security upgrades on the host.
- The containers drop all capabilities and set `no-new-privileges`.
- Back up nothing on the server: the repo is the source of truth, and learner progress
  lives in each learner's browser until sync exists (`docs/SYNC-PROTOCOL.md`).

## An open site

Understory has no login, on purpose: a visitor can start at once. What protects it:

| Risk                            | Guard                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Copying lessons                 | `LICENSE`: lessons are CC BY-NC-SA 4.0, code is MIT. The licence line is in Settings                                                                        |
| AI training on the content      | `robots.ts` refuses the known AI crawlers. The `tdm-reservation: 1` header and `/.well-known/tdmrep.json` are the legal opt-out under EU Directive 2019/790 |
| A request that costs us money   | There is none. Pages and the bundle are static, the code runner runs in the browser and news runs in GitHub Actions                                         |
| A future one (sync, an AI call) | `tests/unit/scripts/public-surface.test.ts` fails on any per-request route or server action until it is rate-limited and listed there                       |

When a rate-limited route is added:

- **Limit in the app**, per IP and per account, with a shared store (Redis or Postgres), not
  memory. Serverless instances do not share memory, so an in-memory counter limits nothing.
- **Limit at the edge too.** On Vercel, a Firewall rate-limit rule on the route. On the VPS,
  Caddy built with the `caddy-ratelimit` module (`xcaddy`), since stock Caddy has none.
- **Cap the bill.** A spend limit on Vercel and a monthly cap on every paid API key.

robots.txt is a request. Crawlers that ignore it are blocked only by the edge: Vercel's
bot protection, or a `User-Agent` match in Caddy.

## When sync arrives

Sync adds a Postgres database (Supabase or self-hosted), accounts, and two routes. At that
point: add the database URL as a secret, rate-limit both routes (see above), revisit the CSP (nonces become worth their cost
once there is a session to steal), and add backups with a tested restore.
