-- ============================================================================
-- Banco: imersao-aluno  ·  Schema: public  ·  Exclusivo do Portal do Aluno
-- ----------------------------------------------------------------------------
-- Executar UMA vez na primeira instalação. Idempotente.
-- ============================================================================

-- 1) OTP de autenticação (anteriormente em lovable.imersao_otp do banco antigo)
CREATE TABLE IF NOT EXISTS public.imersao_otp (
  matricula   varchar     NOT NULL,
  codigo_hash varchar     NOT NULL,
  expira_em   timestamptz NOT NULL,
  tentativas  int         NOT NULL DEFAULT 0,
  criado_em   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT imersao_otp_pk PRIMARY KEY (matricula)
);
CREATE INDEX IF NOT EXISTS idx_imersao_otp_expira_em
  ON public.imersao_otp (expira_em);

-- 2) Log de emails enviados pelo provider SMTP (debug e auditoria)
CREATE TABLE IF NOT EXISTS public.email_log (
  id           bigserial   NOT NULL,
  matricula    varchar     NULL,
  destinatario varchar     NOT NULL,
  tipo         varchar     NOT NULL,   -- 'otp', etc
  status       varchar     NOT NULL,   -- 'sent' | 'failed'
  provider_id  varchar     NULL,       -- messageId do SMTP (Gmail/nodemailer)
  erro         text        NULL,
  criado_em    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT email_log_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_email_log_matricula
  ON public.email_log (matricula, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_email_log_criado_em
  ON public.email_log (criado_em DESC);

-- 3) Log de acesso/auditoria (login, OTP, logout, bloqueios)
CREATE TABLE IF NOT EXISTS public.access_log (
  id         bigserial   NOT NULL,
  matricula  varchar     NULL,
  ip         varchar     NULL,
  user_agent text        NULL,
  evento     varchar     NOT NULL,    -- ver lista abaixo
  detalhe    text        NULL,
  criado_em  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT access_log_pk PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS idx_access_log_matricula
  ON public.access_log (matricula, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_access_log_criado_em
  ON public.access_log (criado_em DESC);

-- Eventos esperados no access_log:
--   login_cpf_ok                 - CPF localizado e OTP enviado
--   login_cpf_nao_encontrado     - CPF não encontrado em pf_alunos
--   bloqueado_sem_email          - email NULL em pf_alunos (pré-OTP)
--   bloqueado_inadimplente       - status_financeiro inadimplente (pós-OTP)
--   bloqueado_punicao            - punição vigente (pós-OTP)
--   otp_ok                       - OTP validado
--   otp_falhou                   - código incorreto
--   otp_expirado                 - OTP expirou antes da validação
--   logout                       - sessão encerrada

-- ============================================================================
-- 4) Permissões para o usuário da aplicação (ex: 'lovable')
--    GRANT em TABLE NÃO se propaga para a sequence implícita do bigserial.
--    Sem isso, INSERTs em access_log/email_log falham com erro 42501
--    "permission denied for sequence …".
--    Trocar 'lovable' pelo usuário da DATABASE_URL_IMERSAO se for diferente.
-- ============================================================================
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO lovable;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO lovable;
