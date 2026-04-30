import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { transcriptions } from '@/lib/schema';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const transcriptionId = parseInt(id, 10);
  if (isNaN(transcriptionId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const { formattedText } = await request.json();
  if (typeof formattedText !== 'string') {
    return NextResponse.json({ error: 'formattedText requerido' }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(transcriptions)
    .set({ formattedText })
    .where(eq(transcriptions.id, transcriptionId))
    .returning({ id: transcriptions.id });

  if (!updated) {
    return NextResponse.json({ error: 'Transcripción no encontrada' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const transcriptionId = parseInt(id, 10);
  if (isNaN(transcriptionId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 });
  }

  const db = getDb();
  await db.delete(transcriptions).where(eq(transcriptions.id, transcriptionId));

  return NextResponse.json({ success: true });
}
