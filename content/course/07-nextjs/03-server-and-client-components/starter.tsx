import { useState } from 'react';

export function LikeButton({ likes }: { likes: number }) {
  return <button>Like ({likes})</button>;
}
