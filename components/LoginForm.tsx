'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || 'No se pudo iniciar sesión');
      }

      router.push('/dashboard');
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-[2rem] border border-white/80 bg-white/80 shadow-[0_40px_120px_-32px_rgba(15,23,42,0.24)] backdrop-blur-xl">
      <div className="border-b border-orange-100 bg-gradient-to-r from-orange-500 via-amber-500 to-orange-400 px-8 py-8 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">Acceso seguro</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight">Entrar en Hermes</h2>
        <p className="mt-2 text-sm leading-6 text-white/80">
          Cada usuario entra con su cuenta privada y solo ve sus conversaciones, sus PDFs y
          su historial.
        </p>
      </div>

      <form onSubmit={onSubmit} className="space-y-5 px-8 py-8">
        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Usuario
          </label>
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            placeholder="jr_almiron"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            Contraseña
          </label>
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
            placeholder="••••••••••••"
          />
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={loading}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-slate-900/20 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/20 border-t-white animate-spin" />
          ) : null}
          Entrar en mi dashboard
        </button>
      </form>
    </div>
  );
}
