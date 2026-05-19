import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface InfoRowProps {
  icon: ReactNode;
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  className?: string;
  divider?: boolean;
}

export function InfoRow({ icon, label, value, sub, className, divider = true }: InfoRowProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3.5 px-4 py-3.5',
        divider && 'border-b border-line last:border-b-0',
        className,
      )}
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-ink">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 text-[15px] font-medium text-foreground">{value}</div>
        {sub ? <div className="mt-0.5 text-xs text-muted-foreground">{sub}</div> : null}
      </div>
    </div>
  );
}
