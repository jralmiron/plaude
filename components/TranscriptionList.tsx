'use client';

import { useEffect, useState, useRef } from 'react';

interface TranscriptionItem {
  id: number;
  language: string | null;
  outputLanguage: string | null;
  durationSeconds: number | null;
  formattedText: string;
  rawText: string;
  createdAt: string;
}

const LANG_LABELS: Record<string, string> = {
  spanish: 'Español', english: 'English',
  es: 'Español', en: 'English',
};

function langLabel(lang: string | null): string {
  if (!lang) return '--';
  return LANG_LABELS[lang.toLowerCase()] ?? lang;
}

function fmtDuration(s: number | null): string {
  if (!s) return '--';
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

function truncate(text: string, max = 160): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

// Formatea el texto mostrando etiquetas de persona con color
function renderFormattedText(text: string) {
  const parts = text.split(/(\[Persona \d+\])/g);
  return parts.map((part, i) =>
    /\[Persona \d+\]/.test(part) ? (
      <span key={i} className="text-indigo-600 font-semibold text-xs">{part} </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export function TranscriptionList({ refreshKey }: { refreshKey: number }) {
  const [items, setItems] = useState<TranscriptionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [editText, setEditText] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch('/api/transcriptions')
      .then((r) => r.json())
      .then((data: TranscriptionItem[]) => { setItems(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [refreshKey]);

  // Autoajustar altura del textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [editText]);

  const startEdit = (item: TranscriptionItem) => {
    setEditing(item.id);
    setEditText(item.formattedText);
    setExpanded(item.id);
  };

  const cancelEdit = () => { setEditing(null); setEditText(''); };

  const saveEdit = async (id: number) => {
    setSaving(true);
    try {
      const res = await fetch(`/api/transcriptions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formattedText: editText }),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, formattedText: editText } : i))
      );
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
    } catch {
      alert('No se pudo descargar el PDF.');
    } finally {
      setDownloading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3 mt-8">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-20">
        <svg className="w-10 h-10 mx-auto mb-3 text-gray-300" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
          <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
        </svg>
        <p className="text-gray-500 text-sm">Sin grabaciones todavía</p>
        <p className="text-gray-400 text-xs mt-1">Pulsa el botón para empezar</p>
      </div>
    );
  }

  return (
    <div className="mt-8">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-4">
        Historial &middot; {items.length} {items.length === 1 ? 'grabación' : 'grabaciones'}
      </p>
      <div className="space-y-3">
        {items.map((item) => {
          const isExpanded = expanded === item.id;
          const isEditing = editing === item.id;
          const isConfirmingDelete = confirmDelete === item.id;

          return (
            <div
              key={item.id}
              className="bg-white border border-gray-200 hover:border-gray-300 rounded-xl overflow-hidden transition-colors"
            >
              {/* Cabecera */}
              <div
                className="flex items-start gap-4 p-5 cursor-pointer"
                onClick={() => !isEditing && setExpanded(isExpanded ? null : item.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="text-xs text-gray-500">{fmtDate(item.createdAt)}</span>
                    {item.language && (
                      <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        {langLabel(item.language)} → {langLabel(item.outputLanguage)}
                      </span>
                    )}
                    <span className="text-xs text-gray-400 font-mono">
                      {fmtDuration(item.durationSeconds)}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    {truncate(item.formattedText)}
                  </p>
                </div>
                <svg
                  className={`shrink-0 w-4 h-4 text-gray-400 transition-transform mt-1 ${isExpanded ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Detalle expandido */}
              {isExpanded && (
                <div className="border-t border-gray-200 px-5 pb-5 pt-4">
                  {isEditing ? (
                    <div className="space-y-3">
                      <textarea
                        ref={textareaRef}
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        className="w-full bg-gray-50 border border-indigo-500/30 rounded-lg p-3 text-sm text-gray-800 leading-relaxed resize-none focus:outline-none focus:border-indigo-500/60 min-h-[120px]"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEdit(item.id)}
                          disabled={saving}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
                        >
                          {saving ? (
                            <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                          Guardar
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-all"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                      {renderFormattedText(item.formattedText)}
                    </div>
                  )}

                  {/* Acciones */}
                  {!isEditing && (
                    <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-gray-200">
                      {/* PDF */}
                      <button
                        onClick={() => downloadPdf(item.id, item.createdAt)}
                        disabled={downloading === item.id}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 hover:bg-indigo-500/15 hover:border-indigo-500/40 transition-all disabled:opacity-40"
                      >
                        {downloading === item.id ? (
                          <div className="w-3 h-3 border border-indigo-400/30 border-t-indigo-400 rounded-full animate-spin" />
                        ) : (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                        )}
                        PDF
                      </button>

                      {/* Editar */}
                      <button
                        onClick={() => startEdit(item)}
                        className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                        Editar
                      </button>

                      {/* Borrar */}
                      {isConfirmingDelete ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-red-400">¿Seguro?</span>
                          <button
                            onClick={() => deleteItem(item.id)}
                            disabled={deleting === item.id}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 transition-all disabled:opacity-50"
                          >
                            {deleting === item.id ? 'Borrando…' : 'Sí, borrar'}
                          </button>
                          <button
                            onClick={() => setConfirmDelete(null)}
                            className="text-xs text-gray-600 hover:text-gray-400 transition-all"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDelete(item.id)}
                          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-400/40 transition-all"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                          Borrar
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
