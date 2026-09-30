const ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(text: string): string {
  let out = '';
  for (const ch of text) {
    out += ENTITIES[ch] ?? ch;
  }
  return out;
}
