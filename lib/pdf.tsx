import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { Transcription } from './schema';

const ORANGE = rgb(0.98, 0.45, 0.09);
const GRAY_DARK = rgb(0.07, 0.07, 0.07);
const GRAY_MID = rgb(0.61, 0.62, 0.63);
const GRAY_LIGHT = rgb(0.89, 0.91, 0.92);
const BODY_COLOR = rgb(0.22, 0.25, 0.32);

const LANGUAGE_MAP: Record<string, string> = {
  spanish: 'Español', english: 'English', es: 'Español', en: 'English',
};

function formatLanguage(lang: string | null): string {
  if (!lang) return '--';
  return LANGUAGE_MAP[lang.toLowerCase()] ?? lang;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '--';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')} min`;
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function wrapText(text: string, font: Awaited<ReturnType<PDFDocument['embedFont']>>, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(' ');
    let line = '';
    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        line = candidate;
      } else {
        if (line) lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    lines.push('');
  }
  return lines;
}

export async function buildPdf(transcription: Transcription): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);

  const pageWidth = 595;
  const pageHeight = 842;
  const marginX = 48;
  const contentWidth = pageWidth - marginX * 2;

  const addPage = () => {
    const p = doc.addPage([pageWidth, pageHeight]);
    return { page: p, y: pageHeight - 48 };
  };

  let { page, y } = addPage();

  page.drawText('Hermes', { x: marginX, y, font: helveticaBold, size: 28, color: ORANGE });
  y -= 16;
  page.drawText('Transcripción de audio', { x: marginX, y, font: helvetica, size: 10, color: GRAY_MID });
  y -= 18;
  page.drawLine({ start: { x: marginX, y }, end: { x: pageWidth - marginX, y }, thickness: 0.5, color: GRAY_LIGHT });
  y -= 20;

  const metaItems = [
    { label: 'FECHA', value: formatDate(transcription.createdAt) },
    { label: 'IDIOMA', value: formatLanguage(transcription.language) },
    { label: 'DURACION', value: formatDuration(transcription.durationSeconds) },
  ];
  let metaX = marginX;
  for (const item of metaItems) {
    page.drawText(item.label, { x: metaX, y, font: helveticaBold, size: 8, color: GRAY_MID });
    page.drawText(item.value, { x: metaX, y: y - 14, font: helveticaBold, size: 11, color: GRAY_DARK });
    metaX += 160;
  }
  y -= 44;

  page.drawText('TRANSCRIPCION', { x: marginX, y, font: helveticaBold, size: 9, color: GRAY_MID });
  y -= 18;

  const bodySize = 11;
  const lineHeight = bodySize * 1.8;
  const lines = wrapText(transcription.formattedText, helvetica, bodySize, contentWidth);

  for (const line of lines) {
    if (y < 72) {
      const next = addPage();
      page = next.page;
      y = next.y;
    }
    if (line) {
      page.drawText(line, { x: marginX, y, font: helvetica, size: bodySize, color: BODY_COLOR });
    }
    y -= lineHeight;
  }

  const allPages = doc.getPages();
  for (const p of allPages) {
    const footerY = 32;
    p.drawLine({ start: { x: marginX, y: footerY + 12 }, end: { x: pageWidth - marginX, y: footerY + 12 }, thickness: 0.5, color: GRAY_LIGHT });
    p.drawText('Generado con Hermes', { x: marginX, y: footerY, font: helvetica, size: 8, color: GRAY_MID });
    p.drawText(formatDate(transcription.createdAt), { x: pageWidth - marginX - 140, y: footerY, font: helvetica, size: 8, color: GRAY_MID });
  }

  return doc.save();
}
