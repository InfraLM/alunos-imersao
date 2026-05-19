import { useNavigate } from 'react-router-dom';
import { ArrowRight, ShieldCheck } from 'lucide-react';

import { PageShell } from '@/components/PageShell';
import { Wordmark } from '@/components/Wordmark';
import { Chip } from '@/components/Chip';

export default function Welcome() {
  const navigate = useNavigate();

  return (
    <PageShell variant="dark" full>
      <div className="flex min-h-dvh flex-col px-7 pb-8 pt-12 safe-top">
        <div className="flex items-center justify-between">
          <Wordmark dark />
          <div className="text-[11px] uppercase tracking-widest text-on-ink-muted">
            Imersões LM
          </div>
        </div>

        <div className="mt-12 flex-1">
          <Chip tone="ink" dot>
            Portal do aluno
          </Chip>

          <h1 className="serif mt-7 text-[56px] font-normal leading-[0.95] tracking-tight text-on-ink">
            Marque sua
            <br />
            <span className="italic-accent">imersão</span>
            <span className="text-on-ink">.</span>
          </h1>

          <p className="mt-5 max-w-[280px] text-[15px] leading-relaxed text-on-ink-muted">
            Reserve sua vaga em uma das próximas turmas presenciais com poucos toques.
            Tudo o que você precisa é do seu CPF em mãos.
          </p>

          <div className="mt-10 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="flex size-10 items-center justify-center rounded-xl bg-accent text-on-ink">
              <ShieldCheck className="size-5" strokeWidth={1.6} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-on-ink">
                Acesso seguro com CPF
              </p>
              <p className="text-xs text-on-ink-muted">
                Enviamos um código por email para confirmar é você.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-10">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-base font-medium text-on-ink transition active:scale-[.99]"
          >
            Começar com meu CPF
            <ArrowRight className="size-4" strokeWidth={2} />
          </button>
          <p className="mt-4 text-center text-xs text-on-ink-muted">
            Problemas para entrar? Entre em contato com o suporte.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
