import { LoaderCircle } from 'lucide-react';
import type { ButtonHTMLAttributes, Ref } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'quiet';
type Size = 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** One primary per screen. It is the only accent-filled thing in view. */
  variant?: Variant;
  size?: Size;
  /** Shows a spinner and blocks a second click. The label stays, so the width does not jump. */
  loading?: boolean;
  ref?: Ref<HTMLButtonElement>;
}

const VARIANT: Record<Variant, string> = {
  primary: 'bg-accent text-accent-fg hover:bg-accent-hover',
  secondary: 'bg-raised border border-border text-fg shadow-edge hover:border-border-strong',
  quiet: 'text-fg hover:bg-raised',
};

// 40 px and 48 px: both clear the 24 px WCAG 2.2 target floor with room for a thumb.
const SIZE: Record<Size, string> = {
  md: 'h-5 px-2 text-sm',
  lg: 'h-6 px-3 text-base',
};

export function buttonClass(variant: Variant = 'secondary', size: Size = 'lg', className?: string) {
  return cn(
    'rounded-control inline-flex items-center justify-center gap-1 font-medium whitespace-nowrap select-none',
    'transition-press active:scale-98',
    // Flat colours, not opacity: a faded label fails contrast and reads as a rendering fault.
    'disabled:pointer-events-none disabled:border-border disabled:bg-sunken disabled:text-faint',
    VARIANT[variant],
    SIZE[size],
    className,
  );
}

export function Button({
  variant = 'secondary',
  size = 'lg',
  loading = false,
  disabled,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (
        <LoaderCircle aria-hidden size={16} strokeWidth={2} className="animate-spin" />
      ) : null}
      {children}
    </button>
  );
}
