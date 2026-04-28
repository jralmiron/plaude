import { getDb } from '@/lib/db';
import { transcriptions } from '@/lib/schema';
import { desc } from 'drizzle-orm';

export async function GET() {
  const db = getDb();
  const result = await db
    .select()
    .from(transcriptions)
    .orderBy(desc(transcriptions.createdAt));

  return Response.json(result);
}
