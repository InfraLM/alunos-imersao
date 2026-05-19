# Portal do Aluno — Briefing inicial para o novo app de imersões

> Este documento é o **contexto inicial** que você (Claude Code que vai
> construir o novo app) deve ler antes de começar. Ele descreve o domínio
> existente, as tabelas do banco compartilhado, e como funciona "marcar uma
> imersão" hoje no app admin.
>
> **As regras de negócio finais (limites por aluno, janelas exatas, política
> de cancelamento, pagamento, etc.) serão enviadas separadamente** — ainda
> estão sendo construídas. Use este documento só como base de domínio.

---

## 1. Visão geral

Construir um **portal web público** onde o **aluno**:

1. Acessa o site, digita o **CPF**.
2. Sistema busca o aluno em `lovable.pf_alunos` e verifica **adimplência**
   (`status_financeiro`).
3. Se inadimplente / cadastro não encontrado → tela de bloqueio com mensagem.
4. Se OK → vê **lista de imersões disponíveis** (filtradas pela lógica de
   disponibilidade descrita na seção 5).
5. Escolhe uma imersão e **solicita a inscrição**.
6. Pode listar as suas inscrições existentes (e talvez cancelar).

Hoje no app admin (`gestao-ppg.lmedu.com.br/admin-plantao-flexivel`) esse
fluxo é feito **pelo admin/atendente** escolhendo o aluno e a imersão. O
portal novo entrega esse poder direto pro aluno (com mais validações).

### Stack
- **Backend:** NestJS + Prisma + PostgreSQL
- **Frontend:** React (Vite)
- **Banco:** PostgreSQL no Google Cloud SQL (compartilhado com app admin)

### Restrição crítica
- O **banco é compartilhado** com o app admin que já está em produção.
- **Não pode renomear tabelas/colunas** nem mudar tipos sem combinar antes.
- **`prisma migrate` proibido.** Use `prisma db pull` para gerar o
  `schema.prisma`. Se precisar alterar schema, mande SQL pro time admin
  aplicar.
- Idealmente o novo app **só escreve em `pf_imersoes_agendamento`**. Tudo o
  resto é leitura. Recomendado criar um usuário PG separado com permissões
  restritas para o Prisma:
  ```sql
  GRANT USAGE ON SCHEMA lovable TO portal_aluno;
  GRANT SELECT ON ALL TABLES IN SCHEMA lovable TO portal_aluno;
  GRANT INSERT, DELETE ON lovable.pf_imersoes_agendamento TO portal_aluno;
  ```

---

## 2. Convenções do banco

- **PostgreSQL** no Google Cloud SQL.
- **Schema único:** `lovable`. Toda query qualifica com `lovable.pf_xxx`.
- **Prefixo de tabela:** `pf_` em tudo.
- **Datas:** algumas colunas legadas guardam **string `DD/MM/YYYY`** em
  varchar (ex: `pf_plantoes.data_plantao`). **Imersões** usam tipos PG
  reais: `pf_imersoes1.data_imersao` e `data_abertura` são **TIMESTAMP**, e
  `pf_imersoes_agendamento.data_solicitacao` é **`timestamptz`**.
- **Timezone:** o app admin trabalha em `America/Sao_Paulo`. Rode o NestJS
  com `TZ=America/Sao_Paulo` ou normalize na app, pra evitar comparações
  fora de fuso.

### Configuração Prisma esperada
```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["lovable"]
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}
```

Cada model precisa de `@@schema("lovable")` e `@@map("pf_xxx")`. Campos
camelCase no Prisma usam `@map("nome_no_banco")`.

---

## 3. Tabelas do domínio

### 3.1 `lovable.pf_alunos` — cadastro de alunos

DDL real:

```sql
CREATE TABLE lovable.pf_alunos (
  matricula                 varchar NOT NULL,
  nome                      varchar NULL,
  telefone                  varchar NULL,
  email                     varchar NULL,
  parcelas_pagas            int4 NULL,
  parcelas_atraso           int4 NULL,
  parcelas_aberto           int4 NULL,
  aulas_total_porcentagem   float4 NULL,
  id                        int8 NULL,
  turma                     varchar NULL,
  criado_em                 varchar NULL,
  dias_desde_primeira_aula  int4 NULL,
  dias_desde_ultima_aula    int4 NULL,
  aulas_assistidas          int4 NULL,
  status_financeiro         text NULL,
  cidade                    varchar NULL,
  tag                       text NULL,
  cep                       varchar NULL,
  cpf                       varchar NULL,
  CONSTRAINT pf_alunos_pk PRIMARY KEY (matricula)
);
```

Pontos importantes:

- **PK natural:** `matricula` (varchar). Use ela como FK em
  `pf_imersoes_agendamento`.
- **`cpf` é varchar NULL, sem UNIQUE constraint, sem máscara fixa**. Pode ter
  alunos sem CPF (NULL), com CPF mascarado (`123.456.789-00`), ou só dígitos.
  - **Normalize no backend:** strip everything not digit. Query com
    `WHERE regexp_replace(cpf, '\D', '', 'g') = $1`. Ou cache um campo
    normalizado em memória/cache curto.
  - **Trate duplicatas defensivamente:** se a query retornar >1 aluno, falhe
    de forma segura e logue — a constraint não existe ainda.
- **`status_financeiro` é TEXT livre.** Valores observados na prática:
  `'ADIMPLENTE'`, `'INADIMPLENTE'`, `'INDEFINIDO'` (e provavelmente outros
  variantes). **Confirme com o time os valores reais** antes de implementar
  o gating de adimplência. Padrão sugerido: bloquear se contém
  `'INADIMPLENT'` (case-insensitive); liberar caso contrário, mas **mostrar
  alerta se `'INDEFINIDO'`**.

### 3.2 `lovable.pf_imersoes1` — catálogo de imersões disponíveis

| Campo | Tipo | NULL? | Descrição |
|-------|------|-------|-----------|
| `id_imersao` | serial (int4) | NOT NULL | PK |
| `tipo` | int4 | NOT NULL | FK → `pf_imersoes_tipo.id_tipo` |
| `data_imersao` | timestamp | NOT NULL | Quando a imersão acontece |
| `vagas` | int4 | NOT NULL | Total de vagas |
| `data_abertura` | timestamp | NOT NULL | Quando abre inscrição |

Não há FK para hospital — **imersões hoje são genéricas, sem vínculo a
hospital específico**. Se o produto exigir mostrar hospital, é uma decisão
nova (adicionar coluna ou derivar do `tipo`).

### 3.3 `lovable.pf_imersoes_agendamento` — inscrição do aluno

DDL real (esta é a única tabela em que o novo app vai gravar):

```sql
CREATE TABLE lovable.pf_imersoes_agendamento (
  matricula              varchar     NOT NULL,
  id_imersao             int4        NOT NULL,
  data_solicitacao       timestamptz DEFAULT now() NOT NULL,
  pagou_multa            bool        DEFAULT false NOT NULL,
  presenca_sabado_manha  bool NULL,
  presenca_sabado_tarde  bool NULL,
  presenca_domingo_manha bool NULL,
  presenca_domingo_tarde bool NULL,
  CONSTRAINT pf_imersoes_agendamento_pk PRIMARY KEY (matricula, id_imersao),
  CONSTRAINT pf_imersoes_agendamento_aluno_fk
    FOREIGN KEY (matricula) REFERENCES lovable.pf_alunos(matricula)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT pf_imersoes_agendamento_imersao_fk
    FOREIGN KEY (id_imersao) REFERENCES lovable.pf_imersoes1(id_imersao)
    ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX idx_pf_imersoes_agendamento_imersao
  ON lovable.pf_imersoes_agendamento USING btree (id_imersao);
```

Pontos críticos:

- **PK composta `(matricula, id_imersao)`** — garante que o mesmo aluno não
  se inscreve duas vezes na mesma imersão. Tentar inserir duplicado gera
  erro PG `23505` → traduza para HTTP 409 "já inscrito".
- **`data_solicitacao` é `timestamptz` com default `now()` NOT NULL** → o
  INSERT pode (e deve) omitir o campo.
- **`pagou_multa` é NOT NULL com default `false`** → também pode ser
  omitido. O portal do aluno provavelmente não tem motivo pra mexer nele
  (multa é cenário do admin, no fluxo de reagendamento).
- **Presença** (4 campos boolean NULL) é preenchida pelo admin **durante**
  a imersão. O portal do aluno **não escreve** nesses campos.
- **CASCADE on FK:** se a imersão ou o aluno forem deletados, o agendamento
  some junto. Implicação: não dá pra "cancelar imersão sem perder
  histórico" via DELETE simples — o produto pode querer soft delete no
  futuro.

### 3.4 `lovable.pf_imersoes_tipo` — lookup de tipos

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `id_tipo` | serial | PK |
| `tipo` | varchar | Nome (ex: "Insuficiência Respiratória") |

### 3.5 `lovable.pf_punicoes` — restrições temporárias

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `matricula` | varchar | FK → `pf_alunos` |
| `punicao_inicio` | date | Início |
| `punicao_fim` | date | Fim |
| `motivo` | varchar | Motivo |

Lógica usada no app admin: punição ativa se `punicao_fim >= CURRENT_DATE`.
**O app admin atual NÃO valida punição na inscrição de imersão** — mas o
portal do aluno provavelmente deve.

### 3.6 Outras tabelas relevantes (leitura informativa)

- **`pf_hospital`** — `codigo_hospital`, `nome`, `cidade`, `estado`,
  `responsavel`, `vagas_por_dia`. Como `pf_imersoes1` não tem FK pra hospital
  hoje, essa tabela é mais útil pra docs (próximo item).
- **`pf_documentos` / `pf_hospital_documentos` / `pf_aluno_documentos`** —
  sistema de docs exigidos por hospital. Hoje **puramente informativo** no
  app admin (não bloqueia inscrição em imersão). Se o produto evoluir pra
  amarrar imersões a hospitais, essas tabelas viram pré-requisitos.
- **`pf_datas`** — `data_evento`, `evento`, `hospital`, `restricao`. Eventos
  no calendário; `restricao = true` significa "data bloqueada". Não é
  validado em imersões hoje.

---

## 4. Endpoints REST do app admin (referência conceitual — NÃO consumir)

O portal do aluno **não chama** a API admin. Vai falar **direto no banco
via Prisma**. Listo os endpoints só pra você entender as **validações
existentes** que vai precisar replicar (e estender) no NestJS:

| Método | Rota admin | O que faz | Replicar no portal? |
|--------|-----------|-----------|---------------------|
| GET | `/imersoes-tipo` | Lista tipos | Sim (somente leitura) |
| GET | `/imersoes-disponiveis` | Lista imersões abertas | Sim — com filtro de disponibilidade (ver §5) |
| POST | `/imersoes-disponiveis` | Cria imersão (admin) | NÃO |
| GET | `/imersoes-agendamentos` | Lista todos os agendamentos | NÃO global — só do aluno logado |
| POST | `/imersoes-agendamentos` | Inscreve aluno | Sim — é o coração do portal |
| DELETE | `/imersoes-agendamentos/:m/:i` | Cancela inscrição | Talvez (se produto permitir) |
| POST | `/imersoes-agendamentos/reagendar` | Reagenda (com multa) | Talvez (fora do MVP provavelmente) |

Validações do POST `/imersoes-agendamentos` no admin
(`backend/src/controllers/imersoes-agendamentos.controller.js`):

1. Carrega imersão. Se não existe → **404**.
2. `now >= data_abertura`? Senão → **400** "Inscrições para esta imersão
   ainda não estão abertas".
3. `now <= data_imersao`? Senão → **400** "Esta imersão já ocorreu".
4. `COUNT(*) FROM pf_imersoes_agendamento WHERE id_imersao = $1 < vagas`?
   Senão → **400** "Sem vagas disponíveis".
5. INSERT. Erro `23505` (PK duplicada) → **409** "Aluno já inscrito".
6. Erro `23503` (FK inválida) → **400** "Aluno ou imersão inexistente".

---

## 5. Lógica de "imersão disponível"

Esta é a lógica que o admin usa hoje pra colorir/desabilitar imersões no
frontend (`src/components/imersoes/AgendarImersaoTab.tsx`):

```ts
function getStatus(im) {
  const now = new Date();
  const abertura = new Date(im.data_abertura);
  const data = new Date(im.data_imersao);
  if (data < now) return 'passada';     // já ocorreu
  if (now < abertura) return 'fechada'; // inscrições ainda não abriram
  if (im.vagas_ocupadas >= im.vagas) return 'esgotada';
  return 'aberta';
}
```

No portal do aluno, **só liste imersões com status `'aberta'`**. Calcule
`vagas_ocupadas` na hora via subquery / Prisma `count`:

```ts
const disponiveis = await prisma.pfImersoes1.findMany({
  where: {
    dataImersao:   { gt: new Date() },
    dataAbertura:  { lte: new Date() },
  },
  include: {
    _count: { select: { agendamentos: true } },
  },
});
// filtrar em memória:
const abertas = disponiveis.filter(im => im._count.agendamentos < im.vagas);
```

Considere também **excluir imersões em que o aluno já está inscrito**, pra
não confundir.

---

## 6. Validações que o app admin NÃO faz (mas o portal deve)

A lista a seguir é onde o portal do aluno se diferencia do admin. **Estes
são bons defaults** — confirme com o time antes de implementar cada um:

- ❌ **Adimplência** — gate de entrada. Sem isso, aluno entra mesmo
  inadimplente.
- ❌ **Punição ativa** — bloquear se `pf_punicoes` tem registro vigente.
- ❌ **Documentos** — se imersão ganhar vínculo com hospital, validar
  `pf_aluno_documentos` vs `pf_hospital_documentos`.
- ❌ **Conflito de fim de semana** — aluno tentando se inscrever em duas
  imersões no mesmo sábado/domingo.
- ❌ **Limite de imersões por aluno** — não existe hoje, mas é provável que
  vá existir (vem nas regras de negócio finais).
- ❌ **Concorrência (race condition em vagas)** — o `COUNT(*) < vagas` é
  TOCTOU clássico. Em cenário de muitos alunos concorrendo:

  ```ts
  await prisma.$transaction(async tx => {
    const ocupadas = await tx.pfImersoesAgendamento.count({ where: { idImersao } });
    const imersao  = await tx.pfImersoes1.findUnique({ where: { idImersao } });
    if (ocupadas >= imersao.vagas) throw new ConflictException('Sem vagas');
    await tx.pfImersoesAgendamento.create({ data: { matricula, idImersao } });
  }, { isolationLevel: 'Serializable' });
  ```

  Sob `Serializable`, alguma das transações concorrentes falha e o NestJS
  reapresenta o "sem vagas" pro último a chegar. Alternativa: `INSERT ...
  WHERE (subselect count) < vagas` em raw SQL.

---

## 7. Fluxo completo proposto

```
[Aluno acessa portal]
        |
        v
[Tela de login: CPF]
        |
        v
[Backend: normaliza CPF (só dígitos)]
        |
        v
[Backend: busca em pf_alunos]
  |                         |
  | não encontrado          | encontrado
  v                         v
[Erro: cadastro          [Verifica status_financeiro]
 não localizado]              |
                              | inadimplente / indefinido
                              v
                          [Tela de bloqueio com instrução]
                              | adimplente
                              v
                          [Verifica pf_punicoes ativa]
                              | punição vigente
                              v
                          [Tela de bloqueio]
                              | sem punição
                              v
                          [Lista de imersões disponíveis
                           (filtra getStatus === 'aberta'
                            e exclui já inscritas)]
                              |
                              v
                          [Aluno escolhe + confirma]
                              |
                              v
                          [POST /api/agendamentos
                           - tx SERIALIZABLE
                           - INSERT só matricula + id_imersao
                           - returning agendamento]
                              |
                              v
                          [Sucesso → tela de confirmação +
                           lista de inscrições do aluno]
```

### Sessão / auth

- **Não use o JWT do app admin.** Auth do portal é independente.
- Sugestão MVP: ao validar CPF + adimplência, emitir JWT curto (~30min) com
  `{ matricula, nome }` no payload, em cookie `httpOnly` `SameSite=Lax`.
  Sem refresh token (forçar relogin reduz superfície).
- Considere **rate limit** no endpoint de login por CPF (ex: 5 tentativas
  por minuto por IP). CPF é PII, dá pra fazer enumeração se você não cuidar.

---

## 8. Modelo Prisma (esqueleto inicial)

Cole isto como `prisma/schema.prisma` no novo repo. Depois, rode
**`prisma db pull`** para conferir contra o banco real e ajustar tipos que
você não precisa (o portal do aluno só usa 4-5 tabelas).

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
  schemas  = ["lovable"]
}

generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["multiSchema"]
}

model PfAlunos {
  matricula             String  @id @db.VarChar
  nome                  String? @db.VarChar
  telefone              String? @db.VarChar
  email                 String? @db.VarChar
  parcelasPagas         Int?    @map("parcelas_pagas")
  parcelasAtraso        Int?    @map("parcelas_atraso")
  parcelasAberto        Int?    @map("parcelas_aberto")
  statusFinanceiro      String? @map("status_financeiro")
  turma                 String? @db.VarChar
  cidade                String? @db.VarChar
  cep                   String? @db.VarChar
  cpf                   String? @db.VarChar
  agendamentos          PfImersoesAgendamento[]

  @@map("pf_alunos")
  @@schema("lovable")
}

model PfImersoes1 {
  idImersao     Int      @id @default(autoincrement()) @map("id_imersao")
  tipo          Int
  dataImersao   DateTime @map("data_imersao")
  vagas         Int
  dataAbertura  DateTime @map("data_abertura")
  tipoRef       PfImersoesTipo         @relation(fields: [tipo], references: [idTipo])
  agendamentos  PfImersoesAgendamento[]

  @@map("pf_imersoes1")
  @@schema("lovable")
}

model PfImersoesTipo {
  idTipo    Int    @id @default(autoincrement()) @map("id_tipo")
  tipo      String @db.VarChar
  imersoes  PfImersoes1[]

  @@map("pf_imersoes_tipo")
  @@schema("lovable")
}

model PfImersoesAgendamento {
  matricula             String   @db.VarChar
  idImersao             Int      @map("id_imersao")
  dataSolicitacao       DateTime @default(now()) @map("data_solicitacao") @db.Timestamptz(6)
  pagouMulta            Boolean  @default(false) @map("pagou_multa")
  presencaSabadoManha   Boolean? @map("presenca_sabado_manha")
  presencaSabadoTarde   Boolean? @map("presenca_sabado_tarde")
  presencaDomingoManha  Boolean? @map("presenca_domingo_manha")
  presencaDomingoTarde  Boolean? @map("presenca_domingo_tarde")
  aluno                 PfAlunos    @relation(fields: [matricula], references: [matricula], onDelete: Cascade, onUpdate: Cascade)
  imersao               PfImersoes1 @relation(fields: [idImersao], references: [idImersao], onDelete: Cascade, onUpdate: Cascade)

  @@id([matricula, idImersao])
  @@index([idImersao])
  @@map("pf_imersoes_agendamento")
  @@schema("lovable")
}

model PfPunicoes {
  matricula        String   @db.VarChar
  punicaoInicio    DateTime @map("punicao_inicio") @db.Date
  punicaoFim       DateTime @map("punicao_fim") @db.Date
  motivo           String?  @db.VarChar

  @@id([matricula, punicaoInicio])
  @@map("pf_punicoes")
  @@schema("lovable")
}
```

### Exemplo de query de login (CPF)

```ts
const normalized = cpfInput.replace(/\D/g, '');
const aluno = await prisma.$queryRaw<PfAlunos[]>`
  SELECT *
  FROM lovable.pf_alunos
  WHERE regexp_replace(cpf, '\D', '', 'g') = ${normalized}
  LIMIT 2
`;

if (aluno.length === 0) throw new NotFoundException('Cadastro não encontrado');
if (aluno.length > 1)   { logger.error('CPF duplicado', { normalized }); throw new InternalServerErrorException('Erro de cadastro'); }

const a = aluno[0];
if (/inadimplent/i.test(a.statusFinanceiro ?? '')) throw new ForbiddenException('Situação financeira pendente');
// punição:
const punicaoAtiva = await prisma.pfPunicoes.findFirst({
  where: { matricula: a.matricula, punicaoFim: { gte: new Date() } },
});
if (punicaoAtiva) throw new ForbiddenException('Aluno com restrição vigente');
```

### Exemplo de INSERT (inscrever)

```ts
async function inscrever(matricula: string, idImersao: number) {
  return prisma.$transaction(async tx => {
    const im = await tx.pfImersoes1.findUnique({ where: { idImersao } });
    if (!im) throw new NotFoundException('Imersão não encontrada');

    const now = new Date();
    if (im.dataAbertura > now) throw new BadRequestException('Inscrições ainda não abertas');
    if (im.dataImersao < now)  throw new BadRequestException('Imersão já ocorreu');

    const ocupadas = await tx.pfImersoesAgendamento.count({ where: { idImersao } });
    if (ocupadas >= im.vagas) throw new BadRequestException('Sem vagas');

    try {
      return await tx.pfImersoesAgendamento.create({ data: { matricula, idImersao } });
    } catch (e) {
      if (e.code === 'P2002') throw new ConflictException('Já inscrito');
      throw e;
    }
  }, { isolationLevel: 'Serializable' });
}
```

---

## 9. Riscos e armadilhas

| Risco | Mitigação |
|-------|-----------|
| Banco compartilhado, novo app pode quebrar admin | Usuário PG restrito + revisão de qualquer migration com o time admin |
| `prisma migrate` apaga/cria tabelas | **Nunca rodar `prisma migrate`**. Use `prisma db pull`. Alterações de schema → SQL manual revisado |
| CPF sem UNIQUE → duplicatas | Query com `LIMIT 2`, falhar se >1; pedir pro time admin adicionar UNIQUE depois |
| `status_financeiro` é texto livre | Confirmar valores reais antes de codar; default conservador é negar se `~ /inadimplent/i` ou se NULL |
| Race condition em vagas (TOCTOU) | `prisma.$transaction(..., { isolationLevel: 'Serializable' })` ou raw SQL com check no INSERT |
| Timezone PG vs JS | `TZ=America/Sao_Paulo` no NestJS; armazenar tudo em UTC e formatar na UI |
| Enumeração de CPF no login | Rate limit por IP + mensagem genérica ("não foi possível autenticar") em vez de "CPF não existe" |
| CASCADE deleta histórico de inscrições | Não use DELETE em `pf_imersoes1` / `pf_alunos` no novo app |
| JWT compartilhado por engano | Use chave de assinatura diferente do app admin; cookie em domínio próprio |

---

## 10. Fora deste briefing (regras vêm depois)

Estes pontos serão definidos pelo usuário direto contigo, e ainda estão em
discussão:

- **Limite de imersões por aluno** (mês? semestre? total?)
- **Política de cancelamento** (aluno pode cancelar até quando? gera multa?)
- **Integração com pagamento** (cobrar reagendamento, taxa de inscrição etc.)
- **Janela de inscrição vs janela de visualização** (aluno vê imersão antes
  da `data_abertura`?)
- **Comunicação por email/WhatsApp** ao confirmar inscrição
- **UI/UX** do portal — cores, layout, design system
- **Deploy** (Vercel? domínio? CDN?)
- **Observabilidade** (logs, métricas, alertas)

Espere instruções específicas pra esses pontos. **Não inferir defaults
arrojados** sem confirmação.

---

## 11. Próximos passos práticos

1. Iniciar repo do novo app (`portal-aluno-imersoes` ou nome a definir).
2. `npm i prisma @prisma/client @nestjs/cli` etc. — bootstrapping padrão.
3. Configurar `DATABASE_URL` apontando pro PG compartilhado, usando o
   usuário restrito sugerido na seção 1.
4. `npx prisma db pull` — confirmar que o `schema.prisma` bate com o real.
5. Editar pra deixar só os models que o portal precisa (limpar ruído).
6. Implementar:
   - Endpoint `POST /auth/login` (CPF → JWT em cookie).
   - Endpoint `GET /imersoes/disponiveis` (lista filtrada).
   - Endpoint `POST /imersoes/:id/inscrever` (transação serializable).
   - Endpoint `GET /me/inscricoes` (inscrições do aluno logado).
   - Endpoint `DELETE /me/inscricoes/:id` (opcional, conforme regra).
7. Frontend React com Vite: 4 telas — login, bloqueio, lista, confirmação.
8. **Aguardar as regras de negócio finais** antes de adicionar validações
   além do que está aqui.

Boa construção. Qualquer dúvida sobre o domínio existente, consulte o repo
admin em `C:\devVini\admin-plantao-flexivel\` — em particular:

- `backend/src/controllers/imersoes-agendamentos.controller.js`
- `backend/src/controllers/imersoes-disponiveis.controller.js`
- `src/components/imersoes/AgendarImersaoTab.tsx`
- `src/components/imersoes/ReagendarTab.tsx`
