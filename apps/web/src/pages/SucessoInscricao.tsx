import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Check, MessageCircle } from 'lucide-react';

import { PageShell } from '@/components/PageShell';
import { Wordmark } from '@/components/Wordmark';
import { Ticket } from '@/components/Ticket';
import { Chip } from '@/components/Chip';
import { useSession } from '@/hooks/useSession';
import { api, type ImersaoDisponivel } from '@/lib/api';
import { formatarFimDeSemana } from '@/lib/datas';

export default function SucessoInscricao() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useSession();
  const [imersao, setImersao] = useState<ImersaoDisponivel | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await api.get<ImersaoDisponivel>(`/api/imersoes/${id}`);
        if (!cancelled) setImersao(r);
      } catch {
        if (!cancelled) navigate('/app/minhas', { replace: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, navigate]);

  const codigo = user && id ? `LM-${user.matricula}-${id}`.toUpperCase() : 'LM-…';

  return (
    <PageShell variant="dark" full>
      <div className="flex min-h-dvh flex-col px-7 pb-8 pt-12 safe-top">
        <Wordmark dark />

        <div className="mt-9">
          <div
            className="flex size-20 items-center justify-center rounded-3xl bg-accent text-on-ink"
            style={{ boxShadow: '0 0 0 10px hsl(var(--accent) / 0.18)' }}
          >
            <Check className="size-10" strokeWidth={2.4} />
          </div>
          <h1 className="serif mt-6 text-[44px] leading-[1.0] tracking-tight">
            Vaga
            <br />
            <span className="italic-accent">confirmada</span>.
          </h1>
          <p className="mt-4 max-w-[320px] text-[15px] leading-relaxed text-on-ink-muted">
            Anote:{' '}
            <strong className="text-on-ink">
              {imersao ? formatarFimDeSemana(imersao.dataImersao) : '—'}
            </strong>
            . Os detalhes foram enviados para o seu email.
          </p>
        </div>

        {imersao ? (
          <div className="mt-7">
            <Ticket
              top={
                <>
                  <div className="flex items-center justify-between">
                    <Chip tone="ok">Confirmada</Chip>
                    <span className="mono text-[11px] text-muted-foreground">{codigo}</span>
                  </div>
                  <div className="serif mt-3 text-[22px] leading-tight">{imersao.tipo.nome}</div>
                  <div className="mt-3">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Quando
                    </div>
                    <div className="mt-1 text-sm font-medium leading-snug">
                      {formatarFimDeSemana(imersao.dataImersao)}
                    </div>
                  </div>
                </>
              }
              bottom={
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Detalhes no email</span>
                  <span className="mono">{codigo}</span>
                </div>
              }
            />
          </div>
        ) : null}

        <div className="mt-auto flex flex-col gap-2 pt-8">
          {imersao?.linkGrupoWhatsapp ? (
            <a
              href={imersao.linkGrupoWhatsapp}
              target="_blank"
              rel="noreferrer"
              className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-[#25D366] text-base font-medium text-white active:scale-[.99]"
            >
              <MessageCircle className="size-5" strokeWidth={1.8} />
              Entrar no grupo do WhatsApp
            </a>
          ) : null}
          <button
            type="button"
            onClick={() => navigate('/app/minhas', { replace: true })}
            className="flex h-14 items-center justify-center rounded-2xl bg-accent text-base font-medium text-on-ink active:scale-[.99]"
          >
            Ver minhas inscrições
          </button>
          <button
            type="button"
            onClick={() => navigate('/app', { replace: true })}
            className="text-sm text-on-ink-muted active:opacity-70"
          >
            Voltar ao início
          </button>
        </div>
      </div>
    </PageShell>
  );
}
