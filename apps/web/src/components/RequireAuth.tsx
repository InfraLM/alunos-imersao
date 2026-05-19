import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useSession } from '@/hooks/useSession';
import { PageShell } from './PageShell';
import { Skeleton } from './ui/skeleton';

export function RequireAuth() {
  const { loading, user } = useSession();
  const location = useLocation();

  if (loading) {
    return (
      <PageShell>
        <div className="space-y-3 pt-10">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </PageShell>
    );
  }

  if (!user) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
