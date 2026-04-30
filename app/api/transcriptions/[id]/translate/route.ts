import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import Groq from 'groq-sdk';
import { getDb } from '@/lib/db';
import { transcriptions } from '@/lib/schema';

export const runtime = 'nodejs';
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

  // Dividir en trozos de ~800 palabras para no superar el límite de TPM de Groq (6000 tokens)
  function splitIntoChunks(text: string, maxWords = 800): string[] {
    const paragraphs = text.split(/\n+/);
    const chunks: string[] = [];
    let current: string[] = [];
    let wordCount = 0;

    for (const para of paragraphs) {
      const words = para.split(/\s+/).length;
      if (wordCount + words > maxWords && current.length > 0) {
        chunks.push(current.join('\n'));
        current = [];
        wordCount = 0;
      }
      current.push(para);
      wordCount += words;
    }
    if (current.length > 0) chunks.push(current.join('\n'));
    return chunks;
  }

  const systemPrompt =
    `Translate the following text to ${LANG_NAMES[targetLang]}. ` +
    'Preserve ALL paragraph breaks and speaker labels like [Persona 1]. ' +
    'Return ONLY the translated text, nothing else.';

  try {
    const chunks = splitIntoChunks(item.formattedText);
    const translatedChunks: string[] = [];

    for (const chunk of chunks) {
      const result = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: chunk },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      });
      translatedChunks.push(result.choices[0]?.message?.content?.trim() || chunk);
    }

    const translatedText = translatedChunks.join('\n\n');

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
