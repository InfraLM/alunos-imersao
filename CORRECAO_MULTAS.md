# Correção: gerar multa (status 4/5) em vez de bloquear ações <15 dias

> Documento de correção para o Claude Code aberto em `C:\devVini\aluno-imersao`.
> Gerado a partir de investigação cruzada com o `admin-plantao-flexivel`.
>
> **Não toca no `admin-plantao-flexivel`** — aquele app já está correto.
> Toda a correção é neste repo (`aluno-imersao`).

---

## 1. Contexto e diagnóstico

A tabela compartilhada `lovable.pf_imersoes_agendamento` tem coluna `status`:

| status | significado |
|--------|-------------|
| 1 | Agendado |
| 2 | Cancelado |
| 3 | Reagendado |
| 4 | Reagendado com multa pendente |
| 5 | Cancelado com multa pendente |

**Sintoma:** depois de reagendamentos/cancelamentos, nenhuma linha fica em
status 4 ou 5. A fila de multas do admin (`status IN (4,5)`) está sempre
vazia.

**Causa raiz (neste repo):** em `apps/api/src/imersoes/imersoes.service.ts`,
as funções `reagendar` e `cancelar` **lançam `ConflictException`** quando
faltam menos de 15 dias para a imersão (`dias < DIAS_LIMITE`), mandando o
aluno "ligar pro suporte". Como a exceção é lançada **antes** de qualquer
UPDATE, os status 4 e 5 nunca são gravados.

**Regra correta (decisão de produto):** o aluno **pode** reagendar/cancelar
com <15 dias pelo próprio app. A ação é aceita e o registro fica com **multa
pendente** (status 4 ou 5). A multa é cobrada/confirmada depois pela
secretaria, pelo admin-app — não pelo aluno.

**Referência canônica:** o `admin-plantao-flexivel` já implementa a regra
certa em
`backend/src/controllers/imersoes-agendamentos.controller.js`, funções
`reagendar` e `cancel`. Este documento traz o `aluno-imersao` pra mesma
lógica.

### Diferença de comportamento (antes → depois)

| Ação | Antecedência | Hoje (aluno-imersao) | Depois |
|------|--------------|----------------------|--------|
| Reagendar | ≥ 15d | linha antiga → 3 | linha antiga → 3 (igual) |
| Reagendar | < 15d | **409, bloqueado** | linha antiga → **4** |
| Cancelar | ≥ 15d | status → 2 | status → 2 (igual) |
| Cancelar | < 15d | **409, bloqueado** | status → **5** |

Em ambos os casos de reagendamento, a linha nova nasce em status 1 (já
funciona hoje — não muda).

---

## 2. Correção em `reagendar`

**Arquivo:** `apps/api/src/imersoes/imersoes.service.ts`
(função `reagendar`, aproximadamente linhas 208-312).

### 2.1 Remover o bloqueio <15d

Hoje existe (≈ linhas 230-239):

```ts
const dias = diasAteImersao(atual.imersao.dataImersao);
if (dias < DIAS_LIMITE) {
  throw new ConflictException({
    direcionarCx: true,
    motivo: 'prazo',
    diasRestantes: dias,
    mensagem: 'O prazo para reagendamento pelo app expirou (limite de 15 dias antes do evento). Entre em contato com o suporte agora mesmo para que possamos te ajudar.',
  });
}
```

Substituir por um cálculo (sem `throw`):

```ts
const dias = diasAteImersao(atual.imersao.dataImersao);
const exigeMulta = dias < DIAS_LIMITE;
```

> Mantenha qualquer outra validação que exista perto daqui (ex.: imersão já
> ocorreu, imersão de tipo diferente). Só o `throw` de prazo sai.

### 2.2 Definir o status da linha antiga

Hoje o UPDATE da linha antiga fixa `STATUS_REAGENDADO` (≈ linhas 288-290):

```ts
await tx.pfImersoesAgendamento.update({
  where: { matricula_idImersao: { matricula, idImersao: idAtual } },
  data: { status: STATUS_REAGENDADO, statusTimestamp: new Date() },
});
```

Trocar por status condicional:

```ts
const statusAntiga = exigeMulta ? STATUS_REAGENDADO_MULTA : STATUS_REAGENDADO;

await tx.pfImersoesAgendamento.update({
  where: { matricula_idImersao: { matricula, idImersao: idAtual } },
  data: { status: statusAntiga, statusTimestamp: new Date() },
});
```

- `dias >= 15` → `STATUS_REAGENDADO` (3)
- `dias < 15`  → `STATUS_REAGENDADO_MULTA` (4)

O aluno **não paga a multa no app** (não há gateway de pagamento). Então
`<15d` sempre gera **4** — nunca 3 com `pagouMulta=true`. A confirmação do
pagamento é feita depois pela secretaria via admin-app.

### 2.3 Linha nova — sem mudança

A criação/reativação da linha nova em status 1 (via `upsertAgendamentoAtivo`)
continua igual. A linha nova nasce no momento do reagendamento,
independentemente da multa.

---

## 3. Correção em `cancelar`

**Arquivo:** mesmo `imersoes.service.ts` (função de cancelar, ≈ linhas
173-206).

### 3.1 Remover o bloqueio <15d

Hoje (≈ linhas 190-199):

```ts
const dias = diasAteImersao(agendamento.imersao.dataImersao);
if (dias < DIAS_LIMITE) {
  throw new ConflictException({
    direcionarCx: true,
    motivo: 'prazo',
    diasRestantes: dias,
    mensagem: 'O prazo para cancelamento pelo app expirou (limite de 15 dias antes do evento). Entre em contato com o suporte agora mesmo para que possamos te ajudar.',
  });
}
```

Substituir por:

```ts
const dias = diasAteImersao(agendamento.imersao.dataImersao);
const exigeMulta = dias < DIAS_LIMITE;
```

### 3.2 Definir o status do cancelamento

Hoje o UPDATE fixa `STATUS_CANCELADO` (≈ linhas 201-204):

```ts
await this.prisma.pfImersoesAgendamento.update({
  where: { matricula_idImersao: { matricula, idImersao } },
  data: { status: STATUS_CANCELADO, statusTimestamp: new Date() },
});
```

Trocar por:

```ts
const statusCancel = exigeMulta ? STATUS_CANCELADO_MULTA : STATUS_CANCELADO;

await this.prisma.pfImersoesAgendamento.update({
  where: { matricula_idImersao: { matricula, idImersao } },
  data: { status: statusCancel, statusTimestamp: new Date() },
});
```

- `dias >= 15` → `STATUS_CANCELADO` (2)
- `dias < 15`  → `STATUS_CANCELADO_MULTA` (5)

> Confirmar que a constante `STATUS_CANCELADO_MULTA = 5` existe em
> `apps/api/src/imersoes/status.constants.ts`. Se não existir, adicionar.

---

## 4. UI do aluno

Hoje, quando o backend devolve 409 (`direcionarCx: true`), a UI mostra uma
mensagem de erro mandando ligar pro suporte. Depois desta correção o backend
**não devolve mais 409** nesses casos — ele aceita a ação.

Ajustar o fluxo na UI (provavelmente em `apps/web/`):

1. Antes de confirmar reagendamento/cancelamento, calcular se faltam <15
   dias (a UI já tem a `dataImersao`).
2. Se faltar <15 dias, exibir um **aviso de multa** antes de confirmar:
   > "Esta ação será feita com menos de 15 dias da imersão e gera multa.
   > A cobrança será feita pela secretaria. Deseja continuar?"
3. Botão de confirmar prossegue normalmente (chama o mesmo endpoint).
4. **Não** colocar checkbox "paguei a multa" — o aluno não paga no app.
5. Remover o tratamento especial de erro `direcionarCx`/`motivo: 'prazo'`
   para reagendar e cancelar (esse caminho não ocorre mais). Manter o
   tratamento de outros 409 que ainda existirem (ex.: sem vagas, pendência
   de multa anterior).

O Claude Code deste repo localiza o componente exato (telas de reagendar e
cancelar inscrição).

---

## 5. O que NÃO precisa mudar

- **Fila de multas e confirmação de pagamento são do admin.** O
  `admin-plantao-flexivel` já tem `GET /imersoes-agendamentos/multas` e
  `POST /imersoes-agendamentos/:m/:i/confirmar-multa`. **Não duplicar** isso
  no `aluno-imersao`. Basta este app gerar os status 4/5 — o admin lê e
  confirma.
- **`reconciliarMultaPaga`** (transição 4→3 / 5→2 já existente neste repo)
  continua como rede de segurança idempotente. Sem mudança.
- **`upsertAgendamentoAtivo`** continua criando a linha nova em status 1.
  Sem mudança funcional. (Se a sincronia D5 do documento de sintonia ainda
  não foi aplicada — zerar `pagouMulta`/`presenca_*` na reativação — é um
  ajuste separado, fora do escopo desta correção.)
- **DTOs** (`reagendar.dto.ts` etc.) — **não** precisam de campo
  `pagouMulta`. O aluno sempre gera pendência; manter os DTOs como estão.

---

## 6. Sincronia com o admin (depois da correção)

| Ação | Condição | admin-plantao-flexivel | aluno-imersao (corrigido) |
|------|----------|------------------------|----------------------------|
| Reagendar | ≥15d | antiga → 3, nova → 1 | antiga → 3, nova → 1 |
| Reagendar | <15d sem multa | antiga → 4, nova → 1 | antiga → 4, nova → 1 |
| Reagendar | <15d multa paga no ato | antiga → 3 + `pagou_multa=true` | (n/a — aluno não paga no ato) |
| Cancelar | ≥15d | → 2 | → 2 |
| Cancelar | <15d sem multa | → 5 | → 5 |
| Cancelar | <15d multa paga no ato | → 2 + `pagou_multa=true` | (n/a — aluno não paga no ato) |

A única diferença legítima: o admin tem o atalho "multa paga no ato"
(`pagou_multa: true` no body); o aluno não — ele sempre gera 4/5 pendente.
O resultado final converge: ambos geram 4/5 que o admin depois confirma.

---

## 7. Testes

Rodar contra o banco de staging.

1. **Reagendar ≥15d:** linha antiga vira status 3, nova nasce status 1.
2. **Reagendar <15d:** linha antiga vira status **4**, nova nasce status 1.
   Sem erro 409.
3. **Cancelar ≥15d:** status vira 2.
4. **Cancelar <15d:** status vira **5**. Sem erro 409.
5. Depois de gerar um 4 e um 5: abrir o **admin-app**, aba **Multas** → os
   dois registros aparecem na fila.
6. No admin-app, clicar "Confirmar pagamento" em cada → 4→3 e 5→2, somem da
   fila.
7. UI do aluno: ao reagendar/cancelar <15d, o aviso de multa aparece e, ao
   confirmar, a ação conclui com sucesso (sem tela de "ligue pro suporte").

---

## 8. Migration / dados

- **Nenhuma migration de schema.** As colunas `status` e `status_timestamp`
  e as constantes 4/5 já existem.
- Registros já existentes não são afetados.
- Registros legados de alunos que tentaram reagendar/cancelar <15d e foram
  bloqueados **não têm como ser recuperados automaticamente** — não há
  rastro deles na tabela. Se necessário, a secretaria audita manualmente.

---

## Arquivos a modificar (neste repo)

- `apps/api/src/imersoes/imersoes.service.ts` — `reagendar` e `cancelar`
- `apps/api/src/imersoes/status.constants.ts` — confirmar/adicionar
  `STATUS_CANCELADO_MULTA = 5` e `STATUS_REAGENDADO_MULTA = 4`
- UI em `apps/web/` — telas de reagendar e cancelar (aviso de multa +
  remover tratamento de erro de prazo)

## Resumo de uma linha

> Parar de lançar `ConflictException` em `reagendar`/`cancelar` quando
> faltam <15 dias; em vez disso, gravar status **4** (reagendamento) ou
> **5** (cancelamento) — multa pendente — exatamente como o
> `admin-plantao-flexivel` já faz.
