import { desc, eq, sql } from 'drizzle-orm';
import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { ensureAppBootstrap } from '@/lib/bootstrap';
import { isAdminUser, requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audioChunks, pdfDocuments, sessions, transcriptions, users } from '@/lib/schema';

export const maxDuration = 60;

export async function GET() {
  await ensureAppBootstrap();
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user;

  const db = getDb();
  const rows = await db
    .select({
      id: transcriptions.id,
      language: transcriptions.language,
      outputLanguage: transcriptions.outputLanguage,
      durationSeconds: transcriptions.durationSeconds,
      rawText: transcriptions.rawText,
      formattedText: transcriptions.formattedText,
      createdAt: transcriptions.createdAt,
      ownerUsername: users.username,
      ownerDisplayName: users.displayName,
      hasStoredPdf: sql<boolean>`case when ${pdfDocuments.id} is null then false else true end`,
      pdfStoredAt: pdfDocuments.updatedAt,
      chunkCount: sql<number>`(
        select count(*)::int
        from ${audioChunks}
        inner join ${sessions} on ${sessions.id} = ${audioChunks.sessionId}
        where ${sessions.transcriptionId} = ${transcriptions.id}
      )`,
    })
    .from(transcriptions)
    .leftJoin(users, eq(users.id, transcriptions.userId))
    .leftJoin(pdfDocuments, eq(pdfDocuments.transcriptionId, transcriptions.id))
    .where(isAdminUser(user) ? sql`true` : eq(transcriptions.userId, user.id))
    .orderBy(desc(transcriptions.createdAt));

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  await ensureAppBootstrap();
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user;

  const body = await request.json().catch(() => ({}));
  const rawText = typeof body.rawText === 'string' ? body.rawText.trim() : '';
  const language = typeof body.language === 'string' ? body.language.slice(0, 50) : null;
  const outputLanguage = typeof body.outputLanguage === 'string' ? body.outputLanguage.slice(0, 10) : 'es';
  const durationSeconds = Number.isFinite(body.durationSeconds) ? Math.max(0, Math.round(body.durationSeconds)) : null;

  if (!rawText) {
    return NextResponse.json({ error: 'rawText is required' }, { status: 400 });
  }

  let formattedText = rawText;
  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [
        { role: 'system', content: 'Add punctuation and paragraphs. Return only the formatted text.' },
        { role: 'user', content: rawText },
      ],
      max_tokens: 4096,
      temperature: 0.1,
    });
    formattedText = completion.choices[0]?.message?.content?.trim() || rawText;
  } catch {
    formattedText = rawText;
  }

  const db = getDb();
  const [saved] = await db.insert(transcriptions).values({ userId: user.id, language, outputLanguage, durationSeconds, rawText, formattedText, updatedAt: new Date() }).returning({ id: transcriptions.id });
  return NextResponse.json({ id: saved.id, success: true });
}
