import type { ReactNode } from 'react';

interface AppFrameProps {
  eyebrow?: string;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
}

export function AppFrame({ eyebrow, title, subtitle, actions, children }: AppFrameProps) {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(251,146,60,0.16),_transparent_30%),linear-gradient(180deg,_#fff7ed_0%,_#f8fafc_20%,_#f8fafc_100%)] text-slate-900">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-8 rounded-[28px] border border-white/70 bg-white/85 px-6 py-5 shadow-[0_24px_80px_-38px_rgba(15,23,42,0.28)] backdrop-blur-xl sm:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="space-y-3">
              {eyebrow ? (
                <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-500/90">
                  {eyebrow}
                </p>
              ) : null}
              <div>
                <h1 className="text-3xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-4xl">
                  {title}
                </h1>
                {subtitle ? (
                  <div className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 sm:text-[15px]">
                    {subtitle}
                  </div>
                ) : null}
              </div>
            </div>
            {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
          </div>
        </header>
        {children}
      </div>
    </main>
  );
}

export function HermesWordmark({ suffix }: { suffix?: string }) {
  return (
    <>
      Her<span className="text-orange-500">mes</span>
      {suffix ? <span className="ml-2 text-base font-normal text-slate-400 sm:text-lg">{suffix}</span> : null}
    </>
  );
}
