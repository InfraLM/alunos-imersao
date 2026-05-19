import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface PageShellProps {
  children: ReactNode;
  className?: string;
  variant?: 'light' | 'dark';
  full?: boolean;
}

export function PageShell({ children, className, variant = 'light', full = false }: PageShellProps) {
  return (
    <div className={cn('min-h-dvh', variant === 'dark' ? 'bg-ink text-on-ink' : 'bg-background')}>
      <main
        className={cn(
          'mx-auto w-full max-w-md safe-top safe-bottom',
          full ? '' : 'px-5 pb-10 pt-6',
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}
