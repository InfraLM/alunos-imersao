import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: BottomSheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/45 animate-fade-in" />
        <Dialog.Content
          className={cn(
            'fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-3xl bg-card px-6 pt-3 pb-8 shadow-[0_-20px_60px_rgba(0,0,0,0.30)] animate-sheet-up safe-bottom',
            className,
          )}
        >
          <div className="mx-auto mb-3 h-1.5 w-11 rounded-full bg-line" />
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              {title ? (
                <Dialog.Title className="serif text-[26px] leading-tight">{title}</Dialog.Title>
              ) : null}
              {description ? (
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {description}
                </Dialog.Description>
              ) : null}
            </div>
            <Dialog.Close
              aria-label="Fechar"
              className="-mt-1 flex size-8 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </Dialog.Close>
          </div>
          <div className="mt-4">{children}</div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
