import { and, asc, eq } from 'drizzle-orm';
import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { ensureAppBootstrap } from '@/lib/bootstrap';
import { isAdminUser, requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audioChunks, sessions, transcriptions } from '@/lib/schema';

export const maxDuration = 60;

function splitWords(text: string, maxWords = 800) {
  const sentences = text.match(/[^.!?]+[.!?]*/g) ?? [text];
  const result: string[] = [];
  let current = '';
  let count = 0;
  for (const sentence of sentences) {
    const words = sentence.trim().split(/\s+/).filter(Boolean).length;
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

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureAppBootstrap();
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user;

  const { id } = await params;
  const sessionId = Number.parseInt(id, 10);
  if (!Number.isInteger(sessionId) || sessionId <= 0) {
    return NextResponse.json({ error: 'Invalid session id' }, { status: 400 });
  }

  const db = getDb();
  const sessionFilter = isAdminUser(user) ? eq(sessions.id, sessionId) : and(eq(sessions.id, sessionId), eq(sessions.userId, user.id));
  const [session] = await db.select().from(sessions).where(sessionFilter!).limit(1);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  await db.update(sessions).set({ status: 'processing', updatedAt: new Date() }).where(eq(sessions.id, sessionId));
  const chunks = await db.select().from(audioChunks).where(eq(audioChunks.sessionId, sessionId)).orderBy(asc(audioChunks.chunkIndex));
  if (chunks.length === 0) {
    await db.update(sessions).set({ status: 'error', updatedAt: new Date() }).where(eq(sessions.id, sessionId));
    return NextResponse.json({ error: 'No chunks found for this session' }, { status: 400 });
  }

  const langCounts: Record<string, number> = {};
  for (const chunk of chunks) if (chunk.language) langCounts[chunk.language] = (langCounts[chunk.language] ?? 0) + 1;
  const detectedLanguage = Object.entries(langCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'unknown';
  const totalDuration = chunks.reduce((sum, chunk) => sum + (chunk.durationSeconds ?? 0), 0);
  const rawText = chunks.map((chunk) => chunk.rawText).join(' ').trim();

  let formattedText = rawText;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const formattedChunks: string[] = [];
    for (const chunk of splitWords(rawText)) {
      const result = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: 'Add punctuation and paragraphs. Return only the formatted text.' },
          { role: 'user', content: chunk },
        ],
        max_tokens: 1024,
        temperature: 0.1,
      });
      formattedChunks.push(result.choices[0]?.message?.content?.trim() ?? chunk);
    }
    formattedText = formattedChunks.join('\n\n');
  } catch {
    formattedText = rawText;
  }

  const [saved] = await db
    .insert(transcriptions)
    .values({
      userId: session.userId ?? user.id,
      sessionId,
      language: detectedLanguage,
      outputLanguage: session.outputLanguage,
      durationSeconds: totalDuration,
      rawText,
      formattedText,
      updatedAt: new Date(),
    })
    .returning({ id: transcriptions.id });

  await db.update(sessions).set({ status: 'done', transcriptionId: saved.id, updatedAt: new Date() }).where(eq(sessions.id, sessionId));
  return NextResponse.json({ transcriptionId: saved.id, success: true });
}
