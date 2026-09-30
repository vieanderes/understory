import { SquareTerminal } from 'lucide-react';

/** The simulator's mark in the top bar: generic on purpose, never the platform's logo. */
export function Mark() {
  return (
    <span className="text-fg inline-flex items-center" aria-hidden>
      <SquareTerminal size={20} strokeWidth={2} />
    </span>
  );
}
