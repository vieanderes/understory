// The first bytes of each file type we accept.
const SIGNATURES: Record<string, number[]> = {
  png: [137, 80, 78, 71],
  jpeg: [255, 216, 255],
};

export function imageType(bytes: number[]): string | null {
  // Replace this. It believes every upload is a PNG.
  return 'png';
}
