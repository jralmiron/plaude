'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSessionProfile } from '@/components/useSessionProfile';
import type { CurrentUser } from '@/components/types';

interface AccountSecurityCardProps {
  user: CurrentUser;
  refreshKey?: number;
}

function statValue(value?: number) {
  return typeof value === 'number' ? value.toLocaleString('es-ES') : '—';
}

export function AccountSecurityCard({ user, refreshKey = 0 }: AccountSecurityCardProps) {
  const router = useRouter();
  const { data: sessionData, refresh: refreshStats } = useSessionProfile();
  const [currentPassword, setCurrentPassword] = useState('');
  const [nextPassword, setNextPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (refreshKey > 0) void refreshStats();
  }, [refreshKey, refreshStats]);

  const stats = useMemo(
    () => [
      { label: 'Conversaciones', value: statValue(sessionData?.stats?.conversations) },
      { label: 'PDFs guardados', value: statValue(sessionData?.stats?.pdfs) },
      { label: 'Chunks pendientes', value: statValue(sessionData?.stats?.pendingChunks) },
      { label: 'Minutos transcritos', value: statValue(sessionData?.stats?.minutes) },
    ],
    [sessionData?.stats?.conversations, sessionData?.stats?.minutes, sessionData?.stats?.pdfs, sessionData?.stats?.pendingChunks],
  );

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage(null);

    if (nextPassword !== confirmPassword) {
      setMessage({ tone: 'error', text: 'La confirmación no coincide con la nueva contraseña.' });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ currentPassword, newPassword: nextPassword }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload.error || 'No se pudo actualizar la contraseña');
      }
      setCurrentPassword('');
      setNextPassword('');
      setConfirmPassword('');
      setMessage({ tone: 'success', text: 'Contraseña actualizada correctamente.' });
      router.refresh();
    } catch (err) {
      setMessage({ tone: 'error', text: (err as Error).message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-500">Mi cuenta</p>
            <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">Perfil y acceso</h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
              Gestiona tu contraseña y consulta el estado de tus conversaciones, PDFs persistidos y chunks aún disponibles para respaldo.
            </p>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-orange-50 px-3 py-2 text-right">
            <p className="text-[11px] uppercase tracking-[0.22em] text-orange-500">Usuario</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{user.username}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">{stat.label}</p>
              <p className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-slate-950">{stat.value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[28px] border border-slate-200/80 bg-white/90 p-6 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.28)] backdrop-blur">
        <div className="mb-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-500">Seguridad</p>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">Cambiar contraseña</h3>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Contraseña actual</label>
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Nueva contraseña</label>
            <input
              type="password"
              autoComplete="new-password"
              value={nextPassword}
              onChange={(event) => setNextPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Confirmar nueva contraseña</label>
            <input
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            />
          </div>

          {message ? (
            <div className={`rounded-2xl px-4 py-3 text-sm ${message.tone === 'success' ? 'border border-emerald-200 bg-emerald-50 text-emerald-700' : 'border border-red-200 bg-red-50 text-red-600'}`}>
              {message.text}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !currentPassword || !nextPassword || !confirmPassword}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
            Guardar nueva contraseña
          </button>
        </form>
      </section>
    </div>
  );
}
