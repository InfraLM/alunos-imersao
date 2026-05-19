import { cn } from '@/lib/utils';

interface WordmarkProps {
  dark?: boolean;
  className?: string;
}

export function Wordmark({ dark, className }: WordmarkProps) {
  return (
    <span
      className={cn(
        'inline-flex items-baseline gap-1.5 tracking-wider font-medium',
        dark ? 'text-on-ink' : 'text-ink',
        className,
      )}
    >
      <span className="text-[11px] uppercase tracking-widest opacity-80">Liberdade</span>
      <span className="size-1 rounded-full bg-accent" aria-hidden />
      <span className="serif italic text-accent text-[13px] leading-none">médica</span>
    </span>
  );
}
