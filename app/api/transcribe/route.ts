import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { getDb } from '@/lib/db';
import { transcriptions } from '@/lib/schema';

export const maxDuration = 60;

export async function POST(request: Request) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  let audioFile: File;
  let mimeType: string;

  const contentType = request.headers.get('content-type') ?? '';

  if (contentType.includes('multipart/form-data')) {
    // New path: audio sent directly as FormData (no Blob storage)
    const form = await request.formData();
    const audioEntry = form.get('audio');
    mimeType = (form.get('mimeType') as string) || 'audio/webm';
    if (!audioEntry || typeof audioEntry === 'string') {
      return NextResponse.json({ error: 'Campo audio requerido' }, { status: 400 });
    }
    audioFile = audioEntry as File;
  } else {
    return NextResponse.json({ error: 'Content-Type debe ser multipart/form-data' }, { status: 415 });
  }

  try {
    const cleanMime = mimeType.split(';')[0];
    const ext = cleanMime.includes('mp4') ? 'mp4' : cleanMime.includes('ogg') ? 'ogg' : 'webm';
    const namedFile = new File([audioFile], `recording.${ext}`, { type: cleanMime });

    // 1. Transcribe with Groq Whisper Large v3 Turbo (8x faster than v3, same quality)
    const transcription = await groq.audio.transcriptions.create({
      file: namedFile,
      model: 'whisper-large-v3-turbo',
      response_format: 'verbose_json',
    });

    const rawText = transcription.text?.trim() || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const language: string = (transcription as any).language || 'unknown';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const duration: number = Math.round((transcription as any).duration || 0);

    if (!rawText) {
      return NextResponse.json({ error: 'No se detectó audio en la grabación' }, { status: 422 });
    }

    // 2. Format with Llama 3.3 70B (fallback to raw text on failure)
    let formattedText = rawText;
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant', // sufficient for punctuation/paragraphs, 10x faster than 70b
        messages: [
          {
            role: 'system',
            content:
              'Eres un editor profesional de transcripciones de audio. Recibes texto en bruto generado por speech-to-text y debes formatearlo correctamente. Reglas estrictas: (1) No añadas, elimines ni cambies ninguna palabra o significado. (2) Añade puntuación correcta: puntos, comas, signos de interrogación y exclamación donde corresponda. (3) Crea párrafos cada 4-5 oraciones o cuando cambie el tema. (4) Respeta el idioma original, ya sea español o inglés. (5) Devuelve ÚNICAMENTE el texto formateado, sin ningún comentario, introducción ni conclusión.',
          },
          { role: 'user', content: rawText },
        ],
        max_tokens: 4096,
        temperature: 0.1,
      });
      formattedText = completion.choices[0]?.message?.content?.trim() || rawText;
    } catch {
      // fallback to raw text
    }

    // 3. Save to Neon DB
    const db = getDb();
    const [saved] = await db
      .insert(transcriptions)
      .values({ language, durationSeconds: duration, rawText, formattedText })
      .returning();

    return NextResponse.json({ id: saved.id, success: true });
  } catch (error) {
    console.error('Transcribe error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Error interno' },
      { status: 500 }
    );
  }
}
