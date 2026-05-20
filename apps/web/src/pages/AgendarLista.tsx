import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CalendarX2, ChevronLeft, ChevronRight, MapPin, Users } from 'lucide-react';
import { toast } from 'sonner';

import { PageShell } from '@/components/PageShell';
import { DateTile } from '@/components/DateTile';
import { Chip } from '@/components/Chip';
import { StatusBanner } from '@/components/StatusBanner';
import { Skeleton } from '@/components/ui/skeleton';
import { useSession } from '@/hooks/useSession';
import { api, ApiError, type ImersaoDisponivel } from '@/lib/api';
import { formatarDataLonga } from '@/lib/datas';
import { formatarLocal } from '@/lib/imersao';

export default function AgendarLista() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [loading, setLoading] = useState(true);
  const [imersoes, setImersoes] = useState<ImersaoDisponivel[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<{ imersoes: ImersaoDisponivel[] }>('/api/imersoes/disponiveis');
        if (!cancelled) setImersoes(r.imersoes);
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
          Agendar
        </div>
        <div className="size-10" />
      </div>

      <h2 className="serif text-[32px] leading-[1.05]">
        Escolha a sua próxima
        <br />
        <span className="italic-accent">imersão</span>.
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {loading
          ? 'Carregando turmas disponíveis…'
          : imersoes.length === 0
            ? 'Nenhuma turma disponível no momento.'
            : `${imersoes.length} ${imersoes.length === 1 ? 'turma aberta' : 'turmas abertas'}`}
      </p>

      <div className="mt-5">
        <StatusBanner
          inadimplente={user?.bloqueios?.inadimplente}
          punicao={user?.bloqueios?.punicao}
        />
      </div>

      <div className="mt-1">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        ) : imersoes.length === 0 ? (
          <EmptyState />
        ) : (
          <ul className="space-y-3">
            {imersoes.map((im) => (
              <li key={im.idImersao}>
                <button
                  type="button"
                  onClick={() => navigate(`/app/agendar/${im.idImersao}`)}
                  className="flex w-full items-start gap-3.5 rounded-2xl border bg-card p-4 text-left shadow-sm transition active:scale-[.99] hover:border-line-strong"
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
                    <p className="mt-2 text-[15px] font-medium leading-tight tracking-tight">
                      {formatarDataLonga(im.dataImersao)}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Users className="size-3.5" strokeWidth={1.6} />
                      <span>
                        {im.vagasRestantes} de {im.vagasTotal} vagas
                      </span>
                      <span className="size-0.5 rounded-full bg-muted-foreground/40" />
                      <span>Fim de semana presencial</span>
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
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </button>
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
        <CalendarX2 className="size-6" strokeWidth={1.6} />
      </div>
      <p className="font-medium">Nada por aqui no momento</p>
      <p className="mt-1 max-w-[280px] text-sm text-muted-foreground">
        Pode ser que você já tenha participado dos tipos abertos ou que ainda não haja
        turmas com inscrições abertas. Volte mais tarde.
      </p>
    </div>
  );
}
