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

  // Construir prompt para LLaMA: formateo + diarización + traducción si es necesario
  const langNames: Record<string, string> = { es: 'Spanish', en: 'English' };
  const outputLangName = langNames[outputLanguage] ?? 'Spanish';
  const needsTranslation =
    detectedLanguage !== 'unknown' &&
    !detectedLanguage.startsWith(outputLanguage) &&
    detectedLanguage !== outputLangName.toLowerCase();

  const systemPrompt = [
    'You are a professional transcription editor. You will receive raw speech-to-text output and must return only the processed text.',
    '',
    'RULES:',
    '1. Add correct punctuation (periods, commas, question marks, exclamation marks).',
    '2. Create paragraphs every 4-5 sentences or when the topic changes.',
    '3. Identify speaker changes and label them as [Persona 1], [Persona 2], etc. Each time you detect a new speaker, start a new paragraph with the label. If the conversation seems to be a single speaker, do NOT add speaker labels.',
    needsTranslation
      ? `4. Translate the entire text to ${outputLangName}. Preserve meaning exactly.`
      : `4. Keep the text in ${outputLangName}. Do NOT translate.`,
    '5. Return ONLY the processed text. No introductions, explanations or conclusions.',
  ].join('\n');

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  let formattedText = rawText;

  try {
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: rawText },
      ],
      max_tokens: 8192,
      temperature: 0.1,
    });
    formattedText = completion.choices[0]?.message?.content?.trim() || rawText;
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

  return NextResponse.json({ transcriptionId: saved.id, success: true });
}
