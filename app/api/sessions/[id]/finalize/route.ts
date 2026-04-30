import { NextResponse } from 'next/server';
import { eq, asc } from 'drizzle-orm';
import Groq from 'groq-sdk';
import { getDb } from '@/lib/db';
import { sessions, audioChunks, transcriptions } from '@/lib/schema';

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = parseInt(id, 10);
  if (isNaN(sessionId)) {
    return NextResponse.json({ error: 'ID de sesión inválido' }, { status: 400 });
  }

  const db = getDb();

  // Marcar sesión como procesando
  await db.update(sessions).set({ status: 'processing' }).where(eq(sessions.id, sessionId));

  // Obtener todos los chunks ordenados
  const chunks = await db
    .select()
    .from(audioChunks)
    .where(eq(audioChunks.sessionId, sessionId))
    .orderBy(asc(audioChunks.chunkIndex));

  if (chunks.length === 0) {
    await db.update(sessions).set({ status: 'error' }).where(eq(sessions.id, sessionId));
    return NextResponse.json({ error: 'No hay chunks para esta sesión' }, { status: 400 });
  }

  // Obtener idioma de entrada (el más frecuente entre los chunks)
  const langCounts: Record<string, number> = {};
  for (const c of chunks) {
    if (c.language) langCounts[c.language] = (langCounts[c.language] ?? 0) + 1;
  }
  const detectedLanguage =
    Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';

  // Obtener outputLanguage de la sesión
  const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId));
  const outputLanguage = session?.outputLanguage ?? 'es';

  // Duración total
  const totalDuration = chunks.reduce((acc, c) => acc + (c.durationSeconds ?? 0), 0);

  // Unir todo el texto crudo
  const rawText = chunks.map((c) => c.rawText).join(' ').trim();

  // Normalizar idioma detectado a código corto para comparar
  const langNames: Record<string, string> = { es: 'Spanish', en: 'English' };
  const outputLangName = langNames[outputLanguage] ?? 'Spanish';
  const langCodeMap: Record<string, string> = {
    spanish: 'es', english: 'en', español: 'es', inglés: 'en',
  };
  const detectedCode =
    langCodeMap[detectedLanguage.toLowerCase()] ??
    detectedLanguage.slice(0, 2).toLowerCase();
  const needsTranslation = detectedLanguage !== 'unknown' && detectedCode !== outputLanguage;

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  let formattedText = rawText;

  try {
    // Paso 1: formatear + diarizar en el idioma original
    const step1 = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content:
            'You are a professional transcription editor. Rules:\n' +
            '1. Add correct punctuation (periods, commas, question/exclamation marks).\n' +
            '2. Create paragraphs every 4-5 sentences or when the topic changes.\n' +
            '3. If multiple speakers are detected, label them [Persona 1], [Persona 2], etc. at each change. Single speaker = no labels.\n' +
            '4. Return ONLY the processed text. No introductions or comments.',
        },
        { role: 'user', content: rawText },
      ],
      max_tokens: 8192,
      temperature: 0.1,
    });
    formattedText = step1.choices[0]?.message?.content?.trim() || rawText;

    // Paso 2: traducir en llamada separada (más fiable que pedir todo junto)
    if (needsTranslation) {
      const step2 = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          {
            role: 'system',
            content:
              `Translate the following text to ${outputLangName}. ` +
              'Preserve ALL paragraph breaks and speaker labels like [Persona 1]. ' +
              'Return ONLY the translated text, nothing else.',
          },
          { role: 'user', content: formattedText },
        ],
        max_tokens: 8192,
        temperature: 0.1,
      });
      formattedText = step2.choices[0]?.message?.content?.trim() || formattedText;
    }
  } catch {
    // fallback al texto crudo si falla LLaMA
  }

  // Guardar transcripción final
  const [saved] = await db
    .insert(transcriptions)
    .values({
      language: detectedLanguage,
      outputLanguage,
      durationSeconds: totalDuration,
      rawText,
      formattedText,
    })
    .returning();

  // Actualizar sesión como finalizada
  await db
    .update(sessions)
    .set({ status: 'done', transcriptionId: saved.id })
    .where(eq(sessions.id, sessionId));

  // Limpiar chunks — ya están fusionados en la transcripción final
  await db.delete(audioChunks).where(eq(audioChunks.sessionId, sessionId));

  return NextResponse.json({ transcriptionId: saved.id, success: true });
}
