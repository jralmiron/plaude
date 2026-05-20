'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionProfile } from '@/components/useSessionProfile';

export function HomeRouter() {
  const router = useRouter();
  const { loading, authenticated } = useSessionProfile();

  useEffect(() => {
    if (loading) return;
    router.replace(authenticated ? '/dashboard' : '/login');
  }, [authenticated, loading, router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.16),_transparent_35%),linear-gradient(180deg,_#fff7ed_0%,_#f8fafc_24%,_#f8fafc_100%)] px-6">
      <div className="rounded-[28px] border border-white/80 bg-white/90 px-8 py-10 text-center shadow-[0_24px_80px_-42px_rgba(15,23,42,0.38)] backdrop-blur">
        <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-[3px] border-orange-200 border-t-orange-500" />
        <p className="text-sm font-medium text-slate-700">Preparando tu espacio de Hermes…</p>
        <p className="mt-2 text-sm text-slate-400">Estamos comprobando tu sesión y cargando el dashboard adecuado.</p>
      </div>
    </div>
  );
}
