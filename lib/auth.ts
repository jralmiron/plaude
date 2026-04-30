export const COOKIE_NAME = 'plaude_session';
export const SESSION_MS = 60 * 60 * 1000; // 1 hora

export interface SessionPayload {
  username: string;
  role: string;
  exp: number;
}

// ── Token helpers ────────────────────────────────────────────────────────────

export async function createToken(
  username: string,
  role: string,
  secret: string
): Promise<string> {
  const payload = { u: username, r: role, e: Date.now() + SESSION_MS };
  const payloadB64 = btoa(JSON.stringify(payload));
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(payloadB64));
  let sig = '';
  for (const b of new Uint8Array(sigBuf)) sig += String.fromCharCode(b);
  return `${payloadB64}.${btoa(sig)}`;
}

export async function verifyToken(
  token: string,
  secret: string
): Promise<SessionPayload | null> {
  try {
    const [payloadB64, sigB64] = token.split('.');
    if (!payloadB64 || !sigB64) return null;
    const payload = JSON.parse(atob(payloadB64)) as { u: string; r: string; e: number };
    if (!payload.e || Date.now() > payload.e) return null;
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']
    );
    const sigBytes = Uint8Array.from(atob(sigB64), (c) => c.charCodeAt(0));
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(payloadB64));
    if (!valid) return null;
    return { username: payload.u, role: payload.r, exp: payload.e };
  } catch {
    return null;
  }
}

// ── Password helpers (PBKDF2, solo en API routes — no Edge) ──────────────────

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    key, 256
  );
  const toHex = (a: Uint8Array) => Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${toHex(salt)}:${toHex(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [saltHex, storedHash] = stored.split(':');
    const salt = new Uint8Array(saltHex.match(/.{2}/g)!.map((b) => parseInt(b, 16)));
    const key = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      key, 256
    );
    const newHash = Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
    if (newHash.length !== storedHash.length) return false;
    let diff = 0;
    for (let i = 0; i < newHash.length; i++) diff |= newHash.charCodeAt(i) ^ storedHash.charCodeAt(i);
    return diff === 0;
  } catch {
    return false;
  }
}
