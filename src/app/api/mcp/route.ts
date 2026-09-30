import { limited } from '@/adapters/assistant/server/rate-limit';
import { handleMcpRequest } from '@/adapters/assistant/server/mcp-server';

/*
 * The MCP endpoint for the candidate's own Claude app:
 *   claude mcp add --transport http understory http://localhost:3000/api/mcp
 * Streamable HTTP. The tools, their instructions and how a connection is allowed are in
 * mcp-server.ts.
 */

export const dynamic = 'force-dynamic';
// A tool call may wait for the learner to press Allow (APPROVAL_WAIT_MS).
export const maxDuration = 60;

async function handle(request: Request) {
  return (await limited(request, 'mcp')) ?? handleMcpRequest(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
