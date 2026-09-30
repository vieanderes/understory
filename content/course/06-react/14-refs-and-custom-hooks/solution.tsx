import { useRef, useState } from 'react';

export function useDisclosure() {
  // Hooks inside a custom hook belong to whichever component calls it: one state per caller.
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  function toggle() {
    setOpen(!open);
  }

  function close() {
    setOpen(false);
    // Focus was inside the panel, which is about to hide. Put it back where the person started.
    buttonRef.current?.focus();
  }

  return { open, toggle, close, buttonRef };
}

export function Faq({ question, children }: { question: string; children: React.ReactNode }) {
  const { open, toggle, close, buttonRef } = useDisclosure();
  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'Escape') close();
      }}
    >
      <button ref={buttonRef} aria-expanded={open} onClick={toggle}>
        {question}
      </button>
      <div hidden={!open}>{children}</div>
    </div>
  );
}
