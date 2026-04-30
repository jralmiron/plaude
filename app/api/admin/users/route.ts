import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt).map((b) => b.toString(16).padStart(2, '0')).join('');
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, key, 256);
  const hashHex = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${saltHex}:${hashHex}`;
}

export async function GET() {
  const db = getDb();
  const result = await db
    .select({ id: users.id, username: users.username, role: users.role, createdAt: users.createdAt })
    .from(users)
    .orderBy(users.createdAt);
  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const { username, password, role = 'user' } = await request.json().catch(() => ({}));

  if (!username || !password) {
    return NextResponse.json({ error: 'username y password requeridos' }, { status: 400 });
  }
  if (!['admin', 'user'].includes(role)) {
    return NextResponse.json({ error: 'role debe ser admin o user' }, { status: 400 });
  }

  const db = getDb();
  const passwordHash = await hashPassword(password);
  try {
    const [user] = await db
      .insert(users)
      .values({ username, passwordHash, role })
      .returning({ id: users.id, username: users.username, role: users.role, createdAt: users.createdAt });
    return NextResponse.json(user, { status: 201 });
  } catch {
    // unique constraint → usuario ya existe
    const existing = await db.select().from(users).where(eq(users.username, username));
    if (existing.length > 0) {
      return NextResponse.json({ error: 'El usuario ya existe' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
  }
}
