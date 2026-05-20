import { useEffect, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, ArrowRight, ClipboardPaste, Loader2, MailCheck } from 'lucide-react';

import { PageShell } from '@/components/PageShell';
import { Keypad } from '@/components/Keypad';
import { MaskedDigits } from '@/components/MaskedDigits';
import { api, ApiError, type LoginCpfResponse, type OtpResponse } from '@/lib/api';

interface NavState {
  cpf: string;
  emailMascarado: string;
}

export default function VerificarOtp() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as NavState | null;

  const [codigo, setCodigo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(60);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);

  if (!state?.cpf) return <Navigate to="/" replace />;

  function onDigit(d: string) {
    setCodigo((c) => (c.length >= 6 ? c : c + d));
  }
  function onBackspace() {
    setCodigo((c) => c.slice(0, -1));
  }

  async function onPasteCodigo() {
    if (submitting) return;
    try {
      const text = await navigator.clipboard.readText();
      const digits = text.replace(/\D/g, '').slice(0, 6);
      if (!digits) {
        toast.error('Nenhum número encontrado para colar.');
        return;
      }
      setCodigo(digits);
      if (digits.length < 6) {
        toast.error('O código copiado não tem 6 dígitos.');
      }
    } catch {
      toast.error('Não foi possível acessar a área de transferência.');
    }
  }

  async function onSubmit() {
    if (codigo.length !== 6 || submitting) return;
    setSubmitting(true);
    try {
      const r = await api.post<OtpResponse>('/api/auth/otp', {
        cpf: state!.cpf,
        codigo,
      });
      toast.success(`Bem-vindo(a), ${r.primeiroNome}!`);
      navigate('/app', { replace: true });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : 'Falha ao validar o código.';
      toast.error(msg);
      setCodigo('');
      setSubmitting(false);
    }
  }

  async function onResend() {
    if (cooldown > 0) return;
    try {
      const r = await api.post<LoginCpfResponse>('/api/auth/cpf', { cpf: state!.cpf });
      if (r.status === 'otp_enviado') {
        toast.success('Novo código enviado.');
        setCooldown(60);
      } else if (r.status === 'bloqueado') {
        navigate('/bloqueado', { state: { motivo: r.motivo, mensagem: r.mensagem } });
      } else {
        toast.error(r.mensagem);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Falha ao reenviar.');
    }
  }

  return (
    <PageShell>
      <div className="flex min-h-dvh flex-col">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/login', { replace: true })}
            aria-label="Trocar CPF"
            className="flex h-10 items-center gap-1 rounded-xl bg-secondary px-3 text-sm font-medium active:scale-95"
          >
            <ArrowLeft className="size-4" />
            Trocar CPF
          </button>
          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Passo 2 de 2
          </div>
          <div className="size-10" />
        </div>

        <div className="mt-3">
          <div className="mb-3 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
            <MailCheck className="size-6" strokeWidth={1.6} />
          </div>
          <h2 className="serif text-[32px] leading-tight">
            Verifique seu <span className="italic-accent">email</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            O código foi enviado para o e-mail{' '}
            <strong className="text-foreground">{state.emailMascarado}</strong>. Ele expira em 5 minutos.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border bg-card px-5 py-5">
          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Código
          </div>
          <div className="mt-2">
            <MaskedDigits value={codigo} mask="otp" showCursor={false} />
          </div>
        </div>

        <button
          type="button"
          onClick={onPasteCodigo}
          disabled={submitting}
          className="mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-secondary text-sm font-medium text-foreground transition active:scale-[.99] disabled:opacity-40"
        >
          <ClipboardPaste className="size-4" strokeWidth={1.8} />
          Colar código
        </button>

        <button
          type="button"
          onClick={onResend}
          disabled={cooldown > 0}
          className="mt-4 text-center text-sm text-muted-foreground transition hover:text-foreground disabled:opacity-50"
        >
          {cooldown > 0 ? `Reenviar código em ${cooldown}s` : 'Reenviar código'}
        </button>

        <div className="mt-auto pt-6">
          <Keypad onDigit={onDigit} onBackspace={onBackspace} disabled={submitting} />
          <button
            type="button"
            onClick={onSubmit}
            disabled={codigo.length !== 6 || submitting}
            className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-on-ink font-medium transition active:scale-[.99] disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Entrar
                <ArrowRight className="size-4" strokeWidth={2} />
              </>
            )}
          </button>
        </div>
      </div>
    </PageShell>
  );
}
