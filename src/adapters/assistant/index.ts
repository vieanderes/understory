import type { AssistantPort, AssistantProviderId } from '@/core/ports/assistant';
import { createApiKeyPort, createLocalCliPort } from './http-ports';
import { createMcpPort } from './mcp-port';
import { createOpenAiCompatiblePort } from './openai-compatible';
import type { Pairing } from './pairing';
import type { AssistantModel } from './protocol';

export { createApiKeyPort, createLocalCliPort, localCliAvailable } from './http-ports';
export {
  buildOpenAiChatRequest,
  createOpenAiCompatiblePort,
  DEFAULT_OLLAMA_URL,
  DEFAULT_OPENAI_MODEL,
  isLocalUrl,
  mapOpenAiStatus,
  readOpenAiStream,
  resolveCompletionsUrl,
  type OpenAiChatMessage,
  type OpenAiChatRequest,
  type OpenAiPortOptions,
} from './openai-compatible';
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
  getOpenAiUrl?: () => string;
  getOpenAiKey?: () => string;
  getOpenAiModel?: () => string;
  course?: string;
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
    case 'openai-compatible':
      return createOpenAiCompatiblePort({
        getBaseUrl: settings.getOpenAiUrl ?? (() => ''),
        getKey: settings.getOpenAiKey ?? (() => ''),
        getModel: settings.getOpenAiModel ?? (() => ''),
        fetcher: settings.fetcher,
        course: settings.course,
      });
  }
}
