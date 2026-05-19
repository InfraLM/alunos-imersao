import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface BackHeaderProps {
  title?: string;
  step?: string;
  to?: string;
  dark?: boolean;
  className?: string;
}

export function BackHeader({ title, step, to, dark, className }: BackHeaderProps) {
  const navigate = useNavigate();
  return (
    <div className={cn('mb-6 flex items-center justify-between gap-2', className)}>
      <button
        type="button"
        onClick={() => (to ? navigate(to) : navigate(-1))}
        aria-label="Voltar"
        className={cn(
          'flex size-10 items-center justify-center rounded-xl transition active:scale-95',
          dark ? 'bg-white/[0.06] border border-white/10 text-on-ink' : 'bg-secondary text-foreground',
        )}
      >
        <ChevronLeft className="size-5" />
      </button>
      <div
        className={cn(
          'text-[11px] font-medium uppercase tracking-widest',
          dark ? 'text-on-ink-muted' : 'text-muted-foreground',
        )}
      >
        {step ?? title ?? ''}
      </div>
      <div className="size-10" />
    </div>
  );
}
