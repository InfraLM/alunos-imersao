import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ChecklistStep {
  label: string;
  state: 'done' | 'loading' | 'pending';
}

interface LoadingChecklistProps {
  steps: ChecklistStep[];
  className?: string;
}

export function LoadingChecklist({ steps, className }: LoadingChecklistProps) {
  return (
    <div className={cn('flex flex-col gap-3', className)}>
      {steps.map((step, i) => (
        <div
          key={i}
          className={cn(
            'flex items-center gap-3 text-sm',
            step.state === 'done' && 'text-foreground/85',
            step.state === 'loading' && 'text-foreground',
            step.state === 'pending' && 'text-muted-foreground/60',
          )}
        >
          {step.state === 'done' ? (
            <span className="flex size-6 items-center justify-center rounded-full bg-foreground text-background">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
          ) : step.state === 'loading' ? (
            <span
              className="size-6 rounded-full border-[1.5px] border-line"
              style={{ borderTopColor: 'hsl(var(--accent))', animation: 'spin 0.8s linear infinite' }}
            />
          ) : (
            <span className="size-6 rounded-full border-[1.5px] border-line" />
          )}
          <span>{step.label}</span>
        </div>
      ))}
    </div>
  );
}
