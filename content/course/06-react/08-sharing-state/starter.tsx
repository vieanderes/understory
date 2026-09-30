import { useState } from 'react';

// Each Panel keeps its own `open`, so several can be open at once. Lift it into FloorGuide.
function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <section>
      <h3>
        <button aria-expanded={open} onClick={() => setOpen(true)}>
          {title}
        </button>
      </h3>
      {open && <p>{children}</p>}
    </section>
  );
}

export function FloorGuide() {
  return (
    <div>
      <Panel title="Ground floor">Fossils and a café.</Panel>
      <Panel title="First floor">Paintings from five centuries.</Panel>
      <Panel title="Second floor">A roof garden with views.</Panel>
    </div>
  );
}
