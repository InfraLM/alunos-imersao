# Imersões — Lógica de Agendamento, Cancelamento, Reagendamento e Status

> Documento técnico de referência. Descreve **toda a lógica operacional** que o portal-aluno (`C:\devVini\aluno-imersao`) implementa sobre a tabela compartilhada `lovable.pf_imersoes_agendamento`. Serve como contrato para o app admin (`C:\devVini\admin-plantao-flexivel`) implementar exatamente as mesmas regras quando manipula essa tabela.

**Audiência:** desenvolvedores de ambos os apps.
**Tom:** técnico, citando SQL/Prisma livremente.
**Versão:** v1 (alinhada à v13 do portal-aluno).

---

## 1. Visão geral

Dois aplicativos compartilham o banco PostgreSQL `liberdade-medica` (Google Cloud SQL):

- **portal-aluno** — self-service mobile-first, NestJS + Prisma + React/Vite, deploy Vercel.
- **admin-plantao-flexivel** — painel administrativo do time, Express + `pg`, em produção.

Ambos leem e escrevem na tabela `lovable.pf_imersoes_agendamento`. Essa tabela **não é um snapshot do estado atual**, é um **log do ciclo de vida** de cada par `(matrícula, imersão)`. Uma única linha pode passar por vários status ao longo do tempo, e a coluna `status_timestamp` guarda quando foi a última transição.

A PK composta `(matricula, id_imersao)` garante que cada aluno tem no máximo **uma linha** por imersão. Reutilização é feita via UPDATE (reativação) — nunca via INSERT duplicado.

---

## 2. Modelo de dados

### 2.1 `lovable.pf_imersoes_agendamento` (tabela central)

```sql
CREATE TABLE lovable.pf_imersoes_agendamento (
  matricula              varchar     NOT NULL,
  id_imersao             int4        NOT NULL,
  data_solicitacao       timestamptz NOT NULL DEFAULT now(),
  pagou_multa            bool        NOT NULL DEFAULT false,
  presenca_sabado_manha  bool        NULL,
  presenca_sabado_tarde  bool        NULL,
  presenca_domingo_manha bool        NULL,
  presenca_domingo_tarde bool        NULL,
  status                 int4        NULL,
  status_timestamp       timestamptz NULL,
  CONSTRAINT pf_imersoes_agendamento_pk PRIMARY KEY (matricula, id_imersao),
  CONSTRAINT pf_imersoes_agendamento_aluno_fk
    FOREIGN KEY (matricula) REFERENCES lovable.pf_alunos(matricula)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT pf_imersoes_agendamento_imersao_fk
    FOREIGN KEY (id_imersao) REFERENCES lovable.pf_imersoes1(id_imersao)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT pf_imersoes_agendamento_pf_imersao_status_fk
    FOREIGN KEY (status) REFERENCES lovable.pf_imersao_status(id)
);
CREATE INDEX idx_pf_imersoes_agendamento_imersao
  ON lovable.pf_imersoes_agendamento USING btree (id_imersao);
```

Colunas críticas:

| Coluna | Tipo | Significado |
|--------|------|-------------|
| `matricula` | varchar | FK → `pf_alunos` |
| `id_imersao` | int4 | FK → `pf_imersoes1` |
| `data_solicitacao` | timestamptz | Quando a linha foi inserida ou reativada |
| `pagou_multa` | bool | Default false; true quando admin confirma pagamento da multa |
| `presenca_*` (4 boolean nullable) | bool? | Presença do aluno em cada turno (preenchido pelo admin durante/após a imersão) |
| `status` | int4 → `pf_imersao_status.id` | Fase atual no ciclo de vida (1-5 ou NULL legado) |
| `status_timestamp` | timestamptz | Timestamp da última mudança de status |

### 2.2 `lovable.pf_imersao_status` (catálogo)

```sql
CREATE TABLE lovable.pf_imersao_status (
  id   int4 NOT NULL,
  tipo text NULL,
  CONSTRAINT id_tipo PRIMARY KEY (id)
);

INSERT INTO lovable.pf_imersao_status (id, tipo) VALUES
  (1, 'Agendado'),
  (2, 'Cancelado'),
  (3, 'Reagendado'),
  (4, 'Reagendado com multa pendente'),
  (5, 'Cancelado com multa pendente');
```

### 2.3 Tabelas relacionadas (apenas referência)

- `lovable.pf_alunos` — cadastro do aluno (chave por `matricula`; campos relevantes para regras: `status_financeiro`, `email`, `cpf`).
- `lovable.pf_imersoes1` — catálogo das turmas (chave `id_imersao`; campos: `tipo` (FK → `pf_imersoes_tipo`), `data_imersao`, `vagas`, `data_abertura`).
- `lovable.pf_imersoes_tipo` — catálogo dos tipos de imersão.
- `lovable.pf_punicoes` — restrições temporárias por matrícula.

---

## 3. Catálogo de status

| id | Nome | Conta vaga | Visível no portal | Mutável pelo aluno | Mutável pelo admin | Origem |
|----|------|------------|-------------------|--------------------|--------------------|--------|
| 1 | Agendado | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim | `inscrever()` ou reconciliação `4→3` + criação nova |
| 2 | Cancelado | ❌ Não | ❌ Não | ❌ | ✅ Sim | `cancelar()` (≥15d) ou reconciliação de 5 |
| 3 | Reagendado | ❌ Não | ❌ (histórico) | ❌ | ✅ Sim | `reagendar()` (≥15d) ou reconciliação de 4 |
| 4 | Reagendado com multa pendente | ❌ Não | ✅ Sim (com badge) | ❌ (apenas vê) | ✅ Sim | **Admin** cria ao receber pedido <15d |
| 5 | Cancelado com multa pendente | ❌ Não | ✅ Sim (com badge) | ❌ (apenas vê) | ✅ Sim | **Admin** cria ao receber pedido <15d |
| NULL | (legado = 1) | ✅ Sim | ✅ Sim | ✅ Sim | ✅ Sim | Linhas anteriores à coluna existir |

**Importante:** o status NULL deve ser tratado em todo lugar como equivalente ao status=1 (Agendado). Inscrições legadas inseridas antes da coluna `status` existir vivem com NULL — não normalize migrando para 1 sem necessidade.

> **Nota (pós-sintonia com admin):** NULL não ocorre mais no banco após o backfill executado na PARTE A de `SINTONIA_IMERSOES.md` (linhas legadas viraram `status=1` e a coluna passou a `NOT NULL`). A linha do catálogo acima é mantida para documentar a história e o tratamento defensivo nos filtros (que continua aceitando NULL para evitar regressão).

---

## 4. Máquina de estados

Transições válidas entre os status. Arcos indicam o gatilho.

```
            ┌─────── inscrever (linha nova) ─────────┐
            │                                         ▼
            │                                   ┌──────────┐
            │  inscrever (linha existente 2/3)  │    1     │
            │   ◄─────────────────────────────  │ Agendado │ ◄── reconcil. (4 → 1 da NOVA linha
            │                                   └──┬──┬────┘     já existe nesse momento)
            │                                      │  │
            │                          cancelar    │  │  reagendar  ≥15d
            │                          ≥15d        │  │
            │                                      ▼  ▼
            │                              ┌──────────┐  ┌──────────┐
            │                              │    2     │  │    3     │
            │                              │Cancelado │  │Reagendado│
            │                              └──────────┘  └──────────┘
            │                                   ▲             ▲
            │                                   │             │
            │                          reconcil. │             │ reconcil.
            │                          (5 + multa paga)        (4 + multa paga)
            │                                   │             │
            │                              ┌────┴────┐   ┌────┴─────┐
            │                              │   5     │   │    4     │
            │     admin cria <15d ────────►│Cancelado│   │Reagendado│◄───── admin cria <15d
            │                              │ +multa  │   │  +multa  │       (atual)
            │                              └─────────┘   └──────────┘       + cria NOVA
            │                                                                linha status=1
            └─────[NULL] (legado) ─── reativação implícita (raro)
```

**Regras de transição:**

1. **Aluno só dispara**: `1 → 2` (cancelar ≥15d), `1 → 3` + cria `1` nova (reagendar ≥15d), `nada → 1` (inscrever).
2. **Aluno tenta reativar** (insere de novo em linha 2/3): UPDATE para status=1. Aceito.
3. **Admin dispara**: `1 → 4` + cria nova linha `1`, `1 → 5`, marca `pagou_multa=true`.
4. **Reconciliação automática** (portal-aluno ao ler): `4 + pagou_multa=true → 3`; `5 + pagou_multa=true → 2`.
5. **Status 4 e 5 são terminais sob a perspectiva do aluno** — ele não consegue cancelar/reagendar/inscrever sobre uma linha que está em 4/5.
6. **Transições proibidas**: 2 → 1 (exceto reativação explícita via inscrever), 3 → 1 (idem), 4 → 1, 5 → 1, 2 → 3, 3 → 2, etc. O código rejeita.

---

## 5. Regras de negócio detalhadas

### 5.1 Inscrever

**Endpoint:** `POST /api/imersoes/:id/inscrever` (autenticado por JWT)

**Pré-condições (gates):**
1. Aluno não inadimplente — `pf_alunos.status_financeiro` não casa `/inadimplent/i`. Se inadimplente, lança `ConflictException` com `{ direcionarCx: true, motivo: 'inadimplente' }`.
2. Aluno sem punição vigente — sem linha em `pf_punicoes` com `punicao_fim >= now()`. Se punido, lança com `motivo: 'punicao'`.

**Validações dentro de transação `Serializable`:**
1. Imersão existe — `findUnique` em `pf_imersoes1`. Senão `NotFoundException`.
2. `now >= data_abertura` — senão `BadRequestException` "Inscrições não abertas".
3. `now <= data_imersao` — senão `BadRequestException` "Imersão já ocorreu".
4. Tipo não já participado — não existe linha do aluno com `presenca_* = true` em alguma imersão do mesmo `tipo`. Senão `ConflictException` "Você já participou de uma imersão de '{tipo}'".
5. Vagas — `count` com filtro **VAGA_WHERE** (`status=1 OR NULL`). Se `>= imersao.vagas`, `BadRequestException` "Sem vagas".
6. UPSERT via `upsertAgendamentoAtivo(tx, matricula, id_imersao)`:
   - existe + isPendenteMulta(4 ou 5) → `ConflictException` "Pendência de pagamento".
   - existe + isAtivo (1 ou NULL) → `ConflictException` "Já está inscrito".
   - existe + cancelado (2) ou reagendado (3) → UPDATE: `status=1, status_timestamp=now(), data_solicitacao=now()`.
   - não existe → INSERT: `(matricula, id_imersao, status=1, status_timestamp=now(), data_solicitacao=DEFAULT)`.

**Por que SERIALIZABLE:** evita TOCTOU em vagas. Duas inscrições concorrentes na última vaga: uma das transações falha com erro PG `40001` (serialization failure); o serviço pode tratar como `ConflictException` "Sem vagas".

**Código:** `apps/api/src/imersoes/imersoes.service.ts` → método `inscrever()`.

### 5.2 Cancelar

**Endpoint:** `DELETE /api/me/inscricoes/:id`

**Pré-condições:** mesmas (adimplência + punição).

**Validações:**
1. Carregar `(matricula, id_imersao)`. Se não existe ou status 2/3 → `NotFoundException` "Inscrição não encontrada" (já finalizada).
2. Se `isPendenteMulta(status)` (4 ou 5) → `ConflictException` "Você tem pendência de pagamento. Fale com o suporte".
3. Calcular `dias = floor((data_imersao - now) / 86400000)`. Se `dias < 15` → `ConflictException` com `{ direcionarCx: true, motivo: 'prazo', diasRestantes: dias, mensagem: 'O prazo para cancelamento pelo app expirou (limite de 15 dias antes do evento). Entre em contato com o suporte agora mesmo para que possamos te ajudar.' }`. Frontend redireciona para `/app/cx`.
4. Senão: `UPDATE status=2, status_timestamp=now()`. Retorna `{ status: 'cancelado' }`.

**Pedido <15 dias:** o aluno é direcionado ao Suporte via WhatsApp. O admin, externamente, faz a transição manual (vide §5.4).

### 5.3 Reagendar

**Endpoint:** `POST /api/me/inscricoes/:id/reagendar` body `{ novaImersaoId }`

**Validações iniciais:**
1. `idAtual !== novaImersaoId` — senão `BadRequestException`.
2. Gates de adimplência e punição.

**Transação `Serializable`:**
1. Carregar atual `(matricula, idAtual)`. Inexistente → 404. PendenteMulta → 409 "Pendência". Status 2/3 → 404.
2. `dias < 15` → 409 prazo (mesmo formato do cancelamento). Suporte processa via §5.4.
3. Carregar nova imersão (`findUnique` em `pf_imersoes1`). Inexistente → 404.
4. **Mesmo tipo** — `nova.tipo === atual.imersao.tipo`. Senão `ConflictException` "Reagendamentos só são permitidos dentro do mesmo tipo de imersão.".
5. `now >= nova.data_abertura` e `now <= nova.data_imersao`.
6. Tipo não já participado (excluir `idAtual` da busca).
7. Vagas na nova (count VAGA_WHERE).
8. UPDATE atual: `status=3, status_timestamp=now()`.
9. UPSERT nova via `upsertAgendamentoAtivo`. Conflito se nova já está ativa (raro).

### 5.4 Pendência de multa (admin)

Quando o aluno solicita cancelamento ou reagendamento dentro de 15 dias via Suporte, o admin (no app `admin-plantao-flexivel`) processa manualmente.

**Reagendamento pendente — SQL transacional:**

```sql
BEGIN;

-- Marca a linha antiga como pendente
UPDATE lovable.pf_imersoes_agendamento
   SET status = 4,
       pagou_multa = false,
       status_timestamp = now()
 WHERE matricula = $matricula
   AND id_imersao = $id_imersao_atual;

-- Cria/reativa a linha da imersão nova como Agendado
INSERT INTO lovable.pf_imersoes_agendamento
       (matricula, id_imersao, status, pagou_multa, status_timestamp, data_solicitacao)
VALUES ($matricula, $id_imersao_nova, 1, false, now(), now())
    ON CONFLICT (matricula, id_imersao) DO UPDATE
   SET status = 1,
       status_timestamp = now(),
       data_solicitacao = now(),
       pagou_multa = EXCLUDED.pagou_multa;

COMMIT;
```

**Cancelamento pendente — SQL:**

```sql
UPDATE lovable.pf_imersoes_agendamento
   SET status = 5,
       pagou_multa = false,
       status_timestamp = now()
 WHERE matricula = $matricula
   AND id_imersao = $id_imersao;
```

**Confirmação de pagamento (admin):**

```sql
-- O admin marca pagou_multa = true E transiciona o status no MESMO UPDATE.
UPDATE lovable.pf_imersoes_agendamento
   SET pagou_multa = true,
       status = CASE
         WHEN status = 4 THEN 3   -- Reagendado com multa pendente → Reagendado
         WHEN status = 5 THEN 2   -- Cancelado com multa pendente → Cancelado
         ELSE status
       END,
       status_timestamp = now()
 WHERE matricula = $matricula
   AND id_imersao = $id_imersao
   AND status IN (4, 5);
```

> O admin marca `pagou_multa = true` **e** transiciona o status (4→3 ou 5→2) no mesmo `UPDATE`. A reconciliação no portal (§5.5) é **redundante nesse fluxo, mas mantida como rede de segurança**: se algum dia o admin parar de fazer a transição inline, o portal continua corrigindo o status na próxima leitura. Operação idempotente.

> **Atalho do admin em `cancelar`/`reagendar`:** o admin pode passar `pagou_multa: true` no body de `cancel` ou `reagendar` quando recebeu o pagamento durante o atendimento. Nesse caso, a linha vai direto para status 2 ou 3 com `pagou_multa=true`, sem passar por 4/5. O portal-aluno **não tem** esse caminho — todo pedido `<15d` pelo aluno passa primeiro pela fila de multas (4/5).

### 5.5 Reconciliação automática (multa paga)

**Disparada por:** qualquer leitura do aluno no portal — `MeService.listarInscricoes()` e `MeService.listarHistorico()`. Idempotente.

**Lógica:**

```sql
UPDATE lovable.pf_imersoes_agendamento
   SET status = 3, status_timestamp = now()
 WHERE matricula = $matricula
   AND status = 4
   AND pagou_multa = true;

UPDATE lovable.pf_imersoes_agendamento
   SET status = 2, status_timestamp = now()
 WHERE matricula = $matricula
   AND status = 5
   AND pagou_multa = true;
```

**Por que aqui (e não no admin):** o portal-aluno é o "consumidor" da informação visualmente. Garante consistência mesmo se o admin esquecer de fazer a transição. Idempotente: se o admin também faz, os UPDATEs em sequência são no-op.

**Não cria nada novo** — a linha nova (status=1 da imersão alvo do reagendamento) já foi criada no momento do pedido (§5.4). A reconciliação só muda o status da linha antiga (4 → 3).

**Código:** `apps/api/src/me/me.service.ts` → método `reconciliarMultaPaga(matricula)`.

---

## 6. Filtros canônicos (WHERE clauses)

Tabela de referência rápida — copie e cole conforme o caso de uso.

| Caso de uso | Filtro Prisma (TS) | SQL equivalente |
|-------------|---------------------|-----------------|
| **Vagas ocupadas** (count) | `{ OR: [{ status: 1 }, { status: null }] }` | `status = 1 OR status IS NULL` |
| **Inscrições visíveis ao aluno** | `{ OR: [{ status: { in: [1,4,5] } }, { status: null }] }` | `status IN (1,4,5) OR status IS NULL` |
| **Histórico (já passadas)** | adiciona `imersao.dataImersao < now` + `{ OR: [{ status: { in: [1,4] } }, { status: null }] }` | `data_imersao < now() AND (status IN (1,4) OR status IS NULL)` |
| **Linhas a reconciliar** | `{ status: { in: [4,5] }, pagouMulta: true }` | `status IN (4,5) AND pagou_multa = true` |
| **Tipos já participados (bloqueio)** | `OR: [{presencaSabadoManha: true}, {presencaSabadoTarde: true}, {presencaDomingoManha: true}, {presencaDomingoTarde: true}]` (incluir `imersao.tipo` join) | `presenca_sabado_manha = true OR presenca_sabado_tarde = true OR presenca_domingo_manha = true OR presenca_domingo_tarde = true` |
| **Pendência de multa do aluno** | `{ status: { in: [4,5] }, pagouMulta: false }` | `status IN (4,5) AND pagou_multa = false` |

No código TS, essas constantes vivem em `apps/api/src/imersoes/status.constants.ts`:

```ts
export const VAGA_WHERE: Prisma.PfImersoesAgendamentoWhereInput = {
  OR: [{ status: 1 }, { status: null }],
};

export const VISIVEL_WHERE: Prisma.PfImersoesAgendamentoWhereInput = {
  OR: [
    { status: { in: [1, 4, 5] } },
    { status: null },
  ],
};

export function isAtivo(status: number | null | undefined): boolean {
  return status === null || status === undefined || status === 1;
}

export function isPendenteMulta(status: number | null | undefined): boolean {
  return status === 4 || status === 5;
}
```

---

## 7. Presença

Quatro campos boolean nullable em `pf_imersoes_agendamento`:

| Coluna | Significado |
|--------|-------------|
| `presenca_sabado_manha` | Compareceu no sábado de manhã? |
| `presenca_sabado_tarde` | Compareceu no sábado à tarde? |
| `presenca_domingo_manha` | Compareceu no domingo de manhã? |
| `presenca_domingo_tarde` | Compareceu no domingo à tarde? |

**Valores:**
- `NULL` — não registrado (admin ainda não preencheu).
- `TRUE` — presente.
- `FALSE` — ausente.

**Quem marca:** admin, durante ou após o evento.

### 7.1 Status agregado de presença

Não persistido; calculado on-the-fly em `MeService.listarHistorico()`:

```ts
const presencas = [
  a.presencaSabadoManha,
  a.presencaSabadoTarde,
  a.presencaDomingoManha,
  a.presencaDomingoTarde,
];
let statusPresenca: 'presente' | 'faltou' | 'pendente';
if (presencas.some((p) => p === true)) statusPresenca = 'presente';
else if (presencas.every((p) => p === false)) statusPresenca = 'faltou';
else statusPresenca = 'pendente';
```

| Status agregado | Condição |
|-----------------|----------|
| **Presente** | Algum dos 4 turnos = TRUE |
| **Faltou** | Todos os 4 turnos = FALSE |
| **Aguardando registro** (pendente) | Todos NULL ou misto NULL/FALSE sem nenhum TRUE |

### 7.2 Regra de bloqueio por tipo

Aluno **não pode** se inscrever em imersão de um tipo no qual ele tem `presenca_* = true` em outra imersão (passada ou presente).

**Definição precisa:** existe alguma linha do aluno em `pf_imersoes_agendamento` onde:
- a imersão referenciada tem o mesmo `tipo` da imersão alvo (atual ou nova-do-reagendamento), **e**
- pelo menos um dos 4 campos `presenca_*` é `TRUE`.

**Faltas registradas** (todos FALSE) e **presenças pendentes** (NULL) **não bloqueiam** — o aluno pode tentar agendar novamente. Cancelamentos e reagendamentos (status 2, 3) não criam presença=true → não bloqueiam por consequência.

---

## 8. Concorrência e transações

| Operação | Transação | Nível |
|----------|-----------|-------|
| Inscrever | `prisma.$transaction([...])` | `Serializable` |
| Reagendar | `prisma.$transaction([...])` | `Serializable` |
| Cancelar | UPDATE único | — (atomic) |
| Reconciliação | `updateMany` independente por status | — (idempotente) |

**Por que SERIALIZABLE em inscrição e reagendamento:** evita overselling (TOCTOU em `count < vagas`). PG pode retornar erro `40001` (serialization failure) numa das transações concorrentes; o serviço deve tratar como `ConflictException` "Sem vagas" ou similar.

**Reconciliação concorrente** (dois apps rodando ao mesmo tempo): seguro porque `updateMany` filtra por `status IN (4,5) AND pagou_multa=true`. Após o primeiro run, as linhas já têm status novo (2 ou 3), e o segundo run encontra zero linhas — no-op.

---

## 9. Timestamps e fuso

| Coluna | Tipo | Quando muda |
|--------|------|-------------|
| `data_solicitacao` | timestamptz | Criação da linha; reativação (UPSERT 2/3 → 1) |
| `status_timestamp` | timestamptz | A cada mudança de status (inscrever, cancelar, reagendar, reconciliar) |
| `data_imersao` | timestamp | Cadastro da imersão (admin) |
| `data_abertura` | timestamp | Cadastro da imersão (admin) |

**Timezone do app:** `America/Sao_Paulo` (variável `TZ` no env do NestJS).

**`status_timestamp` em linhas legadas:** NULL para inscrições antes da coluna existir. Os filtros tratam status NULL como ativo, mas o timestamp NULL fica como histórico sem informação — não normalize sem necessidade.

---

## 10. Edge cases

| Cenário | Comportamento |
|---------|---------------|
| Aluno cancelou e quer reinscrever na mesma imersão | Linha existe com status=2. `inscrever()` faz UPDATE para status=1 + timestamp + data_solicitacao = now(). |
| Aluno reagendou A→B; depois reagenda B→A | Linha A existe com status=2 (foi cancelada por A→B antes? Não, foi 3). Caso real: linha A está status=3 (Reagendado). `upsertAgendamentoAtivo` faz UPDATE 3→1. OK. |
| Aluno tem reagendamento pendente (status=4) e tenta cancelar a inscrição antiga | `cancelar()` detecta `isPendenteMulta` → 409 "Pendência". Aluno precisa resolver pagamento primeiro. |
| Imersão deletada | CASCADE remove linhas — **não deletar imersões em prod**; encerre (data já passada). |
| Aluno deletado | CASCADE remove linhas — **não deletar alunos**; anonimize. |
| Status NULL em filtros | Sempre tratado como 1 (Agendado). `isAtivo(null) === true`. |
| Aluno inadimplente entra no portal | Faz login normalmente (gates não bloqueiam login). Mutações em `/api/imersoes/...` e `/api/me/...` retornam 409 com `motivo: 'inadimplente'`. Frontend redireciona para `/app/cx`. |
| Reagendamento entre tipos diferentes | 409 "Reagendamentos só são permitidos dentro do mesmo tipo de imersão." |
| Admin cria status=4 mas esquece de criar a linha nova (status=1) | Quando aluno paga e reconcilia, a antiga vira status=3 mas não há linha nova — aluno fica sem inscrição. **Procedimento do admin**: SEMPRE criar as duas linhas em transação atômica (§5.4). |
| Race em SERIALIZABLE | PG retorna `40001`; serviço propaga como `ConflictException`. |

---

## 11. Endpoints REST do portal-aluno

Todos exigem cookie de sessão (`imersao_session`) emitido após validação OTP.

| Método | Rota | Gates | Função |
|--------|------|-------|--------|
| GET | `/api/imersoes/disponiveis` | JWT | Lista imersões abertas, filtra vagas (VAGA_WHERE), tipos já participados, já-inscritas (VISIVEL_WHERE) |
| GET | `/api/imersoes/:id` | JWT | Detalhe + vagas |
| POST | `/api/imersoes/:id/inscrever` | JWT + adimp + puni | §5.1 |
| GET | `/api/me/inscricoes` | JWT | Reconcilia primeiro + retorna ativas/pendentes (VISIVEL_WHERE, data futura) |
| DELETE | `/api/me/inscricoes/:id` | JWT + adimp + puni | §5.2 |
| POST | `/api/me/inscricoes/:id/reagendar` | JWT + adimp + puni | §5.3 |
| GET | `/api/me/historico` | JWT | Reconcilia + retorna passadas (status 1, 4, NULL) com status agregado de presença |
| GET | `/api/auth/me` | JWT | Identidade + `bloqueios: { inadimplente, punicao }` |

---

## 12. Responsabilidades — portal-aluno vs. admin

### O que o portal-aluno faz

- Aceita pedidos do aluno: `inscrever`, `cancelar (≥15d)`, `reagendar (≥15d)`.
- Bloqueia tentativas inválidas (tipo já feito, vagas esgotadas, prazo curto, pendência de multa, adimplência, punição).
- **Executa a reconciliação `4→3` e `5→2`** ao detectar `pagou_multa=true` (§5.5).
- Mostra ao aluno: inscrições ativas, pendências de multa com badge, histórico de presença, banner se inadimplente/punido.
- **Nunca** marca presença, **nunca** marca `pagou_multa`, **nunca** cria status 4 ou 5 (esses são responsabilidade do admin).

### O que o admin (admin-plantao-flexivel) faz

- Cadastra/edita imersões (`pf_imersoes1`).
- Cadastra/edita alunos (`pf_alunos`), inclusive `status_financeiro`.
- Recebe pedidos de cancelamento/reagendamento <15 dias via WhatsApp.
- **Cria status 4 ou 5** (com SQL em transação — §5.4). Para status 4, cria também a linha nova com status=1 referente à imersão alvo.
- Confirma pagamento de multa: `UPDATE pagou_multa = true WHERE matricula = $1 AND id_imersao = $2 AND status IN (4,5)`. Não precisa fazer a transição de status — o portal-aluno reconcilia automaticamente.
- Marca presença nos 4 campos `presenca_*` durante/após o evento.
- **Nunca** deleta linhas (rompe histórico e gatilha CASCADE). Use UPDATE.
- **Nunca** cria status fora do catálogo (1-5).
- **Nunca** permite reagendamento entre tipos diferentes (mesma regra do aluno).

### Pontos de coordenação

- Ambos podem reconciliar (`UPDATE status=3 WHERE status=4 AND pagou_multa=true` etc) — é idempotente. Se o admin quiser rodar a transição manualmente em vez de esperar o aluno entrar no portal, pode (mas é redundante).
- Ambos devem usar `status_timestamp = now()` em **toda** mutação de status.
- Se algum dos apps adicionar uma coluna nova ou alterar tipo de coluna em `pf_imersoes_agendamento`, **comunicar o outro** antes — sem migrations automáticas.

---

## 13. Apêndice: queries SQL úteis

### Status atual do aluno

```sql
SELECT a.id_imersao, i.data_imersao, t.tipo,
       a.status, s.tipo AS status_nome, a.pagou_multa, a.status_timestamp
  FROM lovable.pf_imersoes_agendamento a
  JOIN lovable.pf_imersoes1 i USING (id_imersao)
  JOIN lovable.pf_imersoes_tipo t ON t.id_tipo = i.tipo
  LEFT JOIN lovable.pf_imersao_status s ON s.id = a.status
 WHERE a.matricula = $matricula
 ORDER BY i.data_imersao DESC;
```

### Inscrições ativas (sob a perspectiva do portal-aluno)

```sql
SELECT *
  FROM lovable.pf_imersoes_agendamento
 WHERE matricula = $matricula
   AND (status IN (1, 4, 5) OR status IS NULL);
```

### Vagas ocupadas em uma imersão

```sql
SELECT count(*)
  FROM lovable.pf_imersoes_agendamento
 WHERE id_imersao = $id_imersao
   AND (status = 1 OR status IS NULL);
```

### Alunos com pendência de multa não paga

```sql
SELECT matricula, id_imersao, status, status_timestamp
  FROM lovable.pf_imersoes_agendamento
 WHERE status IN (4, 5)
   AND pagou_multa = false
 ORDER BY status_timestamp ASC;  -- mais antigas primeiro
```

### Tipos que um aluno já participou (com presença válida)

```sql
SELECT DISTINCT i.tipo, t.tipo AS tipo_nome
  FROM lovable.pf_imersoes_agendamento a
  JOIN lovable.pf_imersoes1 i USING (id_imersao)
  JOIN lovable.pf_imersoes_tipo t ON t.id_tipo = i.tipo
 WHERE a.matricula = $matricula
   AND (a.presenca_sabado_manha = true
     OR a.presenca_sabado_tarde = true
     OR a.presenca_domingo_manha = true
     OR a.presenca_domingo_tarde = true);
```

### Reconciliação manual (pode ser disparada pelo admin)

```sql
BEGIN;
UPDATE lovable.pf_imersoes_agendamento
   SET status = 3, status_timestamp = now()
 WHERE status = 4 AND pagou_multa = true;

UPDATE lovable.pf_imersoes_agendamento
   SET status = 2, status_timestamp = now()
 WHERE status = 5 AND pagou_multa = true;
COMMIT;
```

### Transições do dia (auditoria)

```sql
SELECT matricula, id_imersao, status, status_timestamp, pagou_multa
  FROM lovable.pf_imersoes_agendamento
 WHERE status_timestamp::date = current_date
 ORDER BY status_timestamp DESC;
```

---

## 14. Glossário rápido

- **Inscrição ativa:** linha com `status=1 OR NULL`.
- **Pendência de multa:** linha com `status IN (4,5)` e `pagou_multa=false`.
- **Reconciliação:** UPDATE automático de `4→3` ou `5→2` quando `pagou_multa=true`.
- **Tipo já participado:** existe linha do aluno com `presenca_* = true` em imersão de mesmo `tipo`.
- **Gate:** validação que pode bloquear o fluxo (gates de adimplência, punição, prazo, mesmo tipo, vagas).
- **VAGA_WHERE:** filtro Prisma para contagem de vagas (`status=1 OR NULL`).
- **VISIVEL_WHERE:** filtro para o que o aluno vê em `/app/minhas` (`status IN (1,4,5) OR NULL`).
- **`direcionarCx`:** flag no payload de erro 409 que sinaliza ao frontend redirecionar para `/app/cx` (tela do suporte).

---

## 15. Changelog deste documento

- **v1 (2026-05-19)** — Versão inicial. Alinhada à v13 do portal-aluno (status 5, reconciliação de multa paga, gates pós-OTP, mesmo tipo no reagendamento, soft-delete em cancelar).
