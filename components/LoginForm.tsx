'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

const EyeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const EyeOffIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

const SHOW_DURATION_MS = 30_000;

export function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (hideTimerRef.current) { clearTimeout(hideTimerRef.current); hideTimerRef.current = null; }
    if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
  };

  const togglePassword = () => {
    if (showPassword) {
      clearTimers();
      setShowPassword(false);
      setCountdown(0);
      return;
    }
    setShowPassword(true);
    setCountdown(30);
    countdownRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) { clearTimers(); setShowPassword(false); return 0; }
        return c - 1;
      });
    }, 1000);
    hideTimerRef.current = setTimeout(() => {
      setShowPassword(false);
      setCountdown(0);
      clearTimers();
    }, SHOW_DURATION_MS);
  };

  useEffect(() => () => clearTimers(), []);

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
        <p className="text-xs font-semibold uppercase tracking-[0.35em] text-white/80">Bienvenid@</p>
        <h2 className="mt-3 text-3xl font-black tracking-tight">Hermes</h2>
        <p className="mt-2 text-sm leading-6 text-white/80">
          INTRODUCE TU USUARIO Y TU CONTRASEÑA
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
          <label className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
            <span>Contraseña</span>
            {showPassword && countdown > 0 ? (
              <span className="text-[10px] font-normal normal-case tracking-normal text-orange-400">
                Se oculta en {countdown}s
              </span>
            ) : null}
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
              placeholder="••••••••••••"
            />
            <button
              type="button"
              onClick={togglePassword}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-xl p-1.5 text-slate-400 transition hover:text-slate-700"
              tabIndex={-1}
              aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
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
