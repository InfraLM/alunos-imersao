import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarHeart, ChevronLeft, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

import { PageShell } from '@/components/PageShell';
import { DateTile } from '@/components/DateTile';
import { Chip } from '@/components/Chip';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError, type HistoricoItem } from '@/lib/api';
import { formatarFimDeSemana } from '@/lib/datas';

const WHATSAPP = import.meta.env.VITE_CX_WHATSAPP ?? '5562981396751';

export default function HistoricoImersoes() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<{ historico: HistoricoItem[] }>('/api/me/historico');
        if (!cancelled) setHistorico(r.historico);
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof ApiError ? err.message : 'Erro ao carregar histórico');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const temFalta = historico.some((h) => h.statusPresenca === 'faltou');

  return (
    <PageShell>
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/app')}
          aria-label="Voltar"
          className="flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground active:scale-95"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Histórico
        </div>
        <div className="size-10" />
      </div>

      <h2 className="serif text-[32px] leading-[1.05]">
        Sua jornada
        <br />
        <span className="italic-accent">presencial</span>.
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {loading
          ? 'Carregando…'
          : historico.length === 0
            ? 'Você ainda não participou de nenhuma imersão.'
            : `${historico.length} ${historico.length === 1 ? 'imersão registrada' : 'imersões registradas'}`}
      </p>

      {!loading && temFalta ? (
        <a
          href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Olá, faltei em uma imersão e gostaria de resolver minha pendência.')}`}
          target="_blank"
          rel="noreferrer"
          className="mt-5 flex items-start gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 transition active:scale-[.99]"
        >
          <MessageCircle className="mt-0.5 size-5 shrink-0 text-accent" strokeWidth={1.8} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-accent-ink">
              Você tem pendência por falta
            </p>
            <p className="mt-1 text-xs leading-relaxed text-accent-ink/85">
              Faltou em uma ou mais imersões. Entre em contato com o suporte para
              resolver sua pendência.
            </p>
          </div>
        </a>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : historico.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {historico.map((h) => (
              <li
                key={`${h.idImersao}-${h.tipoId}`}
                className="rounded-2xl border bg-card p-4 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <DateTile date={h.dataImersao} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <Chip tone="neutral">{h.tipo}</Chip>
                      {h.statusPresenca === 'presente' ? (
                        <Chip tone="ok">Presente</Chip>
                      ) : h.statusPresenca === 'faltou' ? (
                        <Chip tone="accent">Faltou</Chip>
                      ) : (
                        <Chip tone="outline">Aguardando registro</Chip>
                      )}
                    </div>
                    <p className="mt-2 text-sm font-medium leading-tight">
                      {formatarFimDeSemana(h.dataImersao)}
                    </p>
                    {h.statusPresenca === 'faltou' ? (
                      <p className="mt-1.5 text-xs leading-relaxed text-accent-ink">
                        Você precisa resolver essa pendência — fale com o suporte.
                      </p>
                    ) : null}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageShell>
  );
}

function EmptyState() {
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <CalendarHeart className="size-6" strokeWidth={1.6} />
      </div>
      <p className="font-medium">Sem histórico ainda</p>
      <p className="mt-1 max-w-[280px] text-sm text-muted-foreground">
        Quando você participar de uma imersão, ela aparecerá aqui com o registro
        da sua presença.
      </p>
    </div>
  );
}
