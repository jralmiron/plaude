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

  // Divide texto en trozos de ~800 palabras para no superar el límite de TPM de Groq
  function splitWords(text: string, maxWords = 800): string[] {
    const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
    const result: string[] = [];
    let current = '';
    let count = 0;
    for (const sentence of sentences) {
      const words = sentence.split(/\s+/).length;
      if (count + words > maxWords && current) {
        result.push(current.trim());
        current = '';
        count = 0;
      }
      current += sentence;
      count += words;
    }
    if (current.trim()) result.push(current.trim());
    return result.length > 0 ? result : [text];
  }

  const systemPrompt =
    'You are a transcription editor. Format the following transcript:\n' +
    '1. Add correct punctuation.\n' +
    '2. Create paragraphs every 4-5 sentences or when the topic changes.\n' +
    '3. Return ONLY the formatted text, no comments or explanations.';

  try {
    const textChunks = splitWords(rawText);

    // Procesar en lotes de 3 en paralelo para respetar rate limits de Groq
    const formatted: string[] = new Array(textChunks.length);
    const BATCH = 3;
    for (let i = 0; i < textChunks.length; i += BATCH) {
      const batch = textChunks.slice(i, i + BATCH);
      const results = await Promise.all(
        batch.map((chunk) =>
          groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: chunk },
            ],
            max_tokens: 1024,
            temperature: 0.1,
          }).then((r) => r.choices[0]?.message?.content?.trim() ?? chunk)
           .catch(() => chunk)
        )
      );
      for (let j = 0; j < results.length; j++) {
        formatted[i + j] = results[j];
      }
    }

    formattedText = formatted.join('\n\n');
  } catch {
    // fallback al texto crudo si falla todo
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
