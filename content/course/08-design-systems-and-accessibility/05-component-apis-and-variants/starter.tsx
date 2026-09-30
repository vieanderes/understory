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

export function Button({ children }: ButtonProps) {
  // Replace this. It's a div, and it ignores variant, size and onClick.
  return <div className="button">{children}</div>;
}
