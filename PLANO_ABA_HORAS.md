# Aba "Horas" no portal do aluno — registro acadêmico + PDF

> Plano de implementação para o Claude Code aberto em `C:\devVini\aluno-imersao`.
> Autocontido. Inclui o template HTML do PDF na íntegra.
>
> Fonte canônica: `admin-plantao-flexivel/src/components/horas/HorasAlunoDialog.tsx`.
> **Não alterar o admin** — ele já está pronto e é a referência.

---

## 1. Objetivo

Criar uma aba **"Horas"** no portal do aluno onde o aluno **logado** vê o
próprio **registro acadêmico** (histórico de atividades da LM):

- Resumo: data de entrada na pós, matrícula, **total de horas práticas**.
- Composição das horas (plantões + imersões + checkpoints).
- Históricos: plantões realizados, imersões com presença, checkpoints.

No **topo da página**, um botão **"Salvar PDF"** gera exatamente o mesmo
PDF que o admin gera hoje na tela "Horas de Alunos" — o aluno baixa o
histórico das atividades dele.

### Regra de conversão de horas (idêntica ao admin)

| Atividade | Vale |
|-----------|------|
| 1 plantão realizado | 8 horas |
| 1 período de imersão com presença | 5 horas (300 min) |
| 1 checkpoint | 2 horas (120 min) |

Cada imersão tem 4 períodos (`sábado manhã/tarde`, `domingo manhã/tarde`);
conta-se cada período marcado como presente.

---

## 2. Diferenças admin → portal do aluno

| Aspecto | Admin | Portal do aluno |
|---------|-------|-----------------|
| Quem é o alvo | admin escolhe o aluno num dialog | sempre o **aluno logado** (`matricula` do JWT) |
| Onde aparece | Dialog (`HorasAlunoDialog`) | **página/aba** dedicada |
| Botão PDF | dentro do dialog | **no topo da página** |
| Hospital | filtra plantões por `HospitalContext` | **sem filtro de hospital** |
| Dados | hooks React Query (`usePlantoes`, etc.) | endpoint próprio `GET /me/horas` |

A geração do PDF (`window.open` + `window.print`) e o cálculo de horas são
**idênticos** — copiados sem alteração.

---

## 3. Backend NestJS — `GET /me/horas`

Adicionar um endpoint no padrão `/me/*` (mesmo do `/me/inscricoes`).

### Controller — `apps/api/src/me/me.controller.ts`

```ts
@Get('horas')
async horas(@Req() req) {
  return this.meService.getHoras(req.user.matricula);
}
```

(Usar o mesmo guard JWT já aplicado nos outros endpoints `/me/*`.)

### Service — `apps/api/src/me/...service.ts`

`getHoras(matricula: string)` faz 4 consultas Prisma no schema `lovable`:

1. **Aluno** — `pf_alunos` por `matricula`:
   campos `nome`, `matricula`, `criado_em`.

2. **Plantões realizados** — `pf_plantoes`:
   `WHERE matricula = ? AND status = 'Realizado'`.
   Campos: `matricula`, `data_plantao` (string DD/MM/YYYY), `status`,
   `hospital_nome` (se houver join/coluna; pode vir null).

3. **Agendamentos de imersão** — `pf_imersoes_agendamento`:
   `WHERE matricula = ?`.
   Campos: `matricula`, `id_imersao`, `presenca_sabado_manha`,
   `presenca_sabado_tarde`, `presenca_domingo_manha`,
   `presenca_domingo_tarde` + JOIN com `pf_imersoes1` (`data_imersao`) e
   `pf_imersoes_tipo` (`tipo` AS `tipo_nome`).
   > Não filtrar por status do agendamento aqui — o filtro do PDF é "tem
   > presença em ao menos um período", aplicado no front.

4. **Checkpoints** — `pf_checkpoints`:
   `WHERE matricula = ?`.
   Campos: `matricula`, `data` (DD/MM/YYYY), `hora`, `data_hora` (ISO).

**Resposta JSON** (dados crus — o cálculo é no front):
```json
{
  "aluno":        { "nome": "...", "matricula": "...", "criado_em": "..." },
  "plantoes":     [ { "data_plantao": "...", "status": "Realizado", "hospital_nome": "..." } ],
  "agendamentos": [ { "id_imersao": 1, "data_imersao": "...", "tipo_nome": "...",
                      "presenca_sabado_manha": true, "presenca_sabado_tarde": false,
                      "presenca_domingo_manha": null, "presenca_domingo_tarde": null } ],
  "checkpoints":  [ { "data": "12/05/2026", "hora": "19:00", "data_hora": "..." } ]
}
```

> Se `pf_plantoes` ou `pf_checkpoints` ainda não estiverem no
> `schema.prisma`, rodar **`prisma db pull`** e mapear os models (com
> `@@schema("lovable")` / `@@map`). **Não rodar `prisma migrate`** — o
> banco é compartilhado.

---

## 4. Frontend — página "Horas"

### Rota / aba
Adicionar "Horas" à navegação do portal (a localizar em `apps/web/`).

### Hook de dados
Um hook que faz `GET /me/horas` e devolve `{ aluno, plantoes,
agendamentos, checkpoints }`.

### Cálculo (replicar exatamente do admin)

Constantes e helpers — copiar verbatim:

```ts
const HORAS_POR_PLANTAO = 8;
const MINUTOS_POR_PERIODO_IMERSAO = 300; // 5h
const MINUTOS_POR_CHECKPOINT = 120;      // 2h

const PRESENCA_KEYS = [
  'presenca_sabado_manha',
  'presenca_sabado_tarde',
  'presenca_domingo_manha',
  'presenca_domingo_tarde',
] as const;

const PRESENCA_LABELS = {
  presenca_sabado_manha: 'Sáb manhã',
  presenca_sabado_tarde: 'Sáb tarde',
  presenca_domingo_manha: 'Dom manhã',
  presenca_domingo_tarde: 'Dom tarde',
};

function formatHoras(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h}h`;
  return `${h}h${String(m).padStart(2, '0')}`;
}

function parseBrDate(s?: string | null): Date | null {
  if (!s) return null;
  const [d, m, y] = s.split('/');
  if (!d || !m || !y) return null;
  return new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
}
```

Cálculo (`useMemo`), idêntico às linhas 72-120 do `HorasAlunoDialog`:

```ts
const calc = useMemo(() => {
  // plantões realizados, ordenados por data
  const realizados = plantoes
    .filter(p => p.matricula === matricula && p.status === 'Realizado')
    .sort((a, b) => (parseBrDate(a.data_plantao)?.getTime() ?? 0)
                  - (parseBrDate(b.data_plantao)?.getTime() ?? 0));

  // imersões com pelo menos 1 período presente
  const imersoesValidas = agendamentos
    .map(a => ({ agendamento: a, periodosPresentes: PRESENCA_KEYS.filter(k => a[k] === true) }))
    .filter(x => x.periodosPresentes.length > 0)
    .sort((a, b) => (a.agendamento.data_imersao ? new Date(a.agendamento.data_imersao).getTime() : 0)
                  - (b.agendamento.data_imersao ? new Date(b.agendamento.data_imersao).getTime() : 0));

  // checkpoints do aluno
  const checkpoints = checkpointsData
    .filter(c => c.matricula === matricula)
    .sort((a, b) => (a.data_hora ? new Date(a.data_hora).getTime() : 0)
                  - (b.data_hora ? new Date(b.data_hora).getTime() : 0));

  const horasPlantoesMin = realizados.length * HORAS_POR_PLANTAO * 60;
  const totalPeriodos = imersoesValidas.reduce((s, x) => s + x.periodosPresentes.length, 0);
  const horasImersoesMin = totalPeriodos * MINUTOS_POR_PERIODO_IMERSAO;
  const horasCheckpointsMin = checkpoints.length * MINUTOS_POR_CHECKPOINT;
  const totalMinutos = horasPlantoesMin + horasImersoesMin + horasCheckpointsMin;

  return { realizados, imersoesValidas, totalPeriodos, checkpoints,
           horasPlantoesMin, horasImersoesMin, horasCheckpointsMin, totalMinutos };
}, [plantoes, agendamentos, checkpointsData, matricula]);
```

### Layout da página
Mesma estrutura visual do dialog do admin, só convertida de Dialog para
página:
- Cabeçalho da página + botão **"Salvar PDF"** no topo (canto direito).
- Grid de 3 cards: Entrada na pós · Matrícula · **Total de horas** (destaque).
- Card "Composição das horas" com 3 linhas (plantões / imersões /
  checkpoints), cada uma com contagem `× 8h/5h/2h` e subtotal.
- Card "Plantões realizados" — badges com as datas.
- Card "Imersões com presença" — lista com tipo, data, períodos e horas.
- Card "Checkpoints" — badges com data/hora.
- Estados vazios: "Nenhum plantão realizado.", etc.

---

## 5. Geração do PDF — `handlePrint`

Copiar verbatim do admin. **Sem biblioteca de PDF** — abre uma janela,
escreve HTML, chama `window.print()`; o aluno salva como PDF pelo diálogo
do navegador.

```ts
function handlePrint() {
  const w = window.open('', '_blank', 'width=900,height=1100');
  if (!w) {
    alert('Pop-up bloqueado. Permita pop-ups para gerar a impressão.');
    return;
  }
  const html = buildPrintableHTML(aluno, calc, dataEntrada); // dataEntrada = aluno.criado_em || '-'
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => { w.print(); }, 250);
}
```

`escapeHtml` — copiar verbatim:

```ts
function escapeHtml(s?: string | null): string {
  if (s == null) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
```

> Datas no PDF usam `date-fns` + locale `ptBR` (`format(new Date(iso),
> 'dd/MM/yyyy', { locale: ptBR })`). O `aluno.criado_em` e
> `plantao.data_plantao` já vêm como string `DD/MM/YYYY` — usar direto.

---

## 6. Template HTML do PDF (íntegra)

`buildPrintableHTML` — copiar **exatamente** esta função. É o que define o
layout do PDF; mantê-la idêntica garante que o PDF do aluno seja igual ao
do admin.

```ts
function buildPrintableHTML(aluno: any, calc: any, dataEntrada: string): string {
  const totalHoras = formatHoras(calc.totalMinutos);
  const horasPlantoes = formatHoras(calc.horasPlantoesMin);
  const horasImersoes = formatHoras(calc.horasImersoesMin);
  const horasCheckpoints = formatHoras(calc.horasCheckpointsMin);

  const plantoesHTML = calc.realizados.length === 0
    ? '<li><em>Nenhum plantão realizado.</em></li>'
    : calc.realizados.map((p: any) =>
        `<li>${escapeHtml(p.data_plantao || '-')}${p.hospital_nome ? ` — ${escapeHtml(p.hospital_nome)}` : ''}</li>`
      ).join('');

  const imersoesHTML = calc.imersoesValidas.length === 0
    ? '<li><em>Nenhuma imersão com presença confirmada.</em></li>'
    : calc.imersoesValidas.map(({ agendamento, periodosPresentes }: any) => {
        const data = agendamento.data_imersao
          ? format(new Date(agendamento.data_imersao), 'dd/MM/yyyy', { locale: ptBR }) : '-';
        const tipo = agendamento.tipo_nome || 'Sem tipo';
        const periodos = periodosPresentes.map((k: string) => PRESENCA_LABELS[k]).join(', ');
        const horas = formatHoras(periodosPresentes.length * MINUTOS_POR_PERIODO_IMERSAO);
        return `<li><strong>${escapeHtml(data)}</strong> — ${escapeHtml(tipo)} <em>(${escapeHtml(periodos)}, ${escapeHtml(horas)})</em></li>`;
      }).join('');

  const checkpointsHTML = calc.checkpoints.length === 0
    ? '<li><em>Nenhum checkpoint registrado.</em></li>'
    : calc.checkpoints.map((c: any) => {
        const data = c.data || (c.data_hora ? format(new Date(c.data_hora), 'dd/MM/yyyy', { locale: ptBR }) : '-');
        const hora = c.hora ? ` <em>${escapeHtml(c.hora)}</em>` : '';
        return `<li>${escapeHtml(data)}${hora}</li>`;
      }).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="UTF-8">
    <title>Horas de Prática — ${escapeHtml(aluno.nome || aluno.matricula)}</title>
    <style>
        @page { size: A4; margin: 18mm 16mm; }
        * { box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Arial, sans-serif;
            color: #1a1a1a;
            line-height: 1.45;
            margin: 0;
        }
        h1 {
            font-size: 22px;
            margin: 0 0 4px 0;
            color: #0a4f9c;
            border-bottom: 2px solid #0a4f9c;
            padding-bottom: 8px;
        }
        .subtitle { color: #555; font-size: 12px; margin-bottom: 24px; }
        .info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 12px;
            margin-bottom: 24px;
        }
        .info-card {
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 10px 12px;
        }
        .info-card .label {
            font-size: 11px;
            color: #777;
            text-transform: uppercase;
            letter-spacing: 0.4px;
        }
        .info-card .value {
            font-size: 16px;
            font-weight: 600;
            margin-top: 2px;
        }
        .info-card.highlight {
            background: #f0f7ff;
            border-color: #0a4f9c;
        }
        .info-card.highlight .value {
            font-size: 22px;
            color: #0a4f9c;
        }
        h2 {
            font-size: 14px;
            color: #0a4f9c;
            margin: 20px 0 8px 0;
            padding-bottom: 4px;
            border-bottom: 1px solid #ddd;
        }
        .breakdown {
            display: flex;
            justify-content: space-between;
            padding: 8px 12px;
            background: #f8f9fa;
            border-radius: 4px;
            margin-bottom: 6px;
            font-size: 13px;
        }
        ul {
            list-style: none;
            padding: 0;
            margin: 0;
            font-size: 12px;
            columns: 2;
            column-gap: 20px;
        }
        ul li {
            padding: 3px 0;
            break-inside: avoid;
        }
        .footer {
            margin-top: 32px;
            font-size: 10px;
            color: #999;
            text-align: center;
            border-top: 1px solid #eee;
            padding-top: 12px;
        }
        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>
    <h1>Horas de Prática</h1>
    <div class="subtitle">Liberdade Médica · Pós-Graduação · Documento gerado em ${escapeHtml(format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }))}</div>

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
```

### Notas sobre o template
- **Sem logo/imagem** — apenas o texto institucional "Liberdade Médica ·
  Pós-Graduação". Não introduzir imagem (manter paridade com o admin).
- Cor institucional: `#0a4f9c`. Fonte: Segoe UI / Arial.
- A4, margens 18mm × 16mm. `@media print` força cores exatas.
- Listas de plantões e checkpoints em 2 colunas; imersões em 1 coluna.

---

## 7. Nome do arquivo PDF

O navegador sugere o nome a partir da tag `<title>` — hoje
`Horas de Prática — {nome}`. Duas opções:
- **Manter como está** (zero código) — recomendado pela paridade com o
  admin.
- Opcional: trocar o `<title>` para `Registro LM - {matricula}` se
  preferir um nome de arquivo mais curto/padronizado.

---

## 8. Testes

1. `GET /me/horas` autenticado → retorna `aluno` + os 3 arrays só do
   aluno do JWT. Sem token → 401.
2. Página "Horas" renderiza: total de horas = soma dos 3 breakdowns.
3. Botão "Salvar PDF" abre a janela de impressão com o layout correto
   (cabeçalho azul, info-grid, breakdown, listas, rodapé).
4. **Paridade:** gerar o PDF do mesmo aluno no admin e no portal →
   conteúdo e layout idênticos.
5. Aluno sem plantões/imersões/checkpoints → PDF com "Nenhum..." em cada
   seção e total `0h`.
6. Pop-up bloqueado → alerta "Permita pop-ups...".

---

## 9. Fora de escopo

- Alterar o `admin-plantao-flexivel` (fonte canônica, intocada).
- Trocar `window.print()` por biblioteca de PDF.
- Logo em imagem no PDF.
- Recalcular horas no backend (o cálculo é no front, espelhando o admin).

## Arquivos a criar/modificar (neste repo)

- `apps/api/src/me/me.controller.ts` — `GET /me/horas`
- `apps/api/src/me/*.service.ts` — `getHoras(matricula)` com 4 queries
- `prisma/schema.prisma` — confirmar/mapear `pf_plantoes`, `pf_checkpoints`
  (via `prisma db pull` se faltarem)
- `apps/web/` — nova página/aba "Horas" + hook + `buildPrintableHTML` /
  `handlePrint` / helpers

## Resumo de uma linha

> Aba "Horas" mostra o registro acadêmico do aluno logado (plantões +
> imersões + checkpoints convertidos em horas) e um botão "Salvar PDF" que
> abre `window.print()` sobre o HTML transcrito na seção 6 — PDF idêntico
> ao do admin.
