import { cn } from '@/lib/utils';

interface AvatarProps {
  nome: string | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

function initials(nome: string | null | undefined): string {
  if (!nome) return '••';
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '••';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function Avatar({ nome, size = 'md', className }: AvatarProps) {
  const dims =
    size === 'sm'
      ? 'size-9 text-base'
      : size === 'lg'
        ? 'size-14 text-2xl'
        : 'size-11 text-xl';

  return (
    <div
      className={cn(
        'rounded-full bg-ink text-on-ink serif flex items-center justify-center',
        dims,
        className,
      )}
    >
      {initials(nome)}
    </div>
  );
}
