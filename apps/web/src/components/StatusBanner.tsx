import { useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronRight } from 'lucide-react';

interface StatusBannerProps {
  inadimplente?: boolean;
  punicao?: boolean;
}

export function StatusBanner({ inadimplente, punicao }: StatusBannerProps) {
  const navigate = useNavigate();
  if (!inadimplente && !punicao) return null;

  const motivo: 'inadimplente' | 'punicao' = inadimplente ? 'inadimplente' : 'punicao';
  const titulo = inadimplente ? 'Pendência financeira' : 'Restrição vigente';
  const mensagem = inadimplente
    ? 'Sua situação financeira pode estar pendente. Para verificar sua situação ou regularizar, entre em contato com o suporte.'
    : 'Você possui uma restrição vigente. Para agendar, cancelar ou reagendar, entre em contato com o suporte.';

  return (
    <button
      type="button"
      onClick={() => navigate('/app/cx', { state: { motivo } })}
      className="mb-5 flex w-full items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-left transition active:scale-[.99]"
    >
      <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.8} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-accent-ink">{titulo}</p>
        <p className="mt-1 text-xs leading-relaxed text-accent-ink/85">{mensagem}</p>
        <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-accent-ink">
          Falar com o suporte <ChevronRight className="size-3.5" />
        </span>
      </div>
    </button>
  );
}
