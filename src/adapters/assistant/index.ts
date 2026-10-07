import type { AssistantPort, AssistantProviderId } from '@/core/ports/assistant';
import { createApiKeyPort, createLocalCliPort } from './http-ports';
import { createMcpPort } from './mcp-port';
import type { Pairing } from './pairing';
import type { AssistantModel } from './protocol';

export { createApiKeyPort, createLocalCliPort, localCliAvailable } from './http-ports';
export {
  createMcpPort,
  decideMcpConnection,
  endMcpSession,
  fetchMcpStatus,
  MCP_TIMEOUT_MS,
  NO_MCP_STATUS,
  pushMcpContext,
  type McpStatus,
} from './mcp-port';
export { createPairingCode, createTabSecret, formatPairingCode, type Pairing } from './pairing';
export { ASSISTANT_MODELS, DEFAULT_ASSISTANT_MODEL, type AssistantModel } from './protocol';

export interface AssistantPortSettings {
  getKey: () => string;
  pairing: Pairing;
  model?: () => AssistantModel | undefined;
  fetcher?: typeof fetch;
}

/** The browser adapter for a provider. */
export function createAssistantPort(
  id: AssistantProviderId,
  settings: AssistantPortSettings,
): AssistantPort {
  switch (id) {
    case 'api-key':
      return createApiKeyPort({
        getKey: settings.getKey,
        model: settings.model,
        fetcher: settings.fetcher,
      });
    case 'claude-cli':
      return createLocalCliPort({ model: settings.model, fetcher: settings.fetcher });
    case 'mcp':
      return createMcpPort({ pairing: settings.pairing, fetcher: settings.fetcher });
  }
}
