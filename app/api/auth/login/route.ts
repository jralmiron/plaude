import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db';
import { users } from '@/lib/schema';
import { createToken, hashPassword, verifyPassword, COOKIE_NAME, SESSION_MS } from '@/lib/auth';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const { username, password } = await request.json().catch(() => ({}));
  if (!username || !password) {
    return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
  }

  const secret = process.env.SESSION_SECRET ?? 'changeme-set-SESSION_SECRET-in-env';
  const db = getDb();

  // Auto-seed: si la tabla está vacía y hay variables de entorno, crear admin inicial
  const all = await db.select({ id: users.id }).from(users);
  if (all.length === 0) {
    const envUser = process.env.AUTH_USER;
    const envPass = process.env.AUTH_PASS;
    if (envUser && envPass) {
      const hash = await hashPassword(envPass);
      await db.insert(users).values({ username: envUser, passwordHash: hash, role: 'admin' });
    }
  }

  // Buscar usuario en BD
  const [user] = await db.select().from(users).where(eq(users.username, username));

  // Delay constante para dificultar fuerza bruta (tanto si existe como si no)
  const valid = user ? await verifyPassword(password, user.passwordHash) : false;
  if (!user || !valid) {
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
  }

  const token = await createToken(user.username, user.role, secret);

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MS / 1000,
    path: '/',
  });
  return response;
}
