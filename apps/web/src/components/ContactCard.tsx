import type { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ContactCardProps {
  icon: ReactNode;
  label: string;
  value: string;
  href: string;
  iconBg?: string;
  iconColor?: string;
  className?: string;
}

export function ContactCard({
  icon,
  label,
  value,
  href,
  iconBg = 'bg-accent-soft',
  iconColor = 'text-accent-ink',
  className,
}: ContactCardProps) {
  return (
    <a
      href={href}
      target={href.startsWith('http') ? '_blank' : undefined}
      rel={href.startsWith('http') ? 'noreferrer' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-sm transition active:scale-[.99] hover:border-line-strong',
        className,
      )}
    >
      <div className={cn('flex size-11 items-center justify-center rounded-xl', iconBg, iconColor)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{label}</p>
        <p className="truncate text-xs text-muted-foreground">{value}</p>
      </div>
      <ChevronRight className="size-4 text-muted-foreground" />
    </a>
  );
}
