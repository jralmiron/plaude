'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, useEffect } from 'react';
import { HermesWordmark } from '@/components/AppFrame';
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
  const [menuOpen, setMenuOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Cierra el menú al hacer click fuera
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const logout = async () => {
    setLoggingOut(true);
    setMenuOpen(false);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.replace('/login');
      router.refresh();
      setLoggingOut(false);
    }
  };

  const initials = (user.displayName || user.username).slice(0, 1).toUpperCase();

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.12),_transparent_30%),linear-gradient(180deg,_#fff7ed_0%,_#f8fafc_18%,_#f8fafc_100%)]">
      {/* Navbar */}
      <header className="sticky top-0 z-30 border-b border-slate-200/60 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
          <span className="text-xl font-semibold tracking-[-0.04em] text-slate-950">
            <HermesWordmark />
          </span>

          <div className="flex items-center gap-2">
            {user.role === 'admin' ? (
              <Link
                href="/admin"
                className="rounded-xl border border-orange-200 bg-orange-50 px-3 py-1.5 text-xs font-semibold text-orange-700 transition hover:bg-orange-100"
              >
                Admin
              </Link>
            ) : null}

            {/* Avatar + dropdown */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100 text-sm font-semibold text-orange-700 transition hover:bg-orange-200"
              >
                {initials}
              </button>

              {menuOpen ? (
                <div className="absolute right-0 top-10 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_48px_-12px_rgba(15,23,42,0.22)]">
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="text-sm font-semibold text-slate-900">{user.displayName || user.username}</p>
                    <p className="text-xs text-slate-400">@{user.username}</p>
                  </div>
                  <div className="p-1.5">
                    <button
                      type="button"
                      onClick={() => { setAccountOpen((v) => !v); setMenuOpen(false); }}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                      Mi cuenta
                    </button>
                    {user.role === 'admin' ? (
                      <Link
                        href="/admin"
                        onClick={() => setMenuOpen(false)}
                        className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-slate-50"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z"/><path d="M12 8v4l3 3"/></svg>
                        Panel de administración
                      </Link>
                    ) : null}
                    <div className="my-1 border-t border-slate-100" />
                    <button
                      type="button"
                      onClick={logout}
                      disabled={loggingOut}
                      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                    >
                      {loggingOut
                        ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-300 border-t-red-600" />
                        : <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      }
                      Cerrar sesión
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {/* Panel Mi cuenta (colapsable) */}
      {accountOpen ? (
        <div className="border-b border-slate-200/60 bg-white/80 backdrop-blur">
          <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
            <AccountSecurityCard user={user} refreshKey={statsKey} />
          </div>
        </div>
      ) : null}

      {/* Contenido principal */}
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <RecorderApp currentUsername={user.username} onDone={() => setStatsKey((k) => k + 1)} />
      </div>
    </main>
  );
}

