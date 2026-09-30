import { useEffect, useState } from 'react';

const COUNT = 4;

export function PhotoViewer() {
  const [index, setIndex] = useState(1);
  const [shortcuts, setShortcuts] = useState(true);

  useEffect(() => {
    if (!shortcuts) return;
    function handleKey(event: KeyboardEvent) {
      // Updaters read the latest index, not the one from the render that set up the listener.
      if (event.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, COUNT));
      if (event.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 1));
    }
    document.addEventListener('keydown', handleKey);
    // Runs before the effect runs again and when the viewer leaves the page.
    return () => document.removeEventListener('keydown', handleKey);
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
