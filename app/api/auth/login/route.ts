import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { ensureAppBootstrap } from '@/lib/bootstrap';
import { buildSessionCookie, buildSessionValue, verifyPassword } from '@/lib/auth';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  await ensureAppBootstrap();
  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === 'string' ? body.username.trim().toLowerCase() : '';
  const password = typeof body.password === 'string' ? body.password : '';

  if (!username || !password) {
    return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
  }

  const db = getDb();
  const [user] = await db.select().from(users).where(eq(users.username, username)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 });
  }

  const response = NextResponse.json({
    user: {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
    },
  });
  response.cookies.set(
    buildSessionCookie(
      buildSessionValue({
        userId: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role as 'admin' | 'user',
        canManageUsers: user.canManageUsers,
        canManagePasswords: user.canManagePasswords,
        canViewAllConversations: user.canViewAllConversations,
      })
    )
  );
  return response;
}
