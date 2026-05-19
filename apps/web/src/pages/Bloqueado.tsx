import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, MessageCircle } from 'lucide-react';

import { PageShell } from '@/components/PageShell';
import { ContactCard } from '@/components/ContactCard';

interface NavState {
  motivo: 'inadimplente' | 'punicao' | 'sem_email';
  mensagem: string;
}

const WHATSAPP = import.meta.env.VITE_CX_WHATSAPP ?? '5562081396751';

export default function Bloqueado() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as NavState | null;

  if (!state) return <Navigate to="/" replace />;

  const titulo =
    state.motivo === 'inadimplente'
      ? 'Situação financeira pendente'
      : state.motivo === 'punicao'
        ? 'Restrição vigente'
        : 'Cadastro incompleto';

  return (
    <PageShell>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/', { replace: true })}
          aria-label="Voltar"
          className="flex h-10 items-center gap-1 rounded-xl bg-secondary px-3 text-sm font-medium active:scale-95"
        >
          <ArrowLeft className="size-4" /> Voltar
        </button>
        <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Acesso bloqueado
        </div>
        <div className="size-10" />
      </div>

      <div className="mt-2">
        <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <AlertTriangle className="size-6" strokeWidth={1.6} />
        </div>
        <h1 className="serif text-[30px] leading-tight">{titulo}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{state.mensagem}</p>
      </div>

      <div className="mt-7">
        <div className="mb-3 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Fale com o suporte
        </div>
        <div className="space-y-2.5">
          <ContactCard
            icon={<MessageCircle className="size-5" strokeWidth={1.6} />}
            label="WhatsApp"
            value="Resposta rápida"
            href={`https://wa.me/${WHATSAPP}`}
            iconBg="bg-emerald-50"
            iconColor="text-emerald-700"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => navigate('/', { replace: true })}
        className="mt-8 flex h-12 w-full items-center justify-center rounded-2xl border border-line bg-card font-medium active:scale-[.99]"
      >
        Entendi
      </button>
    </PageShell>
  );
}
