import { useNavigate } from 'react-router-dom';
import { CalendarPlus, ChevronRight, GraduationCap, History, ListChecks, LogOut } from 'lucide-react';

import { PageShell } from '@/components/PageShell';
import { Avatar } from '@/components/Avatar';
import { Wordmark } from '@/components/Wordmark';
import { StatusBanner } from '@/components/StatusBanner';
import { useSession } from '@/hooks/useSession';

export default function Home() {
  const { user, logout } = useSession();
  const navigate = useNavigate();

  return (
    <PageShell>
      <div className="flex items-center justify-between">
        <Wordmark />
        <button
          type="button"
          onClick={async () => {
            await logout();
            navigate('/', { replace: true });
          }}
          aria-label="Sair"
          className="flex size-10 items-center justify-center rounded-xl bg-secondary text-foreground active:scale-95"
        >
          <LogOut className="size-4" strokeWidth={1.6} />
        </button>
      </div>

      <div className="mt-7 flex items-center gap-3">
        <Avatar nome={user?.nome ?? ''} size="md" />
        <div className="min-w-0">
          <div className="text-[12px] uppercase tracking-widest text-muted-foreground">
            Bem-vindo(a) de volta
          </div>
          <div className="mt-0.5 text-base font-medium tracking-tight">
            {user?.nome ?? '—'}
          </div>
          {user?.turma ? (
            <div className="mt-0.5 text-xs text-muted-foreground">
              Turma {user.turma}
            </div>
          ) : null}
        </div>
      </div>

      <h1 className="serif mt-7 text-[36px] leading-[1.05]">
        O que você quer fazer com sua próxima <span className="italic-accent">imersão</span>?
      </h1>

      <div className="mt-6">
        <StatusBanner
          inadimplente={user?.bloqueios?.inadimplente}
          punicao={user?.bloqueios?.punicao}
        />
      </div>

      <div className="mt-1 space-y-3">
        <ActionCard
          onClick={() => navigate('/app/agendar')}
          title="Agendar imersão"
          subtitle="Ver as imersões disponíveis"
          icon={<CalendarPlus className="size-5" strokeWidth={1.6} />}
        />
        <ActionCard
          onClick={() => navigate('/app/minhas')}
          title="Minhas inscrições"
          subtitle="Cancelar, reagendar ou consultar"
          icon={<ListChecks className="size-5" strokeWidth={1.6} />}
        />
        <ActionCard
          onClick={() => navigate('/app/historico')}
          title="Histórico"
          subtitle="Imersões em que você participou"
          icon={<History className="size-5" strokeWidth={1.6} />}
        />
        <ActionCard
          onClick={() => navigate('/app/academico')}
          title="Acadêmico"
          subtitle="Seu histórico, horas e PDF"
          icon={<GraduationCap className="size-5" strokeWidth={1.6} />}
        />
      </div>
    </PageShell>
  );
}

function ActionCard({
  onClick,
  title,
  subtitle,
  icon,
}: {
  onClick: () => void;
  title: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-2xl bg-ink p-5 text-left text-on-ink transition active:scale-[.99]"
    >
      <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent text-on-ink">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-base font-medium tracking-tight">{title}</p>
        <p className="mt-0.5 text-xs text-on-ink-muted">{subtitle}</p>
      </div>
      <ChevronRight className="size-5 text-on-ink-muted" />
    </button>
  );
}
