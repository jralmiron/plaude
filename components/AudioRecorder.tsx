'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

type RecorderState = 'idle' | 'recording' | 'processing' | 'done' | 'error';

const CHUNK_MS = 60_000;

function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const t of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(t)) return t;
  }
  return 'audio/webm';
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function AudioRecorder({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<RecorderState>('idle');
  const [duration, setDuration] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [liveText, setLiveText] = useState('');
  const [chunkCount, setChunkCount] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const contextRef = useRef('');
  const sessionIdRef = useRef<number | null>(null);
  const chunkIndexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Wake Lock + silent audio para mantener grabación activa en móvil
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const wakeLockRef = useRef<any>(null);
  const silentCtxRef = useRef<AudioContext | null>(null);
  const [bgWarning, setBgWarning] = useState(false);

  const startChunkRef = useRef<() => void>(() => {});

  const acquireWakeLock = useCallback(async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await (navigator as any).wakeLock.request('screen');
      }
    } catch { /* no soportado o denegado */ }
  }, []);

  const releaseWakeLock = useCallback(() => {
    wakeLockRef.current?.release().catch(() => {});
    wakeLockRef.current = null;
  }, []);

  // Reproduce audio silencioso en loop para que Android no suspenda el pipeline de audio
  const startSilentAudio = useCallback(() => {
    try {
      const ctx = new AudioContext();
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(ctx.destination);
      src.start(0);
      silentCtxRef.current = ctx;
    } catch { /* ignorado */ }
  }, []);

  const stopSilentAudio = useCallback(() => {
    silentCtxRef.current?.close().catch(() => {});
    silentCtxRef.current = null;
  }, []);

  // Avisa cuando la página queda en background; reintenta wake lock al volver
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden' && isRecordingRef.current) {
        setBgWarning(true);
      } else {
        setBgWarning(false);
        if (isRecordingRef.current) acquireWakeLock();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [acquireWakeLock]);

  const finalizeSession = useCallback(async () => {
    const sessionId = sessionIdRef.current;
    if (!sessionId) {
      setErrorMsg('No hay sesión activa');
      setState('error');
      return;
    }
    try {
      const res = await fetch(`/api/sessions/${sessionId}/finalize`, { method: 'POST' });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Error al finalizar');
      }
      setState('done');
      setLiveText('');
      setChunkCount(0);
      chunkIndexRef.current = 0;
      sessionIdRef.current = null;
      onDoneRef.current();
      setTimeout(() => { setState('idle'); setDuration(0); }, 2500);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Error al finalizar');
      setState('error');
    }
  }, []);

  startChunkRef.current = () => {
    if (!streamRef.current || !isRecordingRef.current) return;

    const mimeType = getSupportedMimeType();
    const recorder = new MediaRecorder(streamRef.current, {
      mimeType,
      audioBitsPerSecond: 16_000,
    });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    recorder.onstop = async () => {
      const currentIndex = chunkIndexRef.current;
      chunkIndexRef.current += 1;

      const audioBlob = new Blob(chunks, { type: recorder.mimeType });
      const cleanMime = recorder.mimeType.split(';')[0];
      const ext = cleanMime.includes('mp4') ? 'mp4' : cleanMime.includes('ogg') ? 'ogg' : 'webm';

      const form = new FormData();
      form.append('audio', audioBlob, `chunk.${ext}`);
      form.append('mimeType', recorder.mimeType);
      if (contextRef.current) form.append('prompt', contextRef.current);

      try {
        // 1. Transcribir con Whisper
        const tRes = await fetch('/api/transcribe', { method: 'POST', body: form });
        if (tRes.ok) {
          const data: { rawText: string; language: string; duration: number } = await tRes.json();
          if (data.rawText && sessionIdRef.current) {
            // 2. Guardar chunk en BD
            await fetch(`/api/sessions/${sessionIdRef.current}/chunks`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chunkIndex: currentIndex,
                rawText: data.rawText,
                language: data.language,
                durationSeconds: data.duration,
              }),
            });

            // Actualizar contexto y preview
            const allChunks = contextRef.current
              ? contextRef.current + ' ' + data.rawText
              : data.rawText;
            contextRef.current = allChunks.split(' ').slice(-150).join(' ');
            setLiveText(allChunks);
            setChunkCount((n) => n + 1);
          }
        }
      } catch {
        // El chunk se pierde en memoria pero la sesion sigue en BD
      }

      if (isRecordingRef.current) {
        startChunkRef.current();
      } else {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        await finalizeSession();
      }
    };

    recorderRef.current = recorder;
    recorder.start(500);

    chunkTimerRef.current = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, CHUNK_MS);
  };

  const startRecording = useCallback(async () => {
    setErrorMsg('');
    setLiveText('');
    chunkIndexRef.current = 0;
    contextRef.current = '';

    try {
      // Crear sesión en BD
      const sRes = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!sRes.ok) throw new Error('No se pudo crear la sesión');
      const { id } = await sRes.json();
      sessionIdRef.current = id;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      isRecordingRef.current = true;
      setState('recording');
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      await acquireWakeLock();
      startSilentAudio();
      startChunkRef.current();
    } catch (err) {
      setErrorMsg((err as Error).message || 'No se pudo acceder al micrófono');
      setState('error');
    }
  }, [outputLang]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
    isRecordingRef.current = false;
    releaseWakeLock();
    stopSilentAudio();
    setState('processing');
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
  }, [releaseWakeLock, stopSilentAudio]);

  const isDisabled = state === 'processing' || state === 'done';

  return (
    <div className="flex flex-col items-center gap-6 py-2">

      {/* Aviso de background en móvil */}
      {bgWarning && (
        <div className="w-full bg-amber-50 border border-amber-200 rounded-xl px-4 py-2.5 flex items-start gap-2">
          <svg className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
          </svg>
          <p className="text-xs text-amber-700 leading-snug">
            La grabación puede pausarse mientras la pantalla está apagada o en otra app. Mantén la pantalla activa para mayor fiabilidad.
          </p>
        </div>
      )}

      {/* Botón principal */}
      <button
        onClick={state === 'recording' ? stopRecording : startRecording}
        disabled={isDisabled}
        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl ${
          state === 'recording'
            ? 'bg-red-500 scale-110 shadow-red-500/40 ring-4 ring-red-500/20'
            : isDisabled
            ? 'bg-gray-200 cursor-not-allowed opacity-60'
            : 'bg-orange-500 hover:bg-orange-400 hover:scale-105 active:scale-95 shadow-orange-500/30 ring-4 ring-orange-500/10 hover:ring-orange-500/20'
        }`}
        aria-label={state === 'recording' ? 'Detener grabación' : 'Iniciar grabación'}
      >
        {state === 'recording' ? (
          <div className="w-7 h-7 bg-white rounded-md" />
        ) : state === 'processing' ? (
          <div className="w-7 h-7 border-2 border-white/20 border-t-white rounded-full animate-spin" />
        ) : state === 'done' ? (
          <svg className="w-10 h-10 text-green-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-10 h-10 text-white" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
            <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
          </svg>
        )}
      </button>

      {/* Estado */}
      <div className="text-center min-h-[56px] flex flex-col items-center justify-center">
        {state === 'idle' && (
          <p className="text-gray-500 text-sm">Pulsa para grabar</p>
        )}
        {state === 'recording' && (
          <>
            <p className="text-red-400 text-xs font-medium flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse inline-block" />
              Grabando
              {chunkCount > 0 && (
                <span className="ml-1 text-gray-400">· {chunkCount} {chunkCount === 1 ? 'fragmento' : 'fragmentos'}</span>
              )}
            </p>
            <p className="text-gray-900 text-3xl font-mono font-bold tabular-nums">
              {formatTime(duration)}
            </p>
            <p className="text-gray-400 text-xs mt-1">Pulsa para detener</p>
          </>
        )}
        {state === 'processing' && (
          <p className="text-orange-500 text-sm animate-pulse">Procesando transcripción…</p>
        )}
        {state === 'done' && (
          <p className="text-green-400 text-sm font-medium">Transcripción completada</p>
        )}
        {state === 'error' && (
          <div className="text-center">
            <p className="text-red-400 text-sm max-w-xs">{errorMsg}</p>
            <button
              onClick={() => setState('idle')}
              className="text-xs text-gray-400 hover:text-gray-600 mt-2 underline underline-offset-2"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>

      {/* Preview en vivo (aparece a partir del primer chunk completado) */}
      {state === 'recording' && liveText && (
        <div className="w-full bg-gray-50 border border-gray-200 rounded-xl p-4 max-h-40 overflow-y-auto">
          <p className="text-xs text-gray-400 uppercase tracking-widest mb-2">Transcripción en vivo</p>
          <p className="text-sm text-gray-700 leading-relaxed">{liveText}</p>
        </div>
      )}
    </div>
  );
}
