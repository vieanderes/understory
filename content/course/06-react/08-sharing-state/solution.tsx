import { useState } from 'react';

type PanelProps = { title: string; isOpen: boolean; onShow: () => void; children: React.ReactNode };

function Panel({ title, isOpen, onShow, children }: PanelProps) {
  return (
    <section>
      <h3>
        <button aria-expanded={isOpen} onClick={onShow}>
          {title}
        </button>
      </h3>
      {isOpen && <p>{children}</p>}
    </section>
  );
}

export function FloorGuide() {
  // One owner for "which panel is open", so two can never be open together.
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  return (
    <div>
      <Panel title="Ground floor" isOpen={openIndex === 0} onShow={() => setOpenIndex(0)}>
        Fossils and a café.
      </Panel>
      <Panel title="First floor" isOpen={openIndex === 1} onShow={() => setOpenIndex(1)}>
        Paintings from five centuries.
      </Panel>
      <Panel title="Second floor" isOpen={openIndex === 2} onShow={() => setOpenIndex(2)}>
        A roof garden with views.
      </Panel>
    </div>
  );
}
