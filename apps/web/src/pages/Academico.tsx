import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CalendarCheck,
  ChevronLeft,
  ClipboardCheck,
  Download,
  Info,
  Stethoscope,
} from 'lucide-react';
import { toast } from 'sonner';

import { PageShell } from '@/components/PageShell';
import { Chip } from '@/components/Chip';
import { Skeleton } from '@/components/ui/skeleton';
import { api, ApiError } from '@/lib/api';
import { formatarFimDeSemana } from '@/lib/datas';
import {
  calcularHoras,
  formatHoras,
  handlePrint,
  PRESENCA_LABELS,
  type HorasCalc,
  type HorasResponse,
} from '@/lib/horas';

export default function Academico() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<HorasResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<HorasResponse>('/api/me/horas');
        if (!cancelled) setData(r);
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

  const calc: HorasCalc | null = data ? calcularHoras(data) : null;
  const dataEntrada = data?.aluno.criado_em || '—';

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
          Acadêmico
        </div>
        <div className="size-10" />
      </div>

      <h2 className="serif text-[32px] leading-[1.05]">
        Seu registro
        <br />
        <span className="italic-accent">acadêmico</span>.
      </h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Plantões, imersões e checkpoints convertidos em horas de prática.
      </p>

      <button
        type="button"
        disabled={!calc || !data}
        onClick={() => data && calc && handlePrint(data.aluno, calc, dataEntrada)}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-sm font-medium text-on-ink transition active:scale-[.99] disabled:opacity-40"
      >
        <Download className="size-4" strokeWidth={1.8} />
        Salvar PDF do histórico
      </button>

      <div className="mt-4 flex items-start gap-2.5 rounded-2xl border border-line bg-secondary/60 p-3.5">
        <Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" strokeWidth={1.8} />
        <p className="text-xs leading-relaxed text-muted-foreground">
          Os dados exibidos são referentes a{' '}
          <strong className="text-foreground">dezembro de 2025</strong> em diante.
          Para registros anteriores, consulte o suporte acadêmico.
        </p>
      </div>

      {loading ? (
        <div className="mt-6 space-y-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !data || !calc ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          Não foi possível carregar seu registro.
        </p>
      ) : (
        <>
          {/* Resumo */}
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border bg-card p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Turma
              </div>
              <div className="mt-1 text-sm font-medium">{data.aluno.turma ?? '—'}</div>
            </div>
            <div className="rounded-2xl border bg-card p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Matrícula
              </div>
              <div className="mono mt-1 text-sm font-medium">{data.aluno.matricula}</div>
            </div>
            <div className="col-span-2 rounded-2xl border bg-card p-4">
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Entrada na pós
              </div>
              <div className="mt-1 text-sm font-medium">{dataEntrada}</div>
            </div>
          </div>
          <div className="mt-2.5 rounded-2xl bg-ink p-5 text-on-ink">
            <div className="text-[11px] uppercase tracking-widest text-on-ink-muted">
              Total de horas práticas
            </div>
            <div className="serif mt-1 text-[42px] leading-none">
              {formatHoras(calc.totalMinutos)}
            </div>
          </div>

          {/* Composição */}
          <SectionTitle>Composição das horas</SectionTitle>
          <div className="divide-y rounded-2xl border bg-card">
            <CompRow
              label="Plantões realizados"
              detalhe={`${calc.realizados.length} × 8h`}
              total={formatHoras(calc.horasPlantoesMin)}
            />
            <CompRow
              label="Períodos de imersão com presença"
              detalhe={`${calc.totalPeriodos} × 5h`}
              total={formatHoras(calc.horasImersoesMin)}
            />
            <CompRow
              label="Checkpoints"
              detalhe={`${calc.checkpoints.length} × 2h`}
              total={formatHoras(calc.horasCheckpointsMin)}
            />
          </div>

          {/* Plantões */}
          <SectionTitle>
            <Stethoscope className="size-4" strokeWidth={1.8} />
            Plantões realizados ({calc.realizados.length})
          </SectionTitle>
          {calc.realizados.length === 0 ? (
            <Vazio>Nenhum plantão realizado ainda.</Vazio>
          ) : (
            <ul className="space-y-2">
              {calc.realizados.map((p, i) => (
                <li
                  key={`${p.data_plantao}-${i}`}
                  className="flex items-center justify-between gap-3 rounded-2xl border bg-card px-4 py-3"
                >
                  <span className="text-sm font-medium">{p.data_plantao || '—'}</span>
                  {p.hospital_nome ? (
                    <span className="truncate text-xs text-muted-foreground">
                      {p.hospital_nome}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {/* Imersões com presença */}
          <SectionTitle>
            <CalendarCheck className="size-4" strokeWidth={1.8} />
            Imersões com presença ({calc.imersoesValidas.length})
          </SectionTitle>
          {calc.imersoesValidas.length === 0 ? (
            <Vazio>Nenhuma imersão com presença confirmada.</Vazio>
          ) : (
            <ul className="space-y-2">
              {calc.imersoesValidas.map(({ agendamento, periodosPresentes }) => (
                <li
                  key={agendamento.id_imersao}
                  className="rounded-2xl border bg-card p-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium">
                      {agendamento.tipo_nome || 'Imersão'}
                    </span>
                    <Chip tone="ok">
                      {formatHoras(periodosPresentes.length * 300)}
                    </Chip>
                  </div>
                  {agendamento.data_imersao ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {formatarFimDeSemana(agendamento.data_imersao)}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {periodosPresentes.map((k) => (
                      <Chip key={k} tone="outline">
                        {PRESENCA_LABELS[k]}
                      </Chip>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}

          {/* Checkpoints */}
          <SectionTitle>
            <ClipboardCheck className="size-4" strokeWidth={1.8} />
            Checkpoints ({calc.checkpoints.length})
          </SectionTitle>
          {calc.checkpoints.length === 0 ? (
            <Vazio>Nenhum checkpoint registrado.</Vazio>
          ) : (
            <ul className="flex flex-wrap gap-2">
              {calc.checkpoints.map((c, i) => (
                <li
                  key={`${c.data}-${c.hora}-${i}`}
                  className="rounded-xl border bg-card px-3 py-2 text-xs"
                >
                  <span className="font-medium">{c.data || '—'}</span>
                  {c.hora ? (
                    <span className="text-muted-foreground"> · {c.hora}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
            Cada plantão vale 8h · cada período de imersão presente vale 5h · cada
            checkpoint vale 2h.
          </p>
        </>
      )}
    </PageShell>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-7 mb-2 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
      {children}
    </div>
  );
}

function CompRow({
  label,
  detalhe,
  total,
}: {
  label: string;
  detalhe: string;
  total: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm">{label}</p>
        <p className="text-xs text-muted-foreground">{detalhe}</p>
      </div>
      <span className="shrink-0 text-sm font-semibold">{total}</span>
    </div>
  );
}

function Vazio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card/50 px-4 py-5 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}
