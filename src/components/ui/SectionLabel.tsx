import { cn } from '@/lib/cn';

interface SectionLabelProps {
  index?: string;
  children: React.ReactNode;
  as?: 'h2' | 'h3' | 'p';
  id?: string;
  className?: string;
}

/** A hairline, an optional mono index and a micro label. It opens every section. */
export function SectionLabel({
  index,
  children,
  as: Tag = 'h2',
  id,
  className,
}: SectionLabelProps) {
  return (
    <div className={cn('rule-t flex items-baseline gap-2 pt-2', className)}>
      {index ? <span className="t-label t-figure">{index}</span> : null}
      <Tag id={id} className="t-label">
        {children}
      </Tag>
    </div>
  );
}
