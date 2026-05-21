'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { AppFrame, HermesWordmark } from '@/components/AppFrame';
import { AccountSecurityCard } from '@/components/AccountSecurityCard';
import { RecorderApp } from '@/components/RecorderApp';
import type { CurrentUser } from '@/components/types';

interface DashboardViewProps {
  user: CurrentUser;
}

export function DashboardView({ user }: DashboardViewProps) {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [statsKey, setStatsKey] = useState(0);

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.replace('/login');
      router.refresh();
      setLoggingOut(false);
    }
  };

  return (
    <AppFrame
      eyebrow="Workspace personal"
      title={<HermesWordmark suffix="dashboard" />}
      subtitle={
        <>
          <strong className="font-semibold text-slate-700">{user.displayName || user.username}</strong>, aquí gestionas tus grabaciones, tus PDFs persistidos y tus chunks manuales.
          {user.role === 'admin' ? ' Como admin también tienes acceso al panel master de usuarios.' : ''}
        </>
      }
      actions={
        <>
          {user.role === 'admin' ? (
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-sm font-medium text-orange-700 transition hover:border-orange-300 hover:bg-orange-100"
            >
              Panel master
            </Link>
          ) : null}
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-50"
          >
            {loggingOut ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" /> : null}
            Cerrar sesión
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <AccountSecurityCard user={user} refreshKey={statsKey} />

        <section className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-[0_24px_80px_-42px_rgba(15,23,42,0.28)] backdrop-blur sm:p-8">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-500">Grabación privada</p>
                <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">Tu puesto de captura</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                  Graba nuevas conversaciones dentro de tu espacio. Hermes conserva tus chunks como respaldo hasta que decidas borrarlos manualmente.
                </p>
              </div>
              <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-right">
                <p className="text-[11px] uppercase tracking-[0.22em] text-orange-500">Propiedad</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">Solo tú</p>
              </div>
            </div>
            <RecorderApp currentUsername={user.username} onDone={() => setStatsKey((k) => k + 1)} />
          </div>

          <aside className="grid gap-6">
            <div className="rounded-[32px] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_24px_90px_-44px_rgba(15,23,42,0.8)]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-200">Workflow</p>
              <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em]">PDF seguro, chunks manuales</h3>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
                <li>1. Graba y transcribe por trozos de 60 segundos.</li>
                <li>2. Descarga el PDF cuando lo necesites.</li>
                <li>3. Conserva el respaldo hasta que pulses <span className="font-semibold text-orange-200">Borrar chunks</span>.</li>
              </ul>
            </div>
            <div className="rounded-[32px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.28)] backdrop-blur">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-500">Gobernanza personal</p>
              <h3 className="mt-3 text-xl font-semibold tracking-[-0.03em] text-slate-950">Tus límites de acceso</h3>
              <div className="mt-5 grid gap-3 text-sm text-slate-600">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">Solo ves, editas y descargas tus propias conversaciones.</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">Solo tú puedes cambiar tu contraseña.</div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">Los PDFs persistidos quedan disponibles para futuras descargas desde tu historial.</div>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </AppFrame>
  );
}
