import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { LoginForm } from '@/components/LoginForm';

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) {
    redirect('/dashboard');
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(249,115,22,0.14),_transparent_35%),linear-gradient(180deg,#fff7ed_0%,#f8fafc_35%,#eef2ff_100%)]">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center gap-12 px-6 py-12">
        <section className="hidden flex-1 lg:block">
          <div className="max-w-xl">
            <div className="mb-6 inline-flex items-center rounded-full border border-orange-200 bg-white/80 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-orange-600 shadow-sm backdrop-blur">
              Hermes privado
            </div>
            <h1 className="text-6xl font-black tracking-tight text-slate-900">
              Her<span className="text-orange-500">mes</span>
            </h1>
            <p className="mt-6 text-xl leading-8 text-slate-600">
              Grabación, transcripción y custodia documental con acceso segmentado por usuario,
              panel master para Juanra y biblioteca privada de PDFs en base de datos.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-4">
              {[
                'Acceso privado por usuario',
                'PDFs persistentes y redescargables',
                'Chunks conservados hasta borrado manual',
                'Dashboard personal y panel master',
              ].map((item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-white/70 bg-white/70 px-4 py-4 text-sm text-slate-700 shadow-[0_16px_50px_-24px_rgba(15,23,42,0.22)] backdrop-blur"
                >
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="w-full max-w-md flex-1">
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
