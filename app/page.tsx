import { RecorderApp } from '@/components/RecorderApp';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-950">
      <div className="max-w-2xl mx-auto px-4 py-16">
        <header className="text-center mb-10">
          <h1 className="text-5xl font-bold tracking-tight">
            pla<span className="text-indigo-400">ude</span>
          </h1>
          <p className="text-gray-600 text-sm mt-3 tracking-wide">
            Graba · Transcribe con IA · Descarga en PDF
          </p>
        </header>
        <RecorderApp />
      </div>
    </main>
  );
}
