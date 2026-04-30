import { NextResponse } from 'next/server';

const COOKIE_NAME = 'plaude_session';
const SESSION_MS = 60 * 60 * 1000; // 1 hora

async function createToken(secret: string): Promise<string> {
  const payload = { exp: Date.now() + SESSION_MS };
  const payloadB64 = btoa(JSON.stringify(payload));

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sigBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64));
  const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
  return `${payloadB64}.${sigB64}`;
}

export async function POST(request: Request) {
  const { username, password } = await request.json().catch(() => ({}));

  const validUser = process.env.AUTH_USER;
  const validPass = process.env.AUTH_PASS;
  const secret = process.env.SESSION_SECRET ?? 'changeme-set-SESSION_SECRET-in-env';

  if (!validUser || !validPass || username !== validUser || password !== validPass) {
    // Pequeño delay para dificultar fuerza bruta
    await new Promise((r) => setTimeout(r, 400));
    return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 });
  }

  const token = await createToken(secret);

  const response = NextResponse.json({ success: true });
  response.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60, // 1 hora en segundos
    path: '/',
  });
  return response;
}
