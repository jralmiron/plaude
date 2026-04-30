import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const maxDuration = 60;

export async function POST(request: Request) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const contentType = request.headers.get('content-type') ?? '';
  if (!contentType.includes('multipart/form-data')) {
    return NextResponse.json({ error: 'Content-Type must be multipart/form-data' }, { status: 415 });
  }

  const form = await request.formData();
  const audioEntry = form.get('audio');
  const mimeType = (form.get('mimeType') as string) || 'audio/webm';
  const prompt = (form.get('prompt') as string) || undefined;

  if (!audioEntry || typeof audioEntry === 'string') {
    return NextResponse.json({ error: 'Campo audio requerido' }, { status: 400 });
  }

  try {
    const cleanMime = mimeType.split(';')[0];
    const ext = cleanMime.includes('mp4') ? 'mp4' : cleanMime.includes('ogg') ? 'ogg' : 'webm';
    const namedFile = new File([audioEntry as File], `recording.${ext}`, { type: cleanMime });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const transcription = await groq.audio.transcriptions.create({
      file: namedFile,
      model: 'whisper-large-v3-turbo',
      response_format: 'verbose_json',
      ...(prompt ? { prompt } : {}),
    } as Parameters<typeof groq.audio.transcriptions.create>[0]);

    const rawText = transcription.text?.trim() || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const language: string = (transcription as any).language || 'unknown';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const duration: number = Math.round((transcription as any).duration || 0);

    // Construir texto anotado con marcadores de pausa (>1s entre segmentos)
    // Estos marcadores ayudan a LLaMA a detectar cambios de hablante
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const segments: Array<{ start: number; end: number; text: string }> = (transcription as any).segments || [];
    let annotatedText = rawText;
    if (segments.length > 1) {
      let built = '';
      for (let i = 0; i < segments.length; i++) {
        if (i > 0) {
          const pause = segments[i].start - segments[i - 1].end;
          if (pause > 1.0) built += ' [PAUSA] ';
        }
        built += segments[i].text;
      }
      annotatedText = built.trim();
    }

    return NextResponse.json({ rawText: annotatedText, language, duration });
  } catch (error) {
    console.error('Transcribe error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Error interno' },
      { status: 500 }
    );
  }
}
