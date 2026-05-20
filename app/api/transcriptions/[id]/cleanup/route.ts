import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ensureAppBootstrap } from '@/lib/bootstrap';
import { isAdminUser, requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audioChunks, sessions, transcriptions } from '@/lib/schema';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureAppBootstrap();
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user;

  const { id } = await params;
  const transcriptionId = Number.parseInt(id, 10);
  if (!Number.isInteger(transcriptionId) || transcriptionId <= 0) {
    return NextResponse.json({ error: 'Invalid transcription id' }, { status: 400 });
  }

  const db = getDb();
  const filter = isAdminUser(user) ? eq(transcriptions.id, transcriptionId) : and(eq(transcriptions.id, transcriptionId), eq(transcriptions.userId, user.id));
  const [transcription] = await db.select({ id: transcriptions.id }).from(transcriptions).where(filter!).limit(1);
  if (!transcription) return NextResponse.json({ error: 'Transcription not found' }, { status: 404 });

  const [session] = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.transcriptionId, transcriptionId)).limit(1);
  if (!session) return NextResponse.json({ success: true, deletedChunks: 0 });

  const deleted = await db.delete(audioChunks).where(eq(audioChunks.sessionId, session.id)).returning({ id: audioChunks.id });
  return NextResponse.json({ success: true, deletedChunks: deleted.length });
}
