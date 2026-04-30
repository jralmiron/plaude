import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import Groq from 'groq-sdk';
import { getDb } from '@/lib/db';
import { transcriptions } from '@/lib/schema';

export const maxDuration = 60;

const LANG_NAMES: Record<string, string> = {
  es: 'Spanish',
  en: 'English',
  fr: 'French',
  de: 'German',
  pt: 'Portuguese',
  it: 'Italian',
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const transcriptionId = parseInt(id, 10);
  if (isNaN(transcriptionId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const { targetLang } = await request.json().catch(() => ({}));
  if (!targetLang || !LANG_NAMES[targetLang]) {
    return NextResponse.json({ error: 'targetLang requerido (es, en, fr, de, pt, it)' }, { status: 400 });
  }

  const db = getDb();
  const [item] = await db
    .select()
    .from(transcriptions)
    .where(eq(transcriptions.id, transcriptionId));

  if (!item) {
    return NextResponse.json({ error: 'Transcripción no encontrada' }, { status: 404 });
  }

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  try {
    const result = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content:
            `Translate the following text to ${LANG_NAMES[targetLang]}. ` +
            'Preserve ALL paragraph breaks and speaker labels like [Persona 1]. ' +
            'Return ONLY the translated text, nothing else.',
        },
        { role: 'user', content: item.formattedText },
      ],
      max_tokens: 8192,
      temperature: 0.1,
    });

    const translatedText = result.choices[0]?.message?.content?.trim() || item.formattedText;

    const [updated] = await db
      .update(transcriptions)
      .set({ formattedText: translatedText, outputLanguage: targetLang })
      .where(eq(transcriptions.id, transcriptionId))
      .returning();

    return NextResponse.json({ formattedText: updated.formattedText, outputLanguage: updated.outputLanguage });
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message || 'Error al traducir' },
      { status: 500 }
    );
  }
}
