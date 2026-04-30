import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';

export const runtime = 'nodejs';
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

    return NextResponse.json({ rawText, language, duration });
  } catch (error) {
    const err = error as Error & { status?: number; statusCode?: number };
    console.error('Transcribe error:', err?.message, err?.status ?? err?.statusCode);
    const status = err?.status ?? err?.statusCode ?? 500;
    // Devolver 429 al cliente si Groq devuelve rate limit, para que el frontend pueda reintentarlo
    const clientStatus = status === 429 ? 429 : 500;
    return NextResponse.json(
      { error: err?.message || 'Error interno', groqStatus: status },
      { status: clientStatus }
    );
  }
}
