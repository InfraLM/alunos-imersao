import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, ChevronLeft, MessageCircle } from 'lucide-react';

import { PageShell } from '@/components/PageShell';
import { ContactCard } from '@/components/ContactCard';

interface NavState {
  acao?: 'cancelar' | 'reagendar' | 'inscrever';
  motivo?: 'prazo' | 'inadimplente' | 'punicao';
  diasRestantes?: number;
}

const WHATSAPP = import.meta.env.VITE_CX_WHATSAPP ?? '5562981396751';

const ACAO_VERBO: Record<NonNullable<NavState['acao']>, string> = {
  inscrever: 'inscrever',
  cancelar: 'cancelar',
  reagendar: 'reagendar',
};

interface Conteudo {
  titulo: string;
  alertTitulo: string;
  alertCorpo: string;
}

function getConteudo(state: NavState): Conteudo {
  const acaoVerbo = state.acao ? ACAO_VERBO[state.acao] : 'concluir essa ação';

  if (state.motivo === 'inadimplente') {
    return {
      titulo: 'Pendência financeira',
      alertTitulo: 'Verifique sua situação',
      alertCorpo:
        'Sua situação financeira pode estar pendente. Para verificar sua situação ou regularizar, entre em contato com o suporte.',
    };
  }
  if (state.motivo === 'punicao') {
    return {
      titulo: 'Restrição vigente',
      alertTitulo: 'Você possui uma restrição ativa',
      alertCorpo: `Para ${acaoVerbo} uma imersão neste momento, entre em contato com o suporte.`,
    };
  }
  if (state.motivo === 'prazo' || state.diasRestantes !== undefined) {
    const acao = state.acao === 'reagendar' ? 'reagendamento' : 'cancelamento';
    return {
      titulo: 'Prazo limite atingido',
      alertTitulo: 'Prazo limite atingido',
      alertCorpo: `O prazo para ${acao} pelo app expirou (limite de 15 dias antes do evento). Entre em contato com o suporte agora mesmo para que possamos te ajudar.`,
    };
  }
  return {
    titulo: 'Suporte',
    alertTitulo: 'Falar com o suporte',
    alertCorpo: 'Escolha o canal mais conveniente para resolver sua solicitação.',
  };
}

export default function CxContato() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state ?? {}) as NavState;
  const conteudo = getConteudo(state);
  const acaoMensagem = state.acao
    ? `Olá, gostaria de ${ACAO_VERBO[state.acao]} uma imersão.`
    : 'Olá, preciso de ajuda com minha inscrição em uma imersão.';

  return (
    <PageShell>
      <div className="mb-4 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/app/minhas', { replace: true })}
          aria-label="Voltar"
          className="flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground active:scale-95"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {conteudo.titulo}
        </div>
        <div className="size-10" />
      </div>

      <div className="rounded-2xl border border-accent/30 bg-accent-soft p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.8} />
          <div>
            <p className="text-sm font-medium text-accent-ink">{conteudo.alertTitulo}</p>
            <p className="mt-1 text-sm leading-relaxed text-accent-ink/85">{conteudo.alertCorpo}</p>
          </div>
        </div>
      </div>

      <h2 className="serif mt-7 text-[28px] leading-tight">
        Fale com o <span className="italic-accent">suporte</span>.
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Escolha o canal mais conveniente para resolver sua solicitação.
      </p>

      <div className="mt-4 space-y-2.5">
        <ContactCard
          icon={<MessageCircle className="size-5" strokeWidth={1.6} />}
          label="WhatsApp"
          value="Atendimento mais rápido"
          href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(acaoMensagem)}`}
          iconBg="bg-emerald-50"
          iconColor="text-emerald-700"
        />
      </div>

      <button
        type="button"
        onClick={() => navigate('/app/minhas')}
        className="mt-8 flex h-12 w-full items-center justify-center rounded-2xl border border-line bg-card font-medium active:scale-[.99]"
      >
        Voltar para minhas inscrições
      </button>
    </PageShell>
  );
}
