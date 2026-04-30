import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { audioChunks } from '@/lib/schema';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sessionId = parseInt(id, 10);
  if (isNaN(sessionId)) {
    return NextResponse.json({ error: 'ID de sesión inválido' }, { status: 400 });
  }

  const { chunkIndex, rawText, language, durationSeconds } = await request.json();

  if (typeof chunkIndex !== 'number' || !rawText) {
    return NextResponse.json({ error: 'chunkIndex y rawText son requeridos' }, { status: 400 });
  }

  const db = getDb();
  const [chunk] = await db
    .insert(audioChunks)
    .values({ sessionId, chunkIndex, rawText, language, durationSeconds })
    .returning();

  return NextResponse.json({ id: chunk.id });
}
