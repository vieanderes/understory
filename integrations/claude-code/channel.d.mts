/** Types for channel.mjs, which ships as plain JavaScript so the plugin needs no build. */
export interface ToolResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}
export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: number | string;
  method?: string;
  params?: Record<string, unknown>;
  result?: unknown;
  error?: { code: number; message: string };
}
export interface ChannelOptions {
  send: (message: JsonRpcMessage) => void;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  log?: (line: string) => void;
  retryMs?: number;
  replyTimeoutMs?: number;
}
export interface Channel {
  handle(message: JsonRpcMessage): Promise<void>;
  onTool(name: string, args?: Record<string, unknown>): Promise<ToolResult>;
  readonly connected: boolean;
}
export const VERSION: string;
export const INSTRUCTIONS: string;
export function siteOrigin(raw: unknown): string | null;
export function pairingCode(raw: unknown): string | null;
export function questionForSession(text: string): string;
export function classify(result: {
  text: string;
  isError: boolean;
}): 'waiting-for-allow' | 'refused' | 'idle' | 'closed' | 'question';
export function createChannel(options: ChannelOptions): Channel;
export function main(): void;
