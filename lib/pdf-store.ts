import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { getDb } from './db';
import { buildPdf } from './pdf';
import { pdfDocuments, type Transcription } from './schema';

function sourceHash(transcription: Pick<Transcription, 'formattedText' | 'rawText' | 'outputLanguage' | 'updatedAt'>) {
  return createHash('sha256')
    .update([
      transcription.formattedText,
      transcription.rawText,
      transcription.outputLanguage ?? '',
      transcription.updatedAt?.toISOString?.() ?? '',
    ].join('||'))
    .digest('hex');
}

function buildFileName(createdAt: Date) {
  return `transcripcion-${createdAt.toISOString().split('T')[0]}.pdf`;
}

export async function invalidateStoredPdf(transcriptionId: number) {
  const db = getDb();
  await db.delete(pdfDocuments).where(eq(pdfDocuments.transcriptionId, transcriptionId));
}

export async function getOrCreateStoredPdf(transcription: Transcription) {
  const db = getDb();
  const fingerprint = sourceHash(transcription);
  const [existing] = await db
    .select()
    .from(pdfDocuments)
    .where(eq(pdfDocuments.transcriptionId, transcription.id))
    .limit(1);

  if (existing && existing.sourceHash === fingerprint) {
    return existing;
  }

  const buffer = Buffer.from(await buildPdf(transcription));
  const record = {
    userId: transcription.userId,
    transcriptionId: transcription.id,
    fileName: buildFileName(transcription.createdAt),
    mimeType: 'application/pdf',
    sizeBytes: buffer.byteLength,
    contentBase64: buffer.toString('base64'),
    sourceHash: fingerprint,
    updatedAt: new Date(),
  };

  if (existing) {
    const [updated] = await db
      .update(pdfDocuments)
      .set(record)
      .where(eq(pdfDocuments.id, existing.id))
      .returning();
    return updated;
  }

  const [inserted] = await db.insert(pdfDocuments).values(record).returning();
  return inserted;
}
