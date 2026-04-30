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

  // Duración total
  const totalDuration = chunks.reduce((acc, c) => acc + (c.durationSeconds ?? 0), 0);

  // Unir todo el texto crudo
  const rawText = chunks.map((c) => c.rawText).join(' ').trim();

  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
  let formattedText = rawText;

  try {
    // Formatear + diarizar en el idioma detectado (sin traducción)
    const result = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        {
          role: 'system',
          content:
'You are a professional transcription editor and speaker diarization expert. Follow these rules strictly:\n' +
            '1. Add correct punctuation (periods, commas, question marks, exclamation marks).\n' +
            '2. Create a new paragraph for each speaker turn or every 4-5 sentences.\n' +
            '3. SPEAKER DETECTION (critical): Conversations between two or more people are very common. Look for these patterns that indicate a speaker change: direct questions followed by answers, greetings/farewells, topic shifts, different vocabulary/register, or any natural dialogue exchange. When in doubt, assume there ARE multiple speakers and label them. Label each speaker turn as [Persona 1], [Persona 2], etc. at the start of their paragraph. Only omit labels if the entire text is clearly a single person monologue (e.g. a lecture, a voice memo to oneself).\n' +
            '4. Return ONLY the formatted text. No comments, no introductions, no explanations.',
        },
        { role: 'user', content: rawText },
      ],
      max_tokens: 8192,
      temperature: 0.1,
    });
    formattedText = result.choices[0]?.message?.content?.trim() || rawText;
  } catch {
    // fallback al texto crudo si falla LLaMA
  }

  // Guardar transcripción final
  const [saved] = await db
    .insert(transcriptions)
    .values({
      language: detectedLanguage,
      outputLanguage: detectedLanguage,
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
