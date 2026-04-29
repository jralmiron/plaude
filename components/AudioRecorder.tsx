'use client';

import { useState, useRef, useCallback } from 'react';

type RecorderState = 'idle' | 'recording' | 'processing' | 'done' | 'error';

/** Corta la grabacion en chunks de 1 minuto para transcripcion en paralelo */
const CHUNK_MS = 60_000;

function getSupportedMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) return type;
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

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const isRecordingRef = useRef(false);
  const contextRef = useRef('');        // ultimas 150 palabras -> prompt Whisper siguiente chunk
  const rawChunksRef = useRef<string[]>([]);
  const totalDurationRef = useRef(0);
  const languageRef = useRef('unknown');
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chunkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  // Ref para evitar dependencia circular entre startChunk y finalizeTranscription
  const startChunkRef = useRef<() => void>(() => {});

  const finalizeTranscription = useCallback(async () => {
    const fullText = rawChunksRef.current.join(' ').trim();
    if (!fullText) {
      setErrorMsg('No se detectó audio en la grabación');
      setState('error');
      return;
    }
    try {
      const res = await fetch('/api/transcriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rawText: fullText,
          language: languageRef.current,
          durationSeconds: totalDurationRef.current,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || 'Error al guardar');
      }
      setState('done');
      setLiveText('');
      rawChunksRef.current = [];
      onDoneRef.current();
      setTimeout(() => { setState('idle'); setDuration(0); }, 2500);
    } catch (err) {
      setErrorMsg((err as Error).message || 'Error al guardar');
      setState('error');
    }
  }, []);

  // Definido como ref para llamarse recursivamente sin dependencias circulares
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
      const audioBlob = new Blob(chunks, { type: recorder.mimeType });
      const cleanMime = recorder.mimeType.split(';')[0];
      const ext = cleanMime.includes('mp4') ? 'mp4' : cleanMime.includes('ogg') ? 'ogg' : 'webm';

      const form = new FormData();
      form.append('audio', audioBlob, `chunk.${ext}`);
      form.append('mimeType', recorder.mimeType);
      if (contextRef.current) form.append('prompt', contextRef.current);

      try {
        const res = await fetch('/api/transcribe', { method: 'POST', body: form });
        if (res.ok) {
          const data: { rawText: string; language: string; duration: number } = await res.json();
          if (data.rawText) {
            rawChunksRef.current.push(data.rawText);
            totalDurationRef.current += data.duration ?? 0;
            if (languageRef.current === 'unknown') languageRef.current = data.language ?? 'unknown';
            const allText = rawChunksRef.current.join(' ');
            // Mantener contexto: ultimas 150 palabras para el proximo chunk
            contextRef.current = allText.split(' ').slice(-150).join(' ');
            setLiveText(allText);
          }
        }
      } catch {
        // silencioso: el chunk se pierde pero la grabacion continua
      }

      if (isRecordingRef.current) {
        startChunkRef.current(); // siguiente chunk inmediatamente
      } else {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        await finalizeTranscription();
      }
    };

    recorderRef.current = recorder;
    recorder.start(500);

    // Cortar automaticamente cada CHUNK_MS
    chunkTimerRef.current = setTimeout(() => {
      if (recorder.state === 'recording') recorder.stop();
    }, CHUNK_MS);
  };

  const startRecording = useCallback(async () => {
    setErrorMsg('');
    setLiveText('');
    rawChunksRef.current = [];
    totalDurationRef.current = 0;
    languageRef.current = 'unknown';
    contextRef.current = '';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      isRecordingRef.current = true;
      setState('recording');
      setDuration(0);
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000);
      startChunkRef.current();
    } catch {
      setErrorMsg('No se pudo acceder al micrófono. Comprueba los permisos.');
      setState('error');
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (chunkTimerRef.current) clearTimeout(chunkTimerRef.current);
    isRecordingRef.current = false;
    setState('processing');
    // Parar el recorder activo -> onstop -> finalizeTranscription
    if (recorderRef.current?.state === 'recording') {
      recorderRef.current.stop();
    }
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
          <p className="text-indigo-400 text-sm animate-pulse">Formateando transcripción…</p>
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

      {/* Preview en vivo mientras graba (aparece a partir del primer minuto) */}
      {state === 'recording' && liveText && (
        <div className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl p-4 max-h-36 overflow-y-auto">
          <p className="text-xs text-gray-600 uppercase tracking-widest mb-2">Transcripción en vivo</p>
          <p className="text-sm text-gray-300 leading-relaxed">{liveText}</p>
        </div>
      )}
    </div>
  );
}
