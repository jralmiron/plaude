import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ensureAppBootstrap } from '@/lib/bootstrap';
import { isAdminUser, requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audioChunks, sessions } from '@/lib/schema';

export async function POST(
  request: Request,
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

  const body = await request.json().catch(() => ({}));
  const chunkIndex = Number.isInteger(body.chunkIndex) ? body.chunkIndex : Number.NaN;
  const rawText = typeof body.rawText === 'string' ? body.rawText.trim() : '';
  const language = typeof body.language === 'string' ? body.language.slice(0, 50) : null;
  const durationSeconds = Number.isFinite(body.durationSeconds) ? Math.max(0, Math.round(body.durationSeconds)) : null;

  if (!Number.isInteger(chunkIndex) || chunkIndex < 0 || !rawText) {
    return NextResponse.json({ error: 'chunkIndex and rawText are required' }, { status: 400 });
  }

  const db = getDb();
  const sessionFilter = isAdminUser(user) ? eq(sessions.id, sessionId) : and(eq(sessions.id, sessionId), eq(sessions.userId, user.id));
  const [session] = await db.select({ id: sessions.id }).from(sessions).where(sessionFilter!).limit(1);
  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  const [chunk] = await db
    .insert(audioChunks)
    .values({ sessionId, chunkIndex, rawText, language, durationSeconds })
    .onConflictDoUpdate({ target: [audioChunks.sessionId, audioChunks.chunkIndex], set: { rawText, language, durationSeconds } })
    .returning({ id: audioChunks.id });

  return NextResponse.json({ id: chunk.id });
}
