import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { eq, inArray, sql } from 'drizzle-orm';
import { getDb } from './db';
import { hashPassword, verifyPassword } from './security';
import { pdfDocuments, sessions, transcriptions, users } from './schema';

export const SESSION_COOKIE = 'hermes_session';
const SESSION_DURATION_MS = 1000 * 60 * 60 * 24 * 7;
const MASTER_USERNAME = 'jr_almiron';

const seedUsers = [
  { username: 'arantxa', displayName: 'Arantxa', password: 'Arantxa.2026!', role: 'user' as const },
  { username: 'ismael', displayName: 'Ismael', password: 'Ismael.2026!', role: 'user' as const },
  { username: 'leticia', displayName: 'Leticia', password: 'Leticia.2026!', role: 'user' as const },
  { username: MASTER_USERNAME, displayName: 'Juanra', password: 'Correos.007', role: 'admin' as const },
];

export type SessionPayload = {
  userId: number;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  canManageUsers: boolean;
  canManagePasswords: boolean;
  canViewAllConversations: boolean;
  exp: number;
};

function defaultPermissions(role: 'admin' | 'user') {
  return role === 'admin'
    ? {
        manageUsers: true,
        viewPasswords: true,
        manageRoles: true,
        deleteUsers: true,
        exportPdfs: true,
        editOwnConversations: true,
        changeOwnPassword: true,
      }
    : {
        manageUsers: false,
        viewPasswords: false,
        manageRoles: false,
        deleteUsers: false,
        exportPdfs: true,
        editOwnConversations: true,
        changeOwnPassword: true,
      };
}

function getSessionSecret() {
  return process.env.AUTH_SECRET || process.env.COOKIE_SECRET || process.env.DATABASE_URL || 'hermes-dev-fallback-secret';
}

function sign(input: string) {
  return crypto.createHmac('sha256', getSessionSecret()).update(input).digest('base64url');
}

export function normalizeUsername(value: string) {
  return value.trim().toLowerCase();
}

export function createSessionValue(payload: Omit<SessionPayload, 'exp'>) {
  const sessionPayload: SessionPayload = { ...payload, exp: Date.now() + SESSION_DURATION_MS };
  const encoded = Buffer.from(JSON.stringify(sessionPayload)).toString('base64url');
  return `${encoded}.${sign(encoded)}`;
}

export const buildSessionValue = createSessionValue;

export function parseSessionValue(value?: string | null): SessionPayload | null {
  if (!value) return null;
  const [encoded, signature] = value.split('.');
  if (!encoded || !signature || sign(encoded) !== signature) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function getSession() {
  const store = await cookies();
  return parseSessionValue(store.get(SESSION_COOKIE)?.value);
}

export function buildSessionCookie(value: string) {
  return {
    name: SESSION_COOKIE,
    value,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: SESSION_DURATION_MS / 1000,
  };
}

export function buildExpiredSessionCookie() {
  return {
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  };
}

export type AuthenticatedUser = {
  id: number;
  username: string;
  displayName: string;
  role: 'admin' | 'user';
  canManageUsers: boolean;
  canManagePasswords: boolean;
  canViewAllConversations: boolean;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
};

export function isAdminUser(user: { role: string; canManageUsers?: boolean; canManagePasswords?: boolean; canViewAllConversations?: boolean }) {
  return user.role === 'admin' || Boolean(user.canManageUsers) || Boolean(user.canManagePasswords) || Boolean(user.canViewAllConversations);
}

export function masterUsername() {
  return MASTER_USERNAME;
}

export function validateRole(value: string): value is 'admin' | 'user' {
  return value === 'admin' || value === 'user';
}

export function validatePasswordStrength(password: string) {
  return typeof password === 'string' && password.length >= 8 && password.length <= 128;
}

export function sanitizeBoolean(value: unknown, fallback = false) {
  return typeof value === 'boolean' ? value : fallback;
}

export function adminUserSelect() {
  return {
    id: users.id,
    username: users.username,
    displayName: users.displayName,
    role: users.role,
    canManageUsers: users.canManageUsers,
    canManagePasswords: users.canManagePasswords,
    canViewAllConversations: users.canViewAllConversations,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  };
}

export { hashPassword, verifyPassword };

export async function getCurrentUser(): Promise<AuthenticatedUser | null> {
  const session = await getSession();
  if (!session) return null;

  const db = getDb();
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      canManageUsers: users.canManageUsers,
      canManagePasswords: users.canManagePasswords,
      canViewAllConversations: users.canViewAllConversations,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, session.userId))
    .limit(1);

  return (user as AuthenticatedUser | undefined) ?? null;
}

export async function requireUser(
  options?: { adminOnly?: boolean }
): Promise<
  | { user: AuthenticatedUser; response: null }
  | { user: null; response: Response }
> {
  const user = await getCurrentUser();
  if (!user) {
    return { user: null, response: Response.json({ error: 'Authentication required' }, { status: 401 }) };
  }
  if (options?.adminOnly && !isAdminUser(user)) {
    return { user: null, response: Response.json({ error: 'Forbidden' }, { status: 403 }) };
  }
  return { user, response: null };
}

export async function requireUserPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdminPage() {
  const user = await requireUserPage();
  if (!isAdminUser(user)) redirect('/dashboard');
  return user;
}

let seeded = false;
let seedPromise: Promise<void> | null = null;

export async function ensureSeedUsers() {
  if (seeded) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    const db = getDb();
    const existing = await db
      .select({ id: users.id, username: users.username })
      .from(users)
      .where(inArray(users.username, seedUsers.map((entry) => entry.username)));
    const existingByUsername = new Map(existing.map((entry) => [entry.username, entry.id]));

    for (const item of seedUsers) {
      const values = {
        username: item.username,
        displayName: item.displayName,
        passwordHash: await hashPassword(item.password),
        passwordPlain: '',
        role: item.role,
        canManageUsers: item.role === 'admin',
        canManagePasswords: item.role === 'admin',
        canViewAllConversations: item.role === 'admin',
        updatedAt: new Date(),
      };

      if (!existingByUsername.has(item.username)) {
        await db.insert(users).values(values);
        continue;
      }

      if (item.username === MASTER_USERNAME) {
        await db.update(users).set(values).where(eq(users.username, item.username));
      }
    }

    const [master] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, MASTER_USERNAME))
      .limit(1);

    if (master) {
      await db.update(sessions).set({ userId: master.id, updatedAt: new Date() }).where(sql`${sessions.userId} IS NULL`);
      await db.update(transcriptions).set({ userId: master.id, updatedAt: new Date() }).where(sql`${transcriptions.userId} IS NULL`);
      await db.update(pdfDocuments).set({ userId: master.id, updatedAt: new Date() }).where(sql`${pdfDocuments.userId} IS NULL`);
    }

    seeded = true;
  })();

  await seedPromise;
}

export function buildPermissionsForUser(user: { role: 'admin' | 'user' | string; canManageUsers?: boolean; canManagePasswords?: boolean; canViewAllConversations?: boolean }) {
  const base = defaultPermissions(user.role === 'admin' ? 'admin' : 'user');
  return {
    ...base,
    manageUsers: Boolean(user.canManageUsers) || base.manageUsers,
    viewPasswords: Boolean(user.canManagePasswords) || base.viewPasswords,
    manageRoles: isAdminUser(user) || base.manageRoles,
    deleteUsers: isAdminUser(user) || base.deleteUsers,
    exportPdfs: true,
    editOwnConversations: true,
    changeOwnPassword: true,
  };
}
