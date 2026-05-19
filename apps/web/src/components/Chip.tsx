import type { ReactNode } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const chipVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium uppercase tracking-wider',
  {
    variants: {
      tone: {
        neutral: 'bg-secondary text-foreground/80',
        ink: 'bg-white/10 text-on-ink border border-white/10',
        accent: 'bg-accent-soft text-accent-ink',
        outline: 'border border-line text-foreground/80',
        ok: 'bg-emerald-50 text-emerald-800',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface ChipProps extends VariantProps<typeof chipVariants> {
  children: ReactNode;
  className?: string;
  dot?: boolean;
}

export function Chip({ children, tone, dot, className }: ChipProps) {
  return (
    <span className={cn(chipVariants({ tone }), className)}>
      {dot ? <span className="size-1.5 rounded-full bg-accent" aria-hidden /> : null}
      {children}
    </span>
  );
}
