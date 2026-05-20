import { and, eq } from 'drizzle-orm';
import { requireApiUser } from '@/lib/api-auth';
import { getDb } from '@/lib/db';
import { getOrCreateStoredPdf } from '@/lib/pdf-store';
import { transcriptions } from '@/lib/schema';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireApiUser();
  if (auth.error || !auth.user) return auth.error!;

  const { id: idStr } = await params;
  const transcriptionId = Number.parseInt(idStr, 10);
  if (!Number.isInteger(transcriptionId) || transcriptionId <= 0) {
    return new Response('ID inválido', { status: 400 });
  }

  const db = getDb();
  const [transcription] = await db
    .select()
    .from(transcriptions)
    .where(
      auth.user.role === 'admin' || auth.user.canViewAllConversations
        ? eq(transcriptions.id, transcriptionId)
        : and(eq(transcriptions.id, transcriptionId), eq(transcriptions.userId, auth.user.id))
    )
    .limit(1);

  if (!transcription) {
    return new Response('Transcripción no encontrada', { status: 404 });
  }

  const storedPdf = await getOrCreateStoredPdf(transcription);
  const buffer = Buffer.from(storedPdf.contentBase64, 'base64');

  return new Response(buffer, {
    headers: {
      'Content-Type': storedPdf.mimeType,
      'Content-Disposition': `attachment; filename="${storedPdf.fileName}"`,
    },
  });
}
