import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { sessions } from '@/lib/schema';

export async function POST(request: Request) {
  const { outputLanguage = 'es' } = await request.json().catch(() => ({}));

  const db = getDb();
  const [session] = await db
    .insert(sessions)
    .values({ outputLanguage, status: 'recording' })
    .returning();

  return NextResponse.json({ id: session.id });
}
