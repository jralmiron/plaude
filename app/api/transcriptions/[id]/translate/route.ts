import { and, eq } from 'drizzle-orm';
import Groq from 'groq-sdk';
import { NextResponse } from 'next/server';
import { ensureAppBootstrap } from '@/lib/bootstrap';
import { isAdminUser, requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { invalidateStoredPdf } from '@/lib/pdf-store';
import { transcriptions } from '@/lib/schema';

export const runtime = 'nodejs';
export const maxDuration = 60;

const LANG_NAMES: Record<string, string> = { es: 'Spanish', en: 'English', fr: 'French', de: 'German', pt: 'Portuguese', it: 'Italian' };

function splitIntoChunks(text: string, maxWords = 800) {
  const paragraphs = text.split(/\n+/);
  const chunks: string[] = [];
  let current: string[] = [];
  let wordCount = 0;
  for (const paragraph of paragraphs) {
    const words = paragraph.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount + words > maxWords && current.length > 0) {
      chunks.push(current.join('\n'));
      current = [];
      wordCount = 0;
    }
    current.push(paragraph);
    wordCount += words;
  }
  if (current.length > 0) chunks.push(current.join('\n'));
  return chunks;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureAppBootstrap();
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user;

  const { id } = await params;
  const transcriptionId = Number.parseInt(id, 10);
  if (!Number.isInteger(transcriptionId) || transcriptionId <= 0) return NextResponse.json({ error: 'Invalid transcription id' }, { status: 400 });

  const body = await request.json().catch(() => ({}));
  const targetLang = typeof body.targetLang === 'string' ? body.targetLang : '';
  if (!LANG_NAMES[targetLang]) return NextResponse.json({ error: 'targetLang must be one of es,en,fr,de,pt,it' }, { status: 400 });

  const db = getDb();
  const filter = isAdminUser(user) ? eq(transcriptions.id, transcriptionId) : and(eq(transcriptions.id, transcriptionId), eq(transcriptions.userId, user.id));
  const [item] = await db.select().from(transcriptions).where(filter!).limit(1);
  if (!item) return NextResponse.json({ error: 'Transcription not found' }, { status: 404 });

  try {
    const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
    const translated: string[] = [];
    for (const chunk of splitIntoChunks(item.formattedText)) {
      const result = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [
          { role: 'system', content: `Translate the following text to ${LANG_NAMES[targetLang]}. Preserve paragraph breaks and labels. Return only the translated text.` },
          { role: 'user', content: chunk },
        ],
        max_tokens: 2048,
        temperature: 0.1,
      });
      translated.push(result.choices[0]?.message?.content?.trim() || chunk);
    }

    const [updated] = await db.update(transcriptions).set({ formattedText: translated.join('\n\n'), outputLanguage: targetLang, updatedAt: new Date() }).where(eq(transcriptions.id, transcriptionId)).returning();
    await invalidateStoredPdf(transcriptionId);
    return NextResponse.json({ formattedText: updated.formattedText, outputLanguage: updated.outputLanguage });
  } catch (error) {
    return NextResponse.json({ error: (error as Error).message || 'Translation failed' }, { status: 500 });
  }
}
