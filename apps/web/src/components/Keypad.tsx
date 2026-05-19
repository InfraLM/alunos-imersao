import { Delete } from 'lucide-react';
import { cn } from '@/lib/utils';

interface KeypadProps {
  onDigit: (digit: string) => void;
  onBackspace: () => void;
  disabled?: boolean;
  dark?: boolean;
}

export function Keypad({ onDigit, onBackspace, disabled, dark }: KeypadProps) {
  const baseKey = cn(
    'h-[60px] rounded-2xl flex items-center justify-center text-2xl font-medium tracking-wider transition-transform active:scale-[.96] disabled:opacity-40',
    dark
      ? 'bg-white/[0.06] border border-white/10 text-on-ink hover:bg-white/[0.10]'
      : 'bg-card border border-line text-ink hover:bg-secondary',
  );

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
        <button
          key={k}
          type="button"
          disabled={disabled}
          onClick={() => onDigit(k)}
          className={baseKey}
        >
          {k}
        </button>
      ))}
      <div />
      <button
        type="button"
        disabled={disabled}
        onClick={() => onDigit('0')}
        className={baseKey}
      >
        0
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={onBackspace}
        aria-label="Apagar"
        className={cn(
          'h-[60px] rounded-2xl flex items-center justify-center transition-transform active:scale-[.96] disabled:opacity-40',
          dark ? 'text-on-ink' : 'text-ink',
        )}
      >
        <Delete className="size-6" strokeWidth={1.6} />
      </button>
    </div>
  );
}
