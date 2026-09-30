/** Liveness for the container healthcheck and for the reverse proxy. No dependencies to probe. */
export const dynamic = 'force-static';

export function GET() {
  return Response.json({ status: 'ok' });
}
