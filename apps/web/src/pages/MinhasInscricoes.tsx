import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarHeart, ChevronLeft, ChevronRight, Loader2, MapPin, RotateCw, XCircle } from 'lucide-react';
import { toast } from 'sonner';

import { PageShell } from '@/components/PageShell';
import { Chip } from '@/components/Chip';
import { DateTile } from '@/components/DateTile';
import { StatusBanner } from '@/components/StatusBanner';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomSheet } from '@/components/BottomSheet';
import { useSession } from '@/hooks/useSession';
import { api, ApiError, type MinhaInscricao } from '@/lib/api';
import { formatarDataLonga } from '@/lib/datas';
import { formatarLocal } from '@/lib/imersao';

export default function MinhasInscricoes() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [inscricoes, setInscricoes] = useState<MinhaInscricao[]>([]);
  const [cancelando, setCancelando] = useState<MinhaInscricao | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<{ inscricoes: MinhaInscricao[] }>('/api/me/inscricoes');
        if (!cancelled) setInscricoes(r.inscricoes);
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof ApiError ? err.message : 'Erro ao carregar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function confirmarCancelamento() {
    if (!cancelando || submitting) return;
    setSubmitting(true);
    try {
      await api.del(`/api/me/inscricoes/${cancelando.idImersao}`);
      toast.success('Inscrição cancelada.');
      setInscricoes((arr) => arr.filter((i) => i.idImersao !== cancelando.idImersao));
      setCancelando(null);
    } catch (err) {
      if (err instanceof ApiError && (err.data as any)?.direcionarCx) {
        const data = err.data as any;
        setCancelando(null);
        navigate('/app/cx', {
          state: {
            acao: 'cancelar',
            motivo: data.motivo,
            diasRestantes: data.diasRestantes,
          },
        });
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Falha ao cancelar');
    } finally {
      setSubmitting(false);
    }
  }

  const proxima = inscricoes[0];
  const demais = inscricoes.slice(1);

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
          Minhas inscrições
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
          : inscricoes.length === 0
            ? 'Você ainda não tem inscrições futuras.'
            : `${inscricoes.length} ${inscricoes.length === 1 ? 'imersão agendada' : 'imersões agendadas'}`}
      </p>

      <div className="mt-5">
        <StatusBanner
          inadimplente={user?.bloqueios?.inadimplente}
          punicao={user?.bloqueios?.punicao}
        />
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : inscricoes.length === 0 ? (
        <Empty />
      ) : (
        <>
          <div className="mt-6 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Próxima
          </div>
          <div className="mt-2 rounded-2xl bg-ink p-5 text-on-ink">
            <div className="flex items-center justify-between">
              <Chip tone={proxima.pendenteMulta ? 'accent' : 'ink'} dot>
                {proxima.pendenteMulta
                  ? 'Aguardando pagamento da multa'
                  : proxima.diasRestantes >= 0
                    ? `Em ${proxima.diasRestantes} ${proxima.diasRestantes === 1 ? 'dia' : 'dias'}`
                    : 'Hoje'}
              </Chip>
              <span className="mono text-[11px] text-on-ink-muted">
                LM-{proxima.idImersao}
              </span>
            </div>
            <div className="serif mt-4 text-[24px] leading-tight">{proxima.tipo}</div>
            <div className="mt-3 text-sm text-on-ink-muted">
              {formatarDataLonga(proxima.dataImersao)}
            </div>
            {formatarLocal(proxima.local, proxima.cidade, proxima.estado) ? (
              <div className="mt-1.5 flex items-center gap-2 text-sm text-on-ink-muted">
                <MapPin className="size-4 shrink-0" strokeWidth={1.6} />
                <span>{formatarLocal(proxima.local, proxima.cidade, proxima.estado)}</span>
              </div>
            ) : null}

            {proxima.pendenteMulta ? (
              <p className="mt-3 rounded-xl bg-accent/15 p-3 text-[12px] leading-relaxed text-on-ink">
                {proxima.status === 4
                  ? 'Reagendamento pendente — pague a multa para confirmar a nova data.'
                  : 'Cancelamento pendente — pague a multa para concluir.'}
              </p>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => navigate(`/app/minhas/${proxima.idImersao}/reagendar`)}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] text-sm font-medium text-on-ink active:scale-[.99]"
                >
                  <RotateCw className="size-4" strokeWidth={1.6} /> Reagendar
                </button>
                <button
                  type="button"
                  onClick={() => setCancelando(proxima)}
                  className="flex h-11 items-center justify-center gap-2 rounded-xl border border-accent/30 bg-accent/15 text-sm font-medium text-on-ink active:scale-[.99]"
                >
                  <XCircle className="size-4" strokeWidth={1.6} /> Cancelar
                </button>
              </div>
            )}

            {!proxima.pendenteMulta && !proxima.podeAlterarSemFinanceiro ? (
              <p className="mt-3 text-[11px] text-on-ink-muted">
                Faltam menos de 15 dias — reagendar ou cancelar gera multa, cobrada depois pela secretaria.
              </p>
            ) : null}
          </div>

          {demais.length > 0 ? (
            <>
              <div className="mt-7 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Demais agendadas
              </div>
              <ul className="mt-2 space-y-2.5">
                {demais.map((i) => (
                  <li key={i.idImersao}>
                    <div className="flex items-center gap-3 rounded-2xl border bg-card p-4">
                      <DateTile date={i.dataImersao} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{i.tipo}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {formatarDataLonga(i.dataImersao)}
                        </p>
                        {formatarLocal(i.local, i.cidade, i.estado) ? (
                          <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                            <MapPin className="size-3.5 shrink-0" strokeWidth={1.6} />
                            <span className="truncate">
                              {formatarLocal(i.local, i.cidade, i.estado)}
                            </span>
                          </div>
                        ) : null}
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {i.pendenteMulta ? (
                            <Chip tone="accent">Aguardando pagamento da multa</Chip>
                          ) : i.podeAlterarSemFinanceiro ? (
                            <Chip tone="outline">Em {i.diasRestantes} dias</Chip>
                          ) : (
                            <Chip tone="accent">Gera multa</Chip>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/app/minhas/${i.idImersao}/reagendar`)}
                          disabled={i.pendenteMulta}
                          className="flex size-9 items-center justify-center rounded-lg border bg-card text-foreground active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Reagendar"
                        >
                          <RotateCw className="size-4" strokeWidth={1.6} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setCancelando(i)}
                          disabled={i.pendenteMulta}
                          className="flex size-9 items-center justify-center rounded-lg border border-accent/30 bg-accent-soft text-accent-ink active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                          aria-label="Cancelar"
                        >
                          <XCircle className="size-4" strokeWidth={1.6} />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}

      <BottomSheet
        open={!!cancelando}
        onOpenChange={(o) => !submitting && !o && setCancelando(null)}
        title="Cancelar inscrição"
        description="Você pode agendar outra imersão depois."
      >
        {cancelando ? (
          <>
            <div className="rounded-2xl bg-background p-4">
              <div className="flex items-center gap-3">
                <DateTile date={cancelando.dataImersao} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{cancelando.tipo}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatarDataLonga(cancelando.dataImersao)}
                  </p>
                </div>
              </div>
            </div>

            {!cancelando.podeAlterarSemFinanceiro ? (
              <div className="mt-4 rounded-2xl border border-accent/30 bg-accent-soft p-3.5 text-xs leading-relaxed text-accent-ink">
                Faltam menos de 15 dias para a imersão. O cancelamento será feito normalmente, mas gera uma multa, cobrada depois pela secretaria.
              </div>
            ) : null}

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setCancelando(null)}
                disabled={submitting}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-line bg-card font-medium active:scale-[.99] disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={confirmarCancelamento}
                disabled={submitting}
                className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-accent font-medium text-on-ink active:scale-[.99] disabled:opacity-50"
              >
                {submitting ? <Loader2 className="size-4 animate-spin" /> : 'Cancelar inscrição'}
              </button>
            </div>
          </>
        ) : null}
      </BottomSheet>
    </PageShell>
  );
}

function Empty() {
  const navigate = useNavigate();
  return (
    <div className="mt-10 flex flex-col items-center text-center">
      <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
        <CalendarHeart className="size-6" strokeWidth={1.6} />
      </div>
      <p className="font-medium">Você ainda não tem inscrições</p>
      <p className="mt-1 max-w-[260px] text-sm text-muted-foreground">
        Que tal escolher uma imersão para começar?
      </p>
      <button
        type="button"
        onClick={() => navigate('/app/agendar')}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-2xl bg-ink px-5 text-sm font-medium text-on-ink active:scale-[.99]"
      >
        Ver imersões disponíveis <ChevronRight className="size-4" strokeWidth={2} />
      </button>
    </div>
  );
}
