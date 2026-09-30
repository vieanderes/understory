import { useEffect, useState } from 'react';

const COUNT = 4;

// The right arrow sticks after one press, and unticking the box doesn't stop the keys.
export function PhotoViewer() {
  const [index, setIndex] = useState(1);
  const [shortcuts, setShortcuts] = useState(true);

  useEffect(() => {
    if (!shortcuts) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'ArrowRight') setIndex(Math.min(index + 1, COUNT));
      if (event.key === 'ArrowLeft') setIndex(Math.max(index - 1, 1));
    }
    document.addEventListener('keydown', handleKey);
  }, [shortcuts]);

  return (
    <div>
      <p>
        Photo {index} of {COUNT}
      </p>
      <label>
        <input type="checkbox" checked={shortcuts} onChange={() => setShortcuts(!shortcuts)} />
        Keyboard shortcuts
      </label>
    </div>
  );
}
