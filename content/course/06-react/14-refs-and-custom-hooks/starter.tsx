import { useRef } from 'react';

// Every Faq shares this logic. Give each caller its own open state, and make close hand focus back.
export function useDisclosure() {
  const buttonRef = useRef<HTMLButtonElement>(null);
  return { open: false, toggle: () => {}, close: () => {}, buttonRef };
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
