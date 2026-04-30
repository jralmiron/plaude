import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { hashPassword, verifyToken, COOKIE_NAME } from '@/lib/auth';

async function getCurrentUsername(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? '';
  const secret = process.env.SESSION_SECRET ?? 'changeme';
  const payload = await verifyToken(token, secret);
  return payload?.username ?? null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const { username, password, role } = await request.json().catch(() => ({}));

  const updates: Record<string, string> = {};
  if (username) updates.username = username;
  if (role && ['admin', 'user'].includes(role)) updates.role = role;
  if (password) updates.passwordHash = await hashPassword(password);

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nada que actualizar' }, { status: 400 });
  }

  const db = getDb();
  const [updated] = await db
    .update(users)
    .set(updates)
    .where(eq(users.id, userId))
    .returning({ id: users.id });

  if (!updated) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  return NextResponse.json({ success: true });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const userId = parseInt(id, 10);
  if (isNaN(userId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 });

  const currentUsername = await getCurrentUsername();
  const db = getDb();

  const [target] = await db.select().from(users).where(eq(users.id, userId));
  if (!target) return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  if (target.username === currentUsername) {
    return NextResponse.json({ error: 'No puedes borrar tu propio usuario' }, { status: 400 });
  }

  await db.delete(users).where(eq(users.id, userId));
  return NextResponse.json({ success: true });
}
