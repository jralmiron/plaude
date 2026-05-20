import { eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ensureAppBootstrap } from '@/lib/bootstrap';
import { buildPermissionsForUser, requireUser } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audioChunks, pdfDocuments, sessions, transcriptions } from '@/lib/schema';

export async function GET() {
  await ensureAppBootstrap();
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user;

  const db = getDb();
  const [conversationStats] = await db
    .select({
      conversations: sql<number>`count(*)`,
      minutes: sql<number>`coalesce(sum(${transcriptions.durationSeconds}), 0)`,
    })
    .from(transcriptions)
    .where(eq(transcriptions.userId, user.id));

  const [pdfStats] = await db
    .select({ pdfs: sql<number>`count(*)` })
    .from(pdfDocuments)
    .where(eq(pdfDocuments.userId, user.id));

  const [chunkStats] = await db
    .select({ pendingChunks: sql<number>`count(*)` })
    .from(audioChunks)
    .leftJoin(sessions, eq(sessions.id, audioChunks.sessionId))
    .where(eq(sessions.userId, user.id));

  return NextResponse.json({
    authenticated: true,
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      permissions: buildPermissionsForUser(user),
    },
    stats: {
      conversations: Number(conversationStats?.conversations ?? 0),
      pdfs: Number(pdfStats?.pdfs ?? 0),
      pendingChunks: Number(chunkStats?.pendingChunks ?? 0),
      minutes: Math.round(Number(conversationStats?.minutes ?? 0) / 60),
    },
  });
}
