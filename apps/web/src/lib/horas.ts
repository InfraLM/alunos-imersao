import { formatarDataCurta } from './datas';

/**
 * Registro acadêmico do aluno: conversão de atividades em horas de prática.
 * Regra idêntica ao admin-plantao-flexivel (HorasAlunoDialog):
 *   1 plantão realizado          → 8h
 *   1 período de imersão presente → 5h (300 min)
 *   1 checkpoint                  → 2h (120 min)
 */

export const HORAS_POR_PLANTAO = 8;
export const MINUTOS_POR_PERIODO_IMERSAO = 300;
export const MINUTOS_POR_CHECKPOINT = 120;

export interface HorasAluno {
  nome: string | null;
  matricula: string;
  criado_em: string | null;
}

export interface HorasPlantao {
  data_plantao: string | null;
  status: string | null;
  hospital_nome: string | null;
}

export interface HorasAgendamento {
  id_imersao: number;
  data_imersao: string | null;
  tipo_nome: string | null;
  presenca_sabado_manha: boolean | null;
  presenca_sabado_tarde: boolean | null;
  presenca_domingo_manha: boolean | null;
  presenca_domingo_tarde: boolean | null;
}

export interface HorasCheckpoint {
  data: string | null;
  hora: string | null;
  data_hora: string | null;
}

export interface HorasResponse {
  aluno: HorasAluno;
  plantoes: HorasPlantao[];
  agendamentos: HorasAgendamento[];
  checkpoints: HorasCheckpoint[];
}

const PRESENCA_KEYS = [
  'presenca_sabado_manha',
  'presenca_sabado_tarde',
  'presenca_domingo_manha',
  'presenca_domingo_tarde',
] as const;

type PresencaKey = (typeof PRESENCA_KEYS)[number];

export const PRESENCA_LABELS: Record<PresencaKey, string> = {
  presenca_sabado_manha: 'Sáb manhã',
  presenca_sabado_tarde: 'Sáb tarde',
  presenca_domingo_manha: 'Dom manhã',
  presenca_domingo_tarde: 'Dom tarde',
};

export interface ImersaoValida {
  agendamento: HorasAgendamento;
  periodosPresentes: PresencaKey[];
}

export interface HorasCalc {
  realizados: HorasPlantao[];
  imersoesValidas: ImersaoValida[];
  totalPeriodos: number;
  checkpoints: HorasCheckpoint[];
  horasPlantoesMin: number;
  horasImersoesMin: number;
  horasCheckpointsMin: number;
  totalMinutos: number;
}

export function formatHoras(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return m === 0 ? `${h}h` : `${h}h${String(m).padStart(2, '0')}`;
}

function parseBrDate(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split('/');
  if (!d || !m || !y) return null;
  return new Date(Number(y), Number(m) - 1, Number(d));
}

export function calcularHoras(data: HorasResponse): HorasCalc {
  const realizados = data.plantoes
    .filter((p) => p.status === 'Realizado')
    .sort(
      (a, b) =>
        (parseBrDate(a.data_plantao)?.getTime() ?? 0) -
        (parseBrDate(b.data_plantao)?.getTime() ?? 0),
    );

  const imersoesValidas: ImersaoValida[] = data.agendamentos
    .map((a) => ({
      agendamento: a,
      periodosPresentes: PRESENCA_KEYS.filter((k) => a[k] === true),
    }))
    .filter((x) => x.periodosPresentes.length > 0)
    .sort(
      (a, b) =>
        (a.agendamento.data_imersao ? new Date(a.agendamento.data_imersao).getTime() : 0) -
        (b.agendamento.data_imersao ? new Date(b.agendamento.data_imersao).getTime() : 0),
    );

  const checkpoints = [...data.checkpoints].sort(
    (a, b) =>
      (a.data_hora ? new Date(a.data_hora).getTime() : 0) -
      (b.data_hora ? new Date(b.data_hora).getTime() : 0),
  );

  const horasPlantoesMin = realizados.length * HORAS_POR_PLANTAO * 60;
  const totalPeriodos = imersoesValidas.reduce((s, x) => s + x.periodosPresentes.length, 0);
  const horasImersoesMin = totalPeriodos * MINUTOS_POR_PERIODO_IMERSAO;
  const horasCheckpointsMin = checkpoints.length * MINUTOS_POR_CHECKPOINT;
  const totalMinutos = horasPlantoesMin + horasImersoesMin + horasCheckpointsMin;

  return {
    realizados,
    imersoesValidas,
    totalPeriodos,
    checkpoints,
    horasPlantoesMin,
    horasImersoesMin,
    horasCheckpointsMin,
    totalMinutos,
  };
}

function escapeHtml(s?: string | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function agoraFormatado(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} às ${p(d.getHours())}:${p(d.getMinutes())}`;
}

/** Monta o HTML imprimível — mesmo layout do PDF gerado pelo admin. */
export function buildPrintableHTML(
  aluno: HorasAluno,
  calc: HorasCalc,
  dataEntrada: string,
): string {
  const totalHoras = formatHoras(calc.totalMinutos);
  const horasPlantoes = formatHoras(calc.horasPlantoesMin);
  const horasImersoes = formatHoras(calc.horasImersoesMin);
  const horasCheckpoints = formatHoras(calc.horasCheckpointsMin);

  const plantoesHTML =
    calc.realizados.length === 0
      ? '<li><em>Nenhum plantão realizado.</em></li>'
      : calc.realizados
          .map(
            (p) =>
              `<li>${escapeHtml(p.data_plantao || '-')}${
                p.hospital_nome ? ` — ${escapeHtml(p.hospital_nome)}` : ''
              }</li>`,
          )
          .join('');

  const imersoesHTML =
    calc.imersoesValidas.length === 0
      ? '<li><em>Nenhuma imersão com presença confirmada.</em></li>'
      : calc.imersoesValidas
          .map(({ agendamento, periodosPresentes }) => {
            const data = agendamento.data_imersao
              ? formatarDataCurta(agendamento.data_imersao)
              : '-';
            const tipo = agendamento.tipo_nome || 'Sem tipo';
            const periodos = periodosPresentes.map((k) => PRESENCA_LABELS[k]).join(', ');
            const horas = formatHoras(periodosPresentes.length * MINUTOS_POR_PERIODO_IMERSAO);
            return `<li><strong>${escapeHtml(data)}</strong> — ${escapeHtml(tipo)} <em>(${escapeHtml(periodos)}, ${escapeHtml(horas)})</em></li>`;
          })
          .join('');

  const checkpointsHTML =
    calc.checkpoints.length === 0
      ? '<li><em>Nenhum checkpoint registrado.</em></li>'
      : calc.checkpoints
          .map((c) => {
            const data =
              c.data || (c.data_hora ? formatarDataCurta(c.data_hora) : '-');
            const hora = c.hora ? ` <em>${escapeHtml(c.hora)}</em>` : '';
            return `<li>${escapeHtml(data)}${hora}</li>`;
          })
          .join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Horas de Prática — ${escapeHtml(aluno.nome || aluno.matricula)}</title>
    <style>
        @page { size: A4; margin: 18mm 16mm; }
        * { box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; line-height: 1.45; margin: 0; }
        h1 { font-size: 22px; margin: 0 0 4px 0; color: #0a4f9c; border-bottom: 2px solid #0a4f9c; padding-bottom: 8px; }
        .subtitle { color: #555; font-size: 12px; margin-bottom: 24px; }
        .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 24px; }
        .info-card { border: 1px solid #ddd; border-radius: 4px; padding: 10px 12px; }
        .info-card .label { font-size: 11px; color: #777; text-transform: uppercase; letter-spacing: 0.4px; }
        .info-card .value { font-size: 16px; font-weight: 600; margin-top: 2px; }
        .info-card.highlight { background: #f0f7ff; border-color: #0a4f9c; }
        .info-card.highlight .value { font-size: 22px; color: #0a4f9c; }
        h2 { font-size: 14px; color: #0a4f9c; margin: 20px 0 8px 0; padding-bottom: 4px; border-bottom: 1px solid #ddd; }
        .breakdown { display: flex; justify-content: space-between; padding: 8px 12px; background: #f8f9fa; border-radius: 4px; margin-bottom: 6px; font-size: 13px; }
        ul { list-style: none; padding: 0; margin: 0; font-size: 12px; columns: 2; column-gap: 20px; }
        ul li { padding: 3px 0; break-inside: avoid; }
        .footer { margin-top: 32px; font-size: 10px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 12px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
    </style>
</head>
<body>
    <h1>Horas de Prática</h1>
    <div class="subtitle">Liberdade Médica · Pós-Graduação · Documento gerado em ${escapeHtml(agoraFormatado())}</div>

    <div class="info-grid">
        <div class="info-card">
            <div class="label">Aluno</div>
            <div class="value">${escapeHtml(aluno.nome || '-')}</div>
        </div>
        <div class="info-card">
            <div class="label">Matrícula</div>
            <div class="value" style="font-family: monospace; font-size: 14px;">${escapeHtml(aluno.matricula)}</div>
        </div>
        <div class="info-card">
            <div class="label">Entrada na pós</div>
            <div class="value">${escapeHtml(dataEntrada)}</div>
        </div>
    </div>

    <div class="info-grid" style="grid-template-columns: 1fr;">
        <div class="info-card highlight">
            <div class="label">Total de horas práticas</div>
            <div class="value">${escapeHtml(totalHoras)}</div>
        </div>
    </div>

    <h2>Composição das horas</h2>
    <div class="breakdown">
        <span><strong>Plantões realizados:</strong> ${calc.realizados.length} × 8h</span>
        <strong>${escapeHtml(horasPlantoes)}</strong>
    </div>
    <div class="breakdown">
        <span><strong>Períodos de imersão com presença:</strong> ${calc.totalPeriodos} × 5h</span>
        <strong>${escapeHtml(horasImersoes)}</strong>
    </div>
    <div class="breakdown">
        <span><strong>Checkpoints com presença:</strong> ${calc.checkpoints.length} × 2h</span>
        <strong>${escapeHtml(horasCheckpoints)}</strong>
    </div>

    <h2>Plantões realizados (${calc.realizados.length})</h2>
    <ul>${plantoesHTML}</ul>

    <h2>Imersões com presença confirmada (${calc.imersoesValidas.length})</h2>
    <ul style="columns: 1;">${imersoesHTML}</ul>

    <h2>Checkpoints (${calc.checkpoints.length})</h2>
    <ul>${checkpointsHTML}</ul>

    <div class="footer">
        Cada plantão equivale a 8h. Cada período de presença em imersão equivale a 5h. Cada checkpoint equivale a 2h.
    </div>
</body>
</html>`;
}

/** Abre uma janela com o HTML imprimível e dispara o diálogo de impressão. */
export function handlePrint(aluno: HorasAluno, calc: HorasCalc, dataEntrada: string): void {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) {
    alert('Pop-up bloqueado. Permita pop-ups para gerar o PDF.');
    return;
  }
  w.document.write(buildPrintableHTML(aluno, calc, dataEntrada));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 250);
}
