import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface TicketProps {
  top: ReactNode;
  bottom: ReactNode;
  className?: string;
  /** Cor do "buraco" lateral. Use 'ink' quando o ticket está sobre fundo escuro. */
  notchBg?: 'ink' | 'app';
}

export function Ticket({ top, bottom, className, notchBg = 'ink' }: TicketProps) {
  const notchColor = notchBg === 'ink' ? 'bg-ink' : 'bg-background';
  return (
    <div className={cn('rounded-2xl bg-card text-foreground relative', className)}>
      <div className="px-5 py-5">{top}</div>
      <div className="relative h-4">
        <div className={cn('absolute -left-2 top-0 size-4 rounded-full', notchColor)} />
        <div className={cn('absolute -right-2 top-0 size-4 rounded-full', notchColor)} />
        <div
          className="absolute left-4 right-4 top-[7px] h-px"
          style={{
            backgroundImage:
              'repeating-linear-gradient(to right, hsl(var(--line-strong)) 0 6px, transparent 6px 12px)',
          }}
        />
      </div>
      <div className="px-5 pb-5 pt-3">{bottom}</div>
    </div>
  );
}
