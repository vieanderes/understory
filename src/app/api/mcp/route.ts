import { limited } from '@/adapters/assistant/server/rate-limit';
import { handleMcpRequest } from '@/adapters/assistant/server/mcp-server';

/*
 * The MCP endpoint for the candidate's own Claude app:
 *   claude mcp add --transport http understory http://localhost:3000/api/mcp
 * Streamable HTTP, stateless. The tools and their instructions are in mcp-server.ts.
 */

export const dynamic = 'force-dynamic';

function handle(request: Request) {
  return limited(request, 'mcp') ?? handleMcpRequest(request);
}

export const POST = handle;
export const GET = handle;
export const DELETE = handle;
