import { cn } from '@/lib/utils';

const MESES_ABR = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

interface DateTileProps {
  date: string | Date;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'dark' | 'light';
  className?: string;
}

export function DateTile({ date, size = 'md', variant = 'dark', className }: DateTileProps) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const dia = d.getDate();
  const mes = MESES_ABR[d.getMonth()] ?? '—';

  const dims =
    size === 'sm'
      ? { w: 'w-12', h: 'h-14', mes: 'text-[9px]', dia: 'text-xl' }
      : size === 'lg'
        ? { w: 'w-16', h: 'h-20', mes: 'text-[11px]', dia: 'text-3xl' }
        : { w: 'w-14', h: 'h-16', mes: 'text-[10px]', dia: 'text-2xl' };

  return (
    <div
      className={cn(
        'rounded-xl overflow-hidden border flex flex-col flex-shrink-0',
        variant === 'dark' ? 'border-line' : 'border-on-ink/20',
        dims.w,
        dims.h,
        className,
      )}
    >
      <div
        className={cn(
          'text-center py-0.5 font-semibold uppercase tracking-widest',
          variant === 'dark' ? 'bg-ink text-on-ink' : 'bg-on-ink/10 text-on-ink-muted',
          dims.mes,
        )}
      >
        {mes}
      </div>
      <div
        className={cn(
          'serif flex-1 flex items-center justify-center',
          variant === 'dark' ? 'bg-background text-ink' : 'bg-transparent text-on-ink',
          dims.dia,
        )}
      >
        {dia}
      </div>
    </div>
  );
}
