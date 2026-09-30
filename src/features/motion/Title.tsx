import type { ComponentPropsWithRef, ReactNode } from 'react';
import { cn } from '@/lib/cn';
import { toStaticHtml } from './static-html';

type TitleProps = Omit<ComponentPropsWithRef<'h1'>, 'children' | 'dangerouslySetInnerHTML'> & {
  as?: 'h1' | 'h2';
  children: ReactNode;
  /** Holds the arrival back, for a title that is only a placeholder until data loads. */
  wait?: boolean;
};

/**
 * The page title in the display face. It arrives line by line out of a mask (Arrival), and
 * is rendered as one HTML string so the line split never touches nodes React owns.
 */
export function Title({ as: Tag = 'h1', children, className, wait, ...rest }: TitleProps) {
  return (
    <Tag
      {...rest}
      className={cn('t-title', className)}
      data-arrive="title"
      data-arrive-wait={wait ? '' : undefined}
      dangerouslySetInnerHTML={{ __html: toStaticHtml(children) }}
    />
  );
}
