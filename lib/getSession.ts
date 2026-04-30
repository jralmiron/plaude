import { cookies } from 'next/headers';
import { verifyToken, COOKIE_NAME, type SessionPayload } from './auth';

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value ?? '';
  if (!token) return null;
  const secret = process.env.SESSION_SECRET ?? 'changeme-set-SESSION_SECRET-in-env';
  return verifyToken(token, secret);
}
