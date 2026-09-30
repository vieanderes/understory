// The first bytes of each file type we accept.
const SIGNATURES: Record<string, number[]> = {
  png: [137, 80, 78, 71],
  jpeg: [255, 216, 255],
};

export function imageType(bytes: number[]): string | null {
  for (const [type, signature] of Object.entries(SIGNATURES)) {
    if (signature.every((byte, i) => bytes[i] === byte)) return type;
  }
  return null;
}
