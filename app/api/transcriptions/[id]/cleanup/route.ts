import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { audioChunks, sessions, transcriptions } from '@/lib/schema';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const transcriptionId = parseInt(id, 10);

  if (isNaN(transcriptionId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const db = getDb();

  const [transcription] = await db
    .select({ id: transcriptions.id })
    .from(transcriptions)
    .where(eq(transcriptions.id, transcriptionId));

  if (!transcription) {
    return NextResponse.json({ error: 'Transcripción no encontrada' }, { status: 404 });
  }

  const [session] = await db
    .select({ id: sessions.id })
    .from(sessions)
    .where(eq(sessions.transcriptionId, transcriptionId));

  if (!session) {
    return NextResponse.json({ success: true, deletedChunks: 0 });
  }

  const deleted = await db
    .delete(audioChunks)
    .where(eq(audioChunks.sessionId, session.id))
    .returning({ id: audioChunks.id });

  return NextResponse.json({ success: true, deletedChunks: deleted.length });
}
