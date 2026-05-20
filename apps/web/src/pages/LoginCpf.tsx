import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowRight, ChevronLeft, Loader2, ShieldCheck } from 'lucide-react';

import { PageShell } from '@/components/PageShell';
import { Keypad } from '@/components/Keypad';
import { MaskedDigits } from '@/components/MaskedDigits';
import { LoadingChecklist, type ChecklistStep } from '@/components/LoadingChecklist';
import { api, ApiError, type LoginCpfResponse } from '@/lib/api';
import { isValidCpfFormat } from '@/lib/cpf';

export default function LoginCpf() {
  const navigate = useNavigate();
  const [cpf, setCpf] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [steps, setSteps] = useState<ChecklistStep[]>([]);

  const valid = isValidCpfFormat(cpf);

  function onDigit(d: string) {
    setCpf((c) => (c.length >= 11 ? c : c + d));
  }
  function onBackspace() {
    setCpf((c) => c.slice(0, -1));
  }

  async function onSubmit() {
    if (!valid || submitting) return;
    setSubmitting(true);
    setSteps([
      { label: 'CPF localizado', state: 'loading' },
      { label: 'Conferindo matrícula', state: 'pending' },
      { label: 'Enviando código', state: 'pending' },
    ]);

    const t1 = setTimeout(
      () =>
        setSteps([
          { label: 'CPF localizado', state: 'done' },
          { label: 'Conferindo matrícula', state: 'loading' },
          { label: 'Enviando código', state: 'pending' },
        ]),
      450,
    );
    const t2 = setTimeout(
      () =>
        setSteps([
          { label: 'CPF localizado', state: 'done' },
          { label: 'Conferindo matrícula', state: 'done' },
          { label: 'Enviando código', state: 'loading' },
        ]),
      900,
    );

    try {
      const resp = await api.post<LoginCpfResponse>('/api/auth/cpf', { cpf });
      clearTimeout(t1);
      clearTimeout(t2);
      if (resp.status === 'otp_enviado') {
        navigate('/verificar', { state: { cpf, emailMascarado: resp.emailMascarado } });
        return;
      }
      if (resp.status === 'bloqueado') {
        navigate('/bloqueado', { state: { motivo: resp.motivo, mensagem: resp.mensagem } });
        return;
      }
      setSubmitting(false);
      setSteps([]);
      toast.error(resp.mensagem);
    } catch (err) {
      clearTimeout(t1);
      clearTimeout(t2);
      setSubmitting(false);
      setSteps([]);
      const msg = err instanceof ApiError ? err.message : 'Falha de conexão. Tente novamente.';
      toast.error(msg);
    }
  }

  return (
    <PageShell>
      <div className="flex min-h-dvh flex-col">
        <div className="mb-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/')}
            aria-label="Voltar"
            className="flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground active:scale-95"
          >
            <ChevronLeft className="size-5" />
          </button>
          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            Passo 1 de 2
          </div>
          <div className="size-10" />
        </div>

        <div className="mt-2">
          <h2 className="serif text-[34px] leading-[1.02]">
            Informe seu <span className="italic">CPF</span>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Usamos seu CPF apenas para localizar sua matrícula ativa.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border bg-card px-5 py-5">
          <div className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
            CPF
          </div>
          <div className="mt-2">
            <MaskedDigits value={cpf} mask="cpf" showCursor={false} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" strokeWidth={1.6} />
            <span>Dados criptografados — LGPD</span>
          </div>
        </div>

        <div className="mt-auto pt-6">
          <Keypad onDigit={onDigit} onBackspace={onBackspace} disabled={submitting} />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!valid || submitting}
            className="mt-3 flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-ink text-on-ink font-medium transition active:scale-[.99] disabled:opacity-40"
          >
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Continuar
                <ArrowRight className="size-4" strokeWidth={2} />
              </>
            )}
          </button>
        </div>
      </div>

      {submitting && steps.length > 0 ? (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 px-8 animate-fade-in">
          <div className="relative flex size-20 items-center justify-center rounded-3xl border bg-card">
            <div
              className="absolute -inset-2 rounded-[28px] border-2 border-accent"
              style={{
                borderRightColor: 'transparent',
                borderBottomColor: 'transparent',
                animation: 'spin 1s linear infinite',
              }}
            />
            <ShieldCheck className="size-7 text-foreground" strokeWidth={1.6} />
          </div>
          <h3 className="serif mt-7 text-[26px]">Localizando matrícula…</h3>
          <p className="mt-1 max-w-[280px] text-center text-sm text-muted-foreground">
            Consultando o CPF na base de alunos.
          </p>
          <div className="mt-8 w-full max-w-[280px]">
            <LoadingChecklist steps={steps} />
          </div>
        </div>
      ) : null}
    </PageShell>
  );
}
