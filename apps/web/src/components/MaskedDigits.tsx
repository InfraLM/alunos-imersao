import { cn } from '@/lib/utils';

interface MaskedDigitsProps {
  value: string;
  mask: 'cpf' | 'otp';
  showCursor?: boolean;
  className?: string;
  dark?: boolean;
}

export function MaskedDigits({ value, mask, showCursor = true, className, dark }: MaskedDigitsProps) {
  const length = mask === 'cpf' ? 11 : 6;
  const groups = mask === 'cpf' ? [3, 3, 3, 2] : [6];
  const separator = mask === 'cpf' ? ['.', '.', '-'] : [];

  const digits: string[] = [];
  for (let i = 0; i < length; i++) {
    digits.push(value[i] ?? '•');
  }

  let idx = 0;
  const rendered: React.ReactNode[] = [];
  groups.forEach((g, gi) => {
    const groupDigits = digits.slice(idx, idx + g);
    idx += g;
    rendered.push(
      <span key={`g${gi}`} className="inline-flex">
        {groupDigits.map((ch, di) => (
          <span
            key={di}
            className={cn(
              'inline-block min-w-[0.55em] text-center',
              ch === '•'
                ? dark
                  ? 'text-on-ink-muted/40'
                  : 'text-muted/40'
                : dark
                  ? 'text-on-ink'
                  : 'text-ink',
            )}
          >
            {ch}
          </span>
        ))}
      </span>,
    );
    if (gi < separator.length) {
      rendered.push(
        <span
          key={`s${gi}`}
          className={dark ? 'text-on-ink-muted/40 mx-0.5' : 'text-muted/40 mx-0.5'}
        >
          {separator[gi]}
        </span>,
      );
    }
  });

  return (
    <div
      className={cn(
        'mono inline-flex items-center text-3xl tracking-widest',
        className,
      )}
    >
      {rendered}
      {showCursor && value.length < length && (
        <span
          className={cn(
            'inline-block w-[2px] h-7 ml-1 animate-blink',
            dark ? 'bg-accent' : 'bg-accent',
          )}
        />
      )}
    </div>
  );
}
