import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ensureAppBootstrap } from '@/lib/bootstrap';
import { hashPassword, requireUser, validatePasswordStrength, verifyPassword } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';

async function handle(request: Request) {
  await ensureAppBootstrap();
  const auth = await requireUser();
  if (auth.response) return auth.response;
  const user = auth.user;

  const body = await request.json().catch(() => ({}));
  const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'currentPassword and newPassword are required' }, { status: 400 });
  }
  if (!validatePasswordStrength(newPassword)) {
    return NextResponse.json({ error: 'Password must be between 8 and 128 characters' }, { status: 400 });
  }
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    return NextResponse.json({ error: 'Current password is incorrect' }, { status: 401 });
  }

  const db = getDb();
  await db
    .update(users)
    .set({ passwordHash: await hashPassword(newPassword), passwordPlain: '', updatedAt: new Date() })
    .where(eq(users.id, user.id));

  return NextResponse.json({ success: true });
}

export const PATCH = handle;
export const POST = handle;
