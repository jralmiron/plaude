import { getDb } from '@/lib/db';
import { transcriptions } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { buildPdf } from '@/lib/pdf';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return new Response('ID inválido', { status: 400 });
  }

  const db = getDb();
  const [transcription] = await db
    .select()
    .from(transcriptions)
    .where(eq(transcriptions.id, id));

  if (!transcription) {
    return new Response('Transcripción no encontrada', { status: 404 });
  }

  const buffer = await buildPdf(transcription);
  const dateStr = new Date(transcription.createdAt).toISOString().split('T')[0];

  return new Response(buffer, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="transcripcion-${dateStr}.pdf"`,
    },
  });
}
