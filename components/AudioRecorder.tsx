'use client';

import { useState, useRef, useCallback } from 'react';

type RecorderState = 'idle' | 'recording' | 'processing' | 'done' | 'error';

function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
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

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    setErrorMsg('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();

      const recorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 16_000, // 16kbps es suficiente para voz
      });

      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        setState('processing');
        try {
          const recorderMime = recorder.mimeType;
          const ext = recorderMime.includes('mp4') ? 'mp4' : recorderMime.includes('ogg') ? 'ogg' : 'webm';
          const audioBlob = new Blob(chunksRef.current, { type: recorderMime });

          // Envío directo como FormData — sin pasar por almacenamiento en la nube
          const form = new FormData();
          form.append('audio', audioBlob, `recording.${ext}`);
          form.append('mimeType', recorderMime);

          const res = await fetch('/api/transcribe', {
            method: 'POST',
            body: form,
          });

          if (!res.ok) {
            const data = await res.json();
            throw new Error(data.error || 'Error al transcribir');
          }

          setState('done');
          onDone();
          setTimeout(() => {
            setState('idle');
            setDuration(0);
          }, 2500);
        } catch (err) {
          setErrorMsg((err as Error).message || 'Error al procesar el audio');
          setState('error');
        }
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setState('recording');
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
    } catch {
      setErrorMsg('No se pudo acceder al micrófono. Comprueba los permisos.');
      setState('error');
    }
  }, [onDone]);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    recorderRef.current?.stop();
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
  }, []);

  const isDisabled = state === 'processing' || state === 'done';

  return (
    <div className="flex flex-col items-center gap-6 py-2">
      <button
        onClick={state === 'recording' ? stopRecording : startRecording}
        disabled={isDisabled}
        className={`w-24 h-24 rounded-full flex items-center justify-center transition-all duration-200 shadow-xl ${
          state === 'recording'
            ? 'bg-red-500 scale-110 shadow-red-500/40 ring-4 ring-red-500/20'
            : isDisabled
            ? 'bg-gray-700 cursor-not-allowed opacity-60'
            : 'bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 shadow-indigo-500/30 ring-4 ring-indigo-500/10 hover:ring-indigo-500/20'
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

      <div className="text-center min-h-[56px] flex flex-col items-center justify-center">
        {state === 'idle' && (
          <p className="text-gray-500 text-sm">Pulsa para grabar</p>
        )}
        {state === 'recording' && (
          <>
            <p className="text-red-400 text-xs font-medium flex items-center gap-1.5 mb-1">
              <span className="w-1.5 h-1.5 bg-red-400 rounded-full animate-pulse inline-block" />
              Grabando
            </p>
            <p className="text-white text-3xl font-mono font-bold tabular-nums">
              {formatTime(duration)}
            </p>
            <p className="text-gray-600 text-xs mt-1">Pulsa para detener</p>
          </>
        )}
        {state === 'processing' && (
          <p className="text-indigo-400 text-sm animate-pulse">Transcribiendo con IA…</p>
        )}
        {state === 'done' && (
          <p className="text-green-400 text-sm font-medium">Transcripción completada</p>
        )}
        {state === 'error' && (
          <div className="text-center">
            <p className="text-red-400 text-sm max-w-xs">{errorMsg}</p>
            <button
              onClick={() => setState('idle')}
              className="text-xs text-gray-600 hover:text-gray-300 mt-2 underline underline-offset-2"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
