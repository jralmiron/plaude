'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TranscriptionItem } from '@/components/types';

const LANG_LABELS: Record<string, string> = {
  spanish: 'Español', english: 'English',
  es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch', pt: 'Português', it: 'Italiano',
};

const TRANSLATE_OPTIONS = [
  { code: 'es', label: 'Español' },
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'pt', label: 'Português' },
  { code: 'it', label: 'Italiano' },
];

function langLabel(lang: string | null): string {
  if (!lang) return '—';
  return LANG_LABELS[lang.toLowerCase()] ?? lang;
}

function fmtDuration(s: number | null): string {
  if (!s) return '—';
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')} min`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function truncate(text: string, max = 220): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function renderFormattedText(text: string) {
  const parts = text.split(/(\[Persona \d+\])/g);
  return parts.map((part, i) =>
    /\[Persona \d+\]/.test(part) ? (
      <span key={i} className="font-semibold text-orange-600">{part} </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function TranscriptionList({ refreshKey, currentUsername }: { refreshKey: number; currentUsername?: string }) {
  const [items, setItems] = useState<TranscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [cleaningChunks, setCleaningChunks] = useState<number | null>(null);
  const [confirmCleanup, setConfirmCleanup] = useState<number | null>(null);
  const [translating, setTranslating] = useState<number | null>(null);
  const [translateOpen, setTranslateOpen] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/transcriptions', { cache: 'no-store' })
      .then((r) => r.json())
      .then((data: TranscriptionItem[]) => {
        setItems(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [editText]);

  const summary = useMemo(() => {
    const totalMinutes = items.reduce((acc, item) => acc + (item.durationSeconds || 0), 0) / 60;
    const pdfs = items.filter((item) => item.hasStoredPdf).length;
    return {
      conversations: items.length,
      minutes: totalMinutes ? totalMinutes.toFixed(totalMinutes >= 10 ? 0 : 1) : '0',
      pdfs,
    };
  }, [items]);

  const startEdit = (item: TranscriptionItem) => {
    setEditing(item.id);
    setEditText(item.formattedText);
    setExpanded(item.id);
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditText('');
  };

  const saveEdit = async (id: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/transcriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formattedText: editText }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, formattedText: editText } : i)));
      setEditing(null);
      setEditText('');
    } catch {
      alert('No se pudo guardar el texto.');
    } finally {
      setSaving(false);
    }
  };

  const deleteItem = async (id: number) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/transcriptions/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Error al borrar');
      setItems((prev) => prev.filter((i) => i.id !== id));
      if (expanded === id) setExpanded(null);
    } catch {
      alert('No se pudo borrar la transcripción.');
    } finally {
      setDeleting(null);
      setConfirmDelete(null);
    }
  };

  const translateItem = async (id: number, targetLang: string) => {
    setTranslating(id);
    setTranslateOpen(null);
    try {
      const res = await fetch(`/api/transcriptions/${id}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetLang }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Error ${res.status}`);
      }
      const data: { formattedText: string; outputLanguage: string } = await res.json();
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, formattedText: data.formattedText, outputLanguage: data.outputLanguage } : i)),
      );
    } catch (err) {
      alert(`No se pudo traducir: ${(err as Error).message}`);
    } finally {
      setTranslating(null);
    }
  };

  const downloadPdf = async (id: number, createdAt: string) => {
    setDownloading(id);
    try {
      const res = await fetch(`/api/transcriptions/${id}/pdf`);
      if (!res.ok) throw new Error('Error PDF');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcripcion-${createdAt.split('T')[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, hasStoredPdf: true, pdfStoredAt: new Date().toISOString() } : item)));
    } catch {
      alert('No se pudo descargar el PDF.');
    } finally {
      setDownloading(null);
    }
  };

  const cleanupChunks = async (id: number) => {
    setCleaningChunks(id);
    try {
      const res = await fetch(`/api/transcriptions/${id}/cleanup`, { method: 'POST' });
      if (!res.ok) throw new Error('Error al borrar chunks');
      const data: { deletedChunks?: number } = await res.json();
      alert(
        data.deletedChunks && data.deletedChunks > 0
          ? `Se borraron ${data.deletedChunks} ${data.deletedChunks === 1 ? 'chunk' : 'chunks'}.`
          : 'No había chunks pendientes para borrar.'
      );
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, chunkCount: 0 } : item)));
    } catch {
      alert('No se pudieron borrar los chunks.');
    } finally {
      setCleaningChunks(null);
      setConfirmCleanup(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-32 animate-pulse rounded-[24px] bg-slate-100" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50 px-6 py-16 text-center">
        <svg className="mx-auto mb-4 h-12 w-12 text-slate-300" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
        <p className="text-base font-medium text-slate-700">Todavía no tienes conversaciones guardadas</p>
        <p className="mt-2 text-sm text-slate-400">Cuando grabes la primera sesión, aparecerá aquí con sus opciones de PDF, edición y gestión manual de chunks.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-500">Archivo personal</p>
          <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            {currentUsername ? `Conversaciones de ${currentUsername}` : 'Conversaciones'}
          </h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">Tu historial privado incluye textos editables, PDFs persistidos y el control manual para eliminar chunks cuando ya no hagan falta.</p>
        </div>
        <div className="grid grid-cols-3 gap-3 self-stretch sm:self-auto">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Sesiones</p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">{summary.conversations}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Minutos</p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">{summary.minutes}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
            <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">PDFs</p>
            <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-slate-950">{summary.pdfs}</p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {items.map((item) => {
          const isExpanded = expanded === item.id;
          const isEditing = editing === item.id;
          const isConfirmingDelete = confirmDelete === item.id;
          const isConfirmingCleanup = confirmCleanup === item.id;

          return (
            <article
              key={item.id}
              className="overflow-hidden rounded-[26px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,1)_0%,_rgba(248,250,252,0.88)_100%)] shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)] transition hover:border-slate-300"
            >
              <button
                type="button"
                className="flex w-full items-start gap-4 p-5 text-left sm:p-6"
                onClick={() => !isEditing && setExpanded(isExpanded ? null : item.id)}
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 text-sm font-semibold text-orange-600">
                  #{item.id}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">{fmtDate(item.createdAt)}</span>
                    {item.ownerDisplayName && item.ownerUsername && item.ownerUsername !== currentUsername ? (
                      <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2.5 py-1 text-xs text-indigo-700">
                        {item.ownerDisplayName} · @{item.ownerUsername}
                      </span>
                    ) : null}
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">
                      {langLabel(item.language)} → {langLabel(item.outputLanguage)}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-500">
                      {fmtDuration(item.durationSeconds)}
                    </span>
                    {item.hasStoredPdf ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs text-emerald-700">PDF guardado</span>
                    ) : null}
                    {typeof item.chunkCount === 'number' && item.chunkCount > 0 ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs text-amber-700">{item.chunkCount} chunks</span>
                    ) : null}
                  </div>
                  <p className="text-sm leading-6 text-slate-600">{truncate(item.formattedText)}</p>
                </div>
                <svg className={`mt-1 h-5 w-5 shrink-0 text-slate-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {isExpanded ? (
                <div className="border-t border-slate-200 px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
                  {isEditing ? (
                    <div className="space-y-4">
                      <textarea
                        ref={textareaRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="min-h-[160px] w-full resize-none rounded-2xl border border-orange-200 bg-orange-50/40 p-4 text-sm leading-7 text-slate-800 outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100"
                      />
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => saveEdit(item.id)}
                          disabled={saving}
                          className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-orange-400 disabled:opacity-50"
                        >
                          {saving ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
                          Guardar
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500 transition hover:border-slate-300 hover:text-slate-800"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap text-sm leading-7 text-slate-700">{renderFormattedText(item.formattedText)}</div>
                  )}

                  {!isEditing ? (
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-200 pt-4">
                      <button
                        onClick={() => downloadPdf(item.id, item.createdAt)}
                        disabled={downloading === item.id}
                        className="inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-orange-700 transition hover:border-orange-300 hover:bg-orange-100 disabled:opacity-40"
                      >
                        {downloading === item.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-orange-300 border-t-orange-700" /> : null}
                        PDF
                      </button>

                      {isConfirmingCleanup ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          <span>¿Borrar chunks de respaldo?</span>
                          <button
                            onClick={() => cleanupChunks(item.id)}
                            disabled={cleaningChunks === item.id}
                            className="rounded-xl bg-amber-500 px-3 py-1.5 font-semibold text-white transition hover:bg-amber-400 disabled:opacity-50"
                          >
                            {cleaningChunks === item.id ? 'Borrando…' : 'Sí, borrar'}
                          </button>
                          <button onClick={() => setConfirmCleanup(null)} className="font-semibold text-amber-700 transition hover:text-amber-900">Cancelar</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmCleanup(item.id)}
                          disabled={cleaningChunks === item.id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 transition hover:border-amber-300 hover:bg-amber-100 disabled:opacity-40"
                        >
                          {cleaningChunks === item.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-amber-300 border-t-amber-700" /> : null}
                          Borrar chunks
                        </button>
                      )}

                      <button
                        onClick={() => startEdit(item)}
                        className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
                      >
                        Editar
                      </button>

                      <div className="relative">
                        <button
                          onClick={() => setTranslateOpen(translateOpen === item.id ? null : item.id)}
                          disabled={translating === item.id}
                          className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-40"
                        >
                          {translating === item.id ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" /> : null}
                          Traducir
                        </button>
                        {translateOpen === item.id ? (
                          <div className="absolute left-0 top-full z-50 mt-2 min-w-[160px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
                            {TRANSLATE_OPTIONS.map((opt) => (
                              <button
                                key={opt.code}
                                onClick={() => translateItem(item.id, opt.code)}
                                className="block w-full px-4 py-2.5 text-left text-xs font-medium text-slate-600 transition hover:bg-orange-50 hover:text-orange-700"
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                      </div>

                      {isConfirmingDelete ? (
                        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                          <span>¿Seguro que quieres borrar esta conversación?</span>
                          <button
                            onClick={() => deleteItem(item.id)}
                            disabled={deleting === item.id}
                            className="rounded-xl bg-red-600 px-3 py-1.5 font-semibold text-white transition hover:bg-red-500 disabled:opacity-50"
                          >
                            {deleting === item.id ? 'Borrando…' : 'Sí, borrar'}
                          </button>
                          <button onClick={() => setConfirmDelete(null)} className="font-semibold text-red-700 transition hover:text-red-900">Cancelar</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(item.id)}
                          className="rounded-2xl border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
                        >
                          Borrar
                        </button>
                      )}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </div>
  );
}
