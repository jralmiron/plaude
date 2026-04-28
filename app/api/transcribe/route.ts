import { NextResponse } from 'next/server';
import Groq from 'groq-sdk';
import { del } from '@vercel/blob';
import { getDb } from '@/lib/db';
import { transcriptions } from '@/lib/schema';

export const maxDuration = 60;

export async function POST(request: Request) {
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  const { blobUrl, mimeType } = await request.json();

  if (!blobUrl) {
    return NextResponse.json({ error: 'blobUrl requerido' }, { status: 400 });
  }

  try {
    // 1. Fetch audio from Vercel Blob
    const audioResponse = await fetch(blobUrl);
    const audioBuffer = await audioResponse.arrayBuffer();
    const cleanMime = (mimeType as string)?.split(';')[0] || 'audio/webm';
    const ext = cleanMime.includes('mp4') ? 'mp4' : cleanMime.includes('ogg') ? 'ogg' : 'webm';
    const audioFile = new File([audioBuffer], `recording.${ext}`, { type: cleanMime });

    // 2. Transcribe with Groq Whisper Large v3
    const transcription = await groq.audio.transcriptions.create({
      file: audioFile,
      model: 'whisper-large-v3',
      response_format: 'verbose_json',
    });

    const rawText = transcription.text?.trim() || '';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const language: string = (transcription as any).language || 'unknown';
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const duration: number = Math.round((transcription as any).duration || 0);

    if (!rawText) {
      await del(blobUrl).catch(() => {});
      return NextResponse.json({ error: 'No se detectó audio en la grabación' }, { status: 422 });
    }

    // 3. Format with Llama 3.3 70B (fallback to raw text on failure)
    let formattedText = rawText;
    try {
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
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

    // 4. Save to Neon DB
    const db = getDb();
    const [saved] = await db
      .insert(transcriptions)
      .values({ language, durationSeconds: duration, rawText, formattedText })
      .returning();

    // 5. Delete audio from Blob (cleanup)
    await del(blobUrl).catch(() => {});

    return NextResponse.json({ id: saved.id, success: true });
  } catch (error) {
    await del(blobUrl).catch(() => {});
    console.error('Transcribe error:', error);
    return NextResponse.json(
      { error: (error as Error).message || 'Error interno' },
      { status: 500 }
    );
  }
}
