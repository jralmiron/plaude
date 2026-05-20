import { NextResponse } from 'next/server';
import { ensureAppBootstrap } from '@/lib/bootstrap';
import { requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { sessions } from '@/lib/schema';

const ALLOWED_OUTPUT_LANGS = new Set(['es', 'en', 'fr', 'de', 'pt', 'it']);

export async function POST(request: Request) {
  await ensureAppBootstrap();
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user;

  const body = await request.json().catch(() => ({}));
  const outputLanguage = typeof body.outputLanguage === 'string' && ALLOWED_OUTPUT_LANGS.has(body.outputLanguage) ? body.outputLanguage : 'es';

  const db = getDb();
  const [session] = await db
    .insert(sessions)
    .values({ userId: user.id, outputLanguage, status: 'recording', updatedAt: new Date() })
    .returning({ id: sessions.id });

  return NextResponse.json({ id: session.id });
}
