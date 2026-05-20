import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ensureAppBootstrap } from '@/lib/bootstrap';
import { isAdminUser, requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { invalidateStoredPdf } from '@/lib/pdf-store';
import { audioChunks, pdfDocuments, sessions, transcriptions } from '@/lib/schema';

export async function GET(
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
  const [item] = await db.select().from(transcriptions).where(filter!).limit(1);
  if (!item) return NextResponse.json({ error: 'Transcription not found' }, { status: 404 });
  return NextResponse.json(item);
}

export async function PATCH(
  request: Request,
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

  const body = await request.json().catch(() => ({}));
  const formattedText = typeof body.formattedText === 'string' ? body.formattedText.trim() : '';
  if (!formattedText) return NextResponse.json({ error: 'formattedText is required' }, { status: 400 });

  const db = getDb();
  const filter = isAdminUser(user) ? eq(transcriptions.id, transcriptionId) : and(eq(transcriptions.id, transcriptionId), eq(transcriptions.userId, user.id));
  const [updated] = await db.update(transcriptions).set({ formattedText, updatedAt: new Date() }).where(filter!).returning({ id: transcriptions.id });
  if (!updated) return NextResponse.json({ error: 'Transcription not found' }, { status: 404 });

  await invalidateStoredPdf(transcriptionId);
  return NextResponse.json({ success: true });
}

export async function DELETE(
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
  const [existing] = await db.select({ id: transcriptions.id }).from(transcriptions).where(filter!).limit(1);
  if (!existing) return NextResponse.json({ error: 'Transcription not found' }, { status: 404 });

  const linkedSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.transcriptionId, transcriptionId));
  for (const session of linkedSessions) {
    await db.delete(audioChunks).where(eq(audioChunks.sessionId, session.id));
  }
  await db.delete(sessions).where(eq(sessions.transcriptionId, transcriptionId));
  await db.delete(pdfDocuments).where(eq(pdfDocuments.transcriptionId, transcriptionId));
  await db.delete(transcriptions).where(eq(transcriptions.id, transcriptionId));
  return NextResponse.json({ success: true });
}
