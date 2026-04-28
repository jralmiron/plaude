import { getDb } from '@/lib/db';
import { transcriptions } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { renderToBuffer } from '@react-pdf/renderer';
import { PdfDocument } from '@/lib/pdf';
import React from 'react';

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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const buffer = await renderToBuffer(
    React.createElement(PdfDocument, { transcription }) as unknown as React.ReactElement<any, any>
  );

  const dateStr = new Date(transcription.createdAt).toISOString().split('T')[0];

  return new Response(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="transcripcion-${dateStr}.pdf"`,
    },
  });
}
