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
            'You are a transcription editor. The text may contain [PAUSA] markers that indicate a silence of more than 1 second — these are the primary signal for a speaker change.\n' +
            'Rules:\n' +
            '1. Add correct punctuation.\n' +
            '2. Every [PAUSA] marker is very likely a speaker change. Replace it with a new line and the next speaker label.\n' +
            '3. Label each speaker turn as [Persona 1], [Persona 2], etc. Alternate speakers at each [PAUSA] unless context clearly shows it is the same person continuing.\n' +
            '4. If there are no [PAUSA] markers and the text is clearly one person talking, omit labels.\n' +
            '5. Return ONLY the formatted text, no comments or explanations.',
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
