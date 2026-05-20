import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowRight, Calendar, ChevronLeft, ClipboardCheck, Loader2, MapPin, ShieldCheck, Users } from 'lucide-react';
import { toast } from 'sonner';

import { PageShell } from '@/components/PageShell';
import { BottomSheet } from '@/components/BottomSheet';
import { Chip } from '@/components/Chip';
import { InfoRow } from '@/components/InfoRow';
import { DateTile } from '@/components/DateTile';
import { Wordmark } from '@/components/Wordmark';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError, type ImersaoDisponivel } from '@/lib/api';
import { formatarDataLonga } from '@/lib/datas';
import { formatarLocal } from '@/lib/imersao';

export default function AgendarConfirmacao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [imersao, setImersao] = useState<ImersaoDisponivel | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [openSheet, setOpenSheet] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<ImersaoDisponivel>(`/api/imersoes/${id}`);
        if (!cancelled) setImersao(r);
      } catch (err) {
        if (cancelled) return;
        toast.error(err instanceof ApiError ? err.message : 'Imersão não encontrada');
        navigate('/app/agendar', { replace: true });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  async function confirmar() {
    if (!imersao || submitting) return;
    setSubmitting(true);
    try {
      await api.post(`/api/imersoes/${imersao.idImersao}/inscrever`);
      navigate(`/app/sucesso/${imersao.idImersao}`, { replace: true });
    } catch (err) {
      if (err instanceof ApiError && (err.data as any)?.direcionarCx) {
        const data = err.data as any;
        navigate('/app/cx', {
          state: {
            acao: 'inscrever',
            motivo: data.motivo,
            diasRestantes: data.diasRestantes,
          },
          replace: true,
        });
        return;
      }
      toast.error(err instanceof ApiError ? err.message : 'Falha ao confirmar');
      setSubmitting(false);
      setOpenSheet(false);
    }
  }

  if (loading || !imersao) {
    return (
      <PageShell>
        <Skeleton className="mb-4 h-10 w-24" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="mt-4 h-40 w-full" />
      </PageShell>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto w-full max-w-md">
        <div className="bg-ink text-on-ink rounded-b-[28px] px-6 pb-7 pt-12 safe-top">
          <div className="mb-5 flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/app/agendar')}
              aria-label="Voltar"
              className="flex size-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-on-ink active:scale-95"
            >
              <ChevronLeft className="size-5" />
            </button>
            <Wordmark dark />
            <div className="size-10" />
          </div>

          <Chip tone="ink" dot>
            Imersão presencial
          </Chip>
          <h1 className="serif mt-3 text-[36px] leading-[1.0]">
            {imersao.tipo.nome.split(' ')[0]}
            <br />
            <span className="italic-accent">{imersao.tipo.nome.split(' ').slice(1).join(' ') || 'completa'}</span>
          </h1>
          <p className="mt-3 text-sm text-on-ink-muted">
            {formatarDataLonga(imersao.dataImersao)} · Fim de semana presencial
          </p>
        </div>

        <div className="px-6 pb-32 pt-6">
          <div className="rounded-2xl border bg-card">
            <InfoRow
              icon={<Calendar className="size-5" strokeWidth={1.6} />}
              label="Quando"
              value={formatarDataLonga(imersao.dataImersao)}
              sub="Sábado e domingo · 4 períodos"
            />
            <InfoRow
              icon={<ClipboardCheck className="size-5" strokeWidth={1.6} />}
              label="Tipo"
              value={imersao.tipo.nome}
              sub="Imersão presencial da pós-graduação"
            />
            <InfoRow
              icon={<Users className="size-5" strokeWidth={1.6} />}
              label="Vagas"
              value={`${imersao.vagasRestantes} de ${imersao.vagasTotal} disponíveis`}
              sub={imersao.vagasRestantes <= 3 ? 'Restam poucas vagas — confirme rápido' : 'Há vagas confortavelmente'}
            />
            {formatarLocal(imersao.local, imersao.cidade, imersao.estado) ? (
              <InfoRow
                icon={<MapPin className="size-5" strokeWidth={1.6} />}
                label="Local"
                value={formatarLocal(imersao.local, imersao.cidade, imersao.estado) as string}
                sub="Imersão presencial"
              />
            ) : null}
          </div>

          <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-accent/30 bg-accent-soft p-3.5">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-accent" strokeWidth={1.6} />
            <p className="text-xs leading-relaxed text-accent-ink">
              Você pode cancelar ou reagendar gratuitamente <strong>até 15 dias antes</strong> da imersão.
              Após esse prazo, é necessário falar com o suporte.
            </p>
          </div>
        </div>

        <div className="fixed inset-x-0 bottom-0 z-30">
          <div className="mx-auto max-w-md border-t border-line bg-background px-6 py-3 safe-bottom">
            <div className="flex items-center gap-3">
              <DateTile date={imersao.dataImersao} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                  Selecionada
                </p>
                <p className="truncate text-sm font-medium">{imersao.tipo.nome}</p>
              </div>
              <button
                type="button"
                onClick={() => setOpenSheet(true)}
                className="flex h-12 items-center gap-2 rounded-2xl bg-ink px-5 text-sm font-medium text-on-ink active:scale-[.99]"
              >
                Reservar vaga
                <ArrowRight className="size-4" strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <BottomSheet
        open={openSheet}
        onOpenChange={(o) => !submitting && setOpenSheet(o)}
        title="Confirmar reserva"
        description="Revise os detalhes antes de garantir sua vaga."
      >
        <div className="rounded-2xl bg-background p-4">
          <div className="flex items-center gap-3">
            <DateTile date={imersao.dataImersao} size="sm" />
            <div className="min-w-0">
              <p className="text-sm font-medium">{imersao.tipo.nome}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatarDataLonga(imersao.dataImersao)}
              </p>
            </div>
          </div>
          <div className="my-3 h-px bg-line" />
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Vagas restantes</span>
              <span className="font-medium">{imersao.vagasRestantes}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Modalidade</span>
              <span className="font-medium">Presencial</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Cancelamento livre</span>
              <span className="font-medium">Até 15 dias antes</span>
            </div>
          </div>
        </div>

        <div className="mt-5 flex gap-2.5">
          <button
            type="button"
            onClick={() => setOpenSheet(false)}
            disabled={submitting}
            className="flex h-12 flex-1 items-center justify-center rounded-2xl border border-line bg-card font-medium active:scale-[.99] disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={confirmar}
            disabled={submitting}
            className="flex h-12 flex-[1.4] items-center justify-center gap-2 rounded-2xl bg-ink text-on-ink font-medium active:scale-[.99] disabled:opacity-50"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Confirmar
                <ArrowRight className="size-4" strokeWidth={2} />
              </>
            )}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
}
