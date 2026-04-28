'use client';

import { useEffect, useState } from 'react';

interface TranscriptionItem {
  id: number;
  language: string | null;
  durationSeconds: number | null;
  formattedText: string;
  createdAt: string;
}

const LANGUAGE_LABELS: Record<string, string> = {
  spanish: 'Español',
  english: 'English',
  es: 'Español',
  en: 'English',
};

function getLanguageLabel(lang: string | null): string {
  if (!lang) return '--';
  return LANGUAGE_LABELS[lang.toLowerCase()] ?? lang;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')} min`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function truncate(text: string, max = 160): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function TranscriptionList({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<TranscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/transcriptions')
      .then((r) => r.json())
      .then((data: TranscriptionItem[]) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  const downloadPdf = async (id: number, createdAt: string) => {
    setDownloading(id);
    try {
      const res = await fetch(`/api/transcriptions/${id}/pdf`);
      if (!res.ok) throw new Error('Error al generar el PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const dateStr = createdAt.split('T')[0];
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcripcion-${dateStr}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('No se pudo descargar el PDF. Inténtalo de nuevo.');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 mt-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-800/40 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <svg
          className="w-10 h-10 mx-auto mb-3 text-gray-700"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
        <p className="text-gray-600 text-sm">Sin grabaciones todavía</p>
        <p className="text-gray-700 text-xs mt-1">Pulsa el botón para empezar</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-xs font-medium text-gray-600 uppercase tracking-widest mb-4">
        Historial &middot; {items.length} {items.length === 1 ? 'grabación' : 'grabaciones'}
      </p>
      <div className="space-y-3">
        {items.map((item) => (
          <div
            key={item.id}
            className="group bg-gray-900 border border-gray-800 hover:border-gray-700 rounded-xl p-5 transition-colors"
          >
            <div className="flex items-start gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="text-xs text-gray-500">{formatDate(item.createdAt)}</span>
                  <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">
                    {getLanguageLabel(item.language)}
                  </span>
                  <span className="text-xs text-gray-600 font-mono">
                    {formatDuration(item.durationSeconds)}
                  </span>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  {truncate(item.formattedText)}
                </p>
              </div>

              <button
                onClick={() => downloadPdf(item.id, item.createdAt)}
                disabled={downloading === item.id}
                title="Descargar PDF"
                className="shrink-0 flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500/15 hover:border-indigo-500/40 hover:text-indigo-300 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {downloading === item.id ? (
                  <>
                    <div className="w-3 h-3 border border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                    <span>PDF</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>PDF</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
