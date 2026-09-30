'use client';

import { useState } from 'react';

export function LikeButton({ likes }: { likes: number }) {
  const [liked, setLiked] = useState(false);
  return (
    <button onClick={() => setLiked(!liked)}>
      {liked ? `Liked (${likes + 1})` : `Like (${likes})`}
    </button>
  );
}
