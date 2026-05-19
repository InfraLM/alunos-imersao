# Portal de Imersões — PPG

Portal web mobile-first para alunos da pós-graduação agendarem imersões via CPF + OTP por email.

## Stack

- **Backend:** NestJS + Prisma + PostgreSQL (**dois bancos**)
- **Frontend:** React + Vite + Tailwind + shadcn/ui — paleta preto/vermelho/branco + Instrument Serif
- **Auth:** CPF → código OTP por email (Gmail OAuth2 via nodemailer + googleapis) → JWT em cookie httpOnly
- **Deploy:** Vercel — frontend estático + serverless function NestJS no mesmo projeto
- **Domínio:** `imersao-ppg.liberdademedicaedu.com.br`

## Arquitetura de bancos

| Banco | Schema | Função | Permissões |
|-------|--------|--------|------------|
| `liberdade-medica` (compartilhado com admin) | `lovable` | Leitura de `pf_alunos`, `pf_imersoes1`, `pf_imersoes_tipo`, `pf_punicoes`. Escrita em `pf_imersoes_agendamento`. | Leitura + escrita controlada |
| `imersao-aluno` (exclusivo deste app) | `public` | `imersao_otp`, `email_log`, `access_log` | Leitura + escrita total |

Cada banco tem seu próprio `schema.prisma` em `apps/api/prisma/` e gera um PrismaClient separado em `apps/api/src/prisma/generated/`.

## Pré-requisitos

- Node.js 20+
- npm 10+
- Acesso aos dois bancos PostgreSQL e ao painel Vercel
- Conta Gmail/Workspace + credenciais **OAuth2** (Client ID, Client Secret, Refresh Token). Veja a seção [Setup do Gmail OAuth2](#setup-do-gmail-oauth2) abaixo.

## Setup do Gmail OAuth2

Este projeto envia o OTP por email usando a conta `suprte@liberdademedicaedu.com.br` (Google Workspace) via OAuth2. **Não precisa de senha de app nem 2FA do usuário** — o servidor usa um refresh token para gerar access tokens sob demanda.

### Como obter Client ID + Client Secret

1. Abra o [Google Cloud Console](https://console.cloud.google.com/) e selecione/crie um projeto.
2. **APIs & Services → Library** → busque **Gmail API** → **Enable**.
3. **APIs & Services → OAuth consent screen** → tipo **Internal** (Workspace) → preencher nome do app e suporte. Adicionar o escopo `https://mail.google.com/`.
4. **APIs & Services → Credentials** → **Create credentials → OAuth client ID** → tipo **Web application**.
   - Authorized redirect URIs: adicionar `https://developers.google.com/oauthplayground` (para a próxima etapa) e qualquer URI próprio se for usar outro.
5. Anote **Client ID** e **Client Secret** que aparecem na tela.

### Como obter o Refresh Token

1. Abra o [OAuth 2.0 Playground](https://developers.google.com/oauthplayground/).
2. Clique no ícone de engrenagem (canto superior direito) → marque **Use your own OAuth credentials** → cole o **Client ID** e **Client Secret** do passo anterior.
3. Na lista da esquerda, role até **Gmail API v1** e selecione `https://mail.google.com/`. Clique **Authorize APIs**.
4. Faça login com `suprte@liberdademedicaedu.com.br` e autorize.
5. Na próxima tela, clique **Exchange authorization code for tokens**.
6. Copie o valor do campo **Refresh token** (começa com `1//…`). Guarde com segurança — esse token é o que o servidor vai usar permanentemente.

### Colocar nas envs

```dotenv
GMAIL_USER="suprte@liberdademedicaedu.com.br"
GMAIL_OAUTH_CLIENT_ID="xxxxx.apps.googleusercontent.com"
GMAIL_OAUTH_CLIENT_SECRET="GOCSPX-xxxxxxxxxxxxxxxxxx"
GMAIL_OAUTH_REFRESH_TOKEN="1//xxxxxxxxxxxxxxxxxxxxxxxxxx"
MAIL_FROM="Imersões LM <suprte@liberdademedicaedu.com.br>"
```

> O `MAIL_FROM` deve usar o mesmo endereço de `GMAIL_USER` (ou um "Send mail as" alias configurado nas Configurações do Gmail). Se diferente, o Gmail substitui pelo endereço autenticado.

## Setup do banco — UMA vez

Aplique o SQL inicial **apenas no banco novo** (`imersao-aluno`). O banco antigo não precisa de mudanças.

```bash
psql "$DATABASE_URL_IMERSAO" -f sql/init-imersao-aluno.sql
```

> Se a tabela `lovable.imersao_otp` foi criada em algum momento no banco antigo, dropá-la: `DROP TABLE IF EXISTS lovable.imersao_otp;`

## Setup local

```bash
# 1. Instalar dependências
npm install

# 2. Configurar env vars
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
# Editar com DATABASE_URL_LOVABLE, DATABASE_URL_IMERSAO, JWT_SECRET, GMAIL_USER, GMAIL_OAUTH_* etc

# 3. Sincronizar schemas Prisma com bancos reais (opcional — só se houve mudança via SQL)
npm run prisma:pull:lovable    # sincroniza com liberdade-medica
npm run prisma:pull:imersao    # sincroniza com imersao-aluno

# 4. Gerar clients Prisma (rodado automaticamente em npm install via postinstall)
npm run prisma:generate

# 5. Rodar tudo em modo dev (api :3000 + web :5173 com proxy)
npm run dev
```

## Estrutura

```
imersao-ppg/
├── apps/
│   ├── api/                          # NestJS
│   │   ├── prisma/
│   │   │   ├── lovable/schema.prisma   # banco antigo
│   │   │   └── imersao/schema.prisma   # banco novo
│   │   ├── src/
│   │   │   ├── prisma/
│   │   │   │   ├── generated/          # gerado (gitignored)
│   │   │   │   ├── lovable-prisma.service.ts
│   │   │   │   ├── imersao-prisma.service.ts
│   │   │   │   └── prisma.module.ts
│   │   │   ├── auth/                   # CPF + OTP + access_log
│   │   │   ├── imersoes/               # disponíveis, inscrever, reagendar, cancelar
│   │   │   ├── me/                     # minhas inscrições
│   │   │   └── mail/                   # Gmail OAuth2 (nodemailer + googleapis) + email_log
│   │   └── api/index.ts                # entrypoint serverless da Vercel
│   └── web/                          # React Vite mobile-first (preto/vermelho/branco)
├── sql/init-imersao-aluno.sql        # roda 1× no banco novo
├── vercel.json
└── package.json (npm workspaces)
```

## Endpoints

| Método | Rota | Auth | Função |
|--------|------|------|--------|
| POST | `/api/auth/cpf` | rate-limit | Valida CPF, envia OTP por email via Gmail OAuth2 (grava `email_log`+`access_log`) |
| POST | `/api/auth/otp` | rate-limit | Verifica código, emite cookie de sessão |
| POST | `/api/auth/logout` | JWT | Limpa cookie + grava logout |
| GET | `/api/auth/me` | JWT | Dados do aluno logado |
| GET | `/api/imersoes/disponiveis` | JWT | Lista filtrada (vagas, tipo já feito, abertura) |
| GET | `/api/imersoes/:id` | JWT | Detalhe |
| POST | `/api/imersoes/:id/inscrever` | JWT | Inscreve (transação Serializable) |
| GET | `/api/me/inscricoes` | JWT | Inscrições futuras |
| POST | `/api/me/inscricoes/:id/reagendar` | JWT | Reagenda se > 15 dias |
| DELETE | `/api/me/inscricoes/:id` | JWT | Cancela se > 15 dias |

## Regras de negócio

- **Adimplência** (`status_financeiro ~ /inadimplent/i`) bloqueia login.
- **Punição vigente** em `pf_punicoes` bloqueia login.
- **Tipo já participado** (qualquer `presenca_* = true` em agendamento do mesmo `tipo`) impede nova inscrição.
- **Cancelar/reagendar < 15 dias** → redireciona para tela de contato com o suporte.
- **Inscrição** em transação `Serializable` para evitar overselling.

## Observabilidade (banco novo)

Cada login/OTP/logout/bloqueio grava em `public.access_log`. Cada envio de email grava em `public.email_log` com `provider_id` = `messageId` retornado pelo Gmail.

```sql
-- Últimos acessos
SELECT criado_em, evento, matricula, ip
FROM public.access_log
ORDER BY id DESC LIMIT 20;

-- Últimos emails
SELECT criado_em, destinatario, tipo, status, provider_id
FROM public.email_log
ORDER BY id DESC LIMIT 20;
```

## Deploy na Vercel

1. Push do repo para o GitHub.
2. New Project → importar o repo.
3. Settings ficam inferidas pelo `vercel.json`.
4. **Environment Variables**: copiar todas as chaves de `.env.example` (incluindo `DATABASE_URL_LOVABLE` e `DATABASE_URL_IMERSAO`).
5. Atribuir o domínio `imersao-ppg.liberdademedicaedu.com.br` ao projeto + CNAME no DNS.
6. Configurar `GMAIL_USER`, `GMAIL_OAUTH_CLIENT_ID`, `GMAIL_OAUTH_CLIENT_SECRET`, `GMAIL_OAUTH_REFRESH_TOKEN` e `MAIL_FROM` (ver [Setup do Gmail OAuth2](#setup-do-gmail-oauth2)).

## Importante

**Não usar `prisma migrate` no banco antigo** (`liberdade-medica`). Para mudanças de schema lá, escrever SQL manual, validar com o time admin e aplicar; depois rodar `npm run prisma:pull:lovable`. No banco novo (`imersao-aluno`) pode usar migrations livremente — é exclusivo deste app.
