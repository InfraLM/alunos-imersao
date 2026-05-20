import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { CalendarX2, ChevronLeft, ChevronRight, Loader2, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';

import { PageShell } from '@/components/PageShell';
import { Chip } from '@/components/Chip';
import { DateTile } from '@/components/DateTile';
import { Skeleton } from '@/components/ui/skeleton';
import { BottomSheet } from '@/components/BottomSheet';
import { api, ApiError, type ImersaoDisponivel, type MinhaInscricao } from '@/lib/api';
import { formatarDataLonga } from '@/lib/datas';
import { formatarLocal } from '@/lib/imersao';

export default function ReagendarLista() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const idAtual = Number(id);

  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState<number | null>(null);
  const [atual, setAtual] = useState<MinhaInscricao | null>(null);
  const [imersoes, setImersoes] = useState<ImersaoDisponivel[]>([]);
  const [confirmando, setConfirmando] = useState<ImersaoDisponivel | null>(null);

  const imersoesMesmoTipo = atual
    ? imersoes.filter((im) => im.tipo.idTipo === atual.tipoId)
    : [];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [minhas, disp] = await Promise.all([
          api.get<{ inscricoes: MinhaInscricao[] }>('/api/me/inscricoes'),
          api.get<{ imersoes: ImersaoDisponivel[] }>('/api/imersoes/disponiveis'),
        ]);
        if (cancelled) return;
        const found = minhas.inscricoes.find((i) => i.idImersao === idAtual) ?? null;
        if (!found) {
          toast.error('Inscrição atual não encontrada');
          navigate('/app/minhas', { replace: true });
          return;
        }
        setAtual(found);
        setImersoes(disp.imersoes);
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
  }, [idAtual, navigate]);

  async function escolher(novaId: number) {
    if (submittingId !== null) return;
    setSubmittingId(novaId);
    try {
      await api.post(`/api/me/inscricoes/${idAtual}/reagendar`, { novaImersaoId: novaId });
      toast.success(
        atual && !atual.podeAlterarSemFinanceiro
          ? 'Reagendamento registrado. A multa será cobrada pela secretaria.'
          : 'Reagendamento confirmado!',
      );
      navigate('/app/minhas', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && (err.data as any)?.direcionarCx) {
        const data = err.data as any;
        navigate('/app/cx', {
          state: {
            acao: 'reagendar',
            motivo: data.motivo,
            diasRestantes: data.diasRestantes,
          },
        });
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Falha ao reagendar');
      setSubmittingId(null);
    }
  }

  return (
    <PageShell>
      <div className="mb-5 flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/app/minhas')}
          aria-label="Voltar"
          className="flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground active:scale-95"
        >
          <ChevronLeft className="size-5" />
        </button>
        <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Reagendar
        </div>
        <div className="size-10" />
      </div>

      <h2 className="serif text-[30px] leading-[1.05]">
        Escolha uma nova
        <br />
        <span className="italic-accent">data</span>.
      </h2>
      {atual ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Reagendamentos só são permitidos dentro do mesmo tipo de imersão (<strong className="text-foreground">{atual.tipo}</strong>).
        </p>
      ) : null}

      {atual ? (
        <div className="mt-5 rounded-2xl border border-line bg-secondary p-4">
          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Inscrição atual
          </div>
          <div className="mt-2 flex items-center gap-3">
            <DateTile date={atual.dataImersao} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{atual.tipo}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatarDataLonga(atual.dataImersao)}
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-6">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        ) : imersoesMesmoTipo.length === 0 ? (
          <div className="mt-6 flex flex-col items-center text-center">
            <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <CalendarX2 className="size-6" strokeWidth={1.6} />
            </div>
            <p className="font-medium">
              Nenhuma turma de {atual ? `"${atual.tipo}"` : 'mesmo tipo'} disponível
            </p>
            <p className="mt-1 max-w-[280px] text-sm text-muted-foreground">
              Não há outras turmas abertas com o mesmo tipo da sua inscrição atual.
              Tente novamente em breve.
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {imersoesMesmoTipo.map((im) => {
              const submitting = submittingId === im.idImersao;
              return (
                <li key={im.idImersao}>
                  <button
                    type="button"
                    onClick={() =>
                      atual && !atual.podeAlterarSemFinanceiro
                        ? setConfirmando(im)
                        : escolher(im.idImersao)
                    }
                    disabled={submittingId !== null}
                    className="flex w-full items-start gap-3.5 rounded-2xl border bg-card p-4 text-left shadow-sm transition active:scale-[.99] disabled:opacity-50 hover:border-line-strong"
                  >
                    <DateTile date={im.dataImersao} size="md" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Chip tone="neutral">{im.tipo.nome}</Chip>
                        {im.vagasRestantes <= 3 ? (
                          <Chip tone="accent" dot>
                            Últimas vagas
                          </Chip>
                        ) : null}
                      </div>
                      <p className="mt-2 text-[15px] font-medium leading-tight">
                        {formatarDataLonga(im.dataImersao)}
                      </p>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <Users className="size-3.5" strokeWidth={1.6} />
                        <span>
                          {im.vagasRestantes} de {im.vagasTotal} vagas
                        </span>
                      </div>
                      {formatarLocal(im.local, im.cidade, im.estado) ? (
                        <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
                          <MapPin className="size-3.5 shrink-0" strokeWidth={1.6} />
                          <span className="truncate">
                            {formatarLocal(im.local, im.cidade, im.estado)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    {submitting ? (
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    ) : (
                      <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <BottomSheet
        open={!!confirmando}
        onOpenChange={(o) => submittingId === null && !o && setConfirmando(null)}
        title="Reagendar gera multa"
        description="Sua imersão atual é em menos de 15 dias."
      >
        {confirmando ? (
          <>
            <div className="rounded-2xl bg-background p-4">
              <div className="flex items-center gap-3">
                <DateTile date={confirmando.dataImersao} size="sm" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Nova data</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatarDataLonga(confirmando.dataImersao)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-accent/30 bg-accent-soft p-3.5 text-xs leading-relaxed text-accent-ink">
              Faltam menos de 15 dias para a sua imersão atual. O reagendamento será feito
              normalmente, mas gera uma multa, cobrada depois pela secretaria.
            </div>

            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={() => setConfirmando(null)}
                disabled={submittingId !== null}
                className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-line bg-card font-medium active:scale-[.99] disabled:opacity-50"
              >
                Voltar
              </button>
              <button
                type="button"
                onClick={() => escolher(confirmando.idImersao)}
                disabled={submittingId !== null}
                className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-accent font-medium text-on-ink active:scale-[.99] disabled:opacity-50"
              >
                {submittingId !== null ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  'Confirmar reagendamento'
                )}
              </button>
            </div>
          </>
        ) : null}
      </BottomSheet>
    </PageShell>
  );
}
