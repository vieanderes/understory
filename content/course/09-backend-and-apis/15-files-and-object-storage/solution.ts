export interface Upload {
  id: string;
  size: number;
  firstBytes: number[];
  declaredType: string;
}

export interface Result {
  status: number;
  key?: string;
  type?: string;
}

export const MAX_BYTES = 2000000; // 2 MB

// The first bytes every file of each kind starts with.
export const KINDS = [
  { signature: [137, 80, 78, 71], type: 'image/png', extension: 'png' },
  { signature: [255, 216, 255], type: 'image/jpeg', extension: 'jpg' },
];

export function acceptUpload(upload: Upload): Result {
  if (upload.size > MAX_BYTES) return { status: 413 };
  const kind = KINDS.find((k) => k.signature.every((byte, i) => upload.firstBytes[i] === byte));
  if (!kind) return { status: 415 };
  return { status: 201, key: `avatars/${upload.id}.${kind.extension}`, type: kind.type };
}
