import type { ReactNode } from 'react';

export type Variant = 'plain' | 'primary' | 'danger';
export type Size = 'small' | 'medium';

export interface ButtonProps {
  variant?: Variant;
  size?: Size;
  onClick?: () => void;
  // ReactNode is anything React can draw: text, elements or a mix.
  children: ReactNode;
}

export function Button({ variant = 'plain', size = 'medium', onClick, children }: ButtonProps) {
  return (
    <button
      type="button"
      className="button"
      data-variant={variant}
      data-size={size}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
