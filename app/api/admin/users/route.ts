import { asc, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ensureAppBootstrap } from '@/lib/bootstrap';
import {
  buildPermissionsForUser,
  hashPassword,
  normalizeUsername,
  requireUser,
  sanitizeBoolean,
  validatePasswordStrength,
  validateRole,
} from '@/lib/auth';
import { getDb } from '@/lib/db';
import { pdfDocuments, transcriptions, users } from '@/lib/schema';

function permissionsFromBody(role: 'admin' | 'user', raw: unknown) {
  const permissionMap = typeof raw === 'object' && raw ? (raw as Record<string, unknown>) : {};
  if (role === 'admin') {
    return {
      canManageUsers: sanitizeBoolean(permissionMap.manageUsers, true),
      canManagePasswords: sanitizeBoolean(permissionMap.viewPasswords, true),
      canViewAllConversations: sanitizeBoolean(permissionMap.exportPdfs, true),
    };
  }
  return {
    canManageUsers: false,
    canManagePasswords: false,
    canViewAllConversations: false,
  };
}

export async function GET() {
  await ensureAppBootstrap();
  const auth = await requireUser({ adminOnly: true });
  if (auth.response) return auth.response;

  const db = getDb();
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      displayName: users.displayName,
      role: users.role,
      canManageUsers: users.canManageUsers,
      canManagePasswords: users.canManagePasswords,
      canViewAllConversations: users.canViewAllConversations,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      conversationCount: sql<number>`count(distinct ${transcriptions.id})`,
      pdfCount: sql<number>`count(distinct ${pdfDocuments.id})`,
      lastActiveAt: sql<string | null>`max(${transcriptions.updatedAt})`,
    })
    .from(users)
    .leftJoin(transcriptions, eq(transcriptions.userId, users.id))
    .leftJoin(pdfDocuments, eq(pdfDocuments.userId, users.id))
    .groupBy(users.id)
    .orderBy(asc(users.createdAt));

  return NextResponse.json(
    rows.map((entry) => ({
      id: entry.id,
      username: entry.username,
      displayName: entry.displayName,
      role: entry.role,
      createdAt: entry.createdAt,
      permissions: buildPermissionsForUser(entry),
      conversationCount: Number(entry.conversationCount ?? 0),
      pdfCount: Number(entry.pdfCount ?? 0),
      lastActiveAt: entry.lastActiveAt,
      passwordManaged: true,
    }))
  );
}

export async function POST(request: Request) {
  await ensureAppBootstrap();
  const auth = await requireUser({ adminOnly: true });
  if (auth.response) return auth.response;

  const body = await request.json().catch(() => ({}));
  const username = typeof body.username === 'string' ? normalizeUsername(body.username) : '';
  const password = typeof body.password === 'string' ? body.password : '';
  const role = typeof body.role === 'string' && validateRole(body.role) ? body.role : 'user';
  const displayName =
    typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim() : username;

  if (!username || !password) {
    return NextResponse.json({ error: 'username and password are required' }, { status: 400 });
  }
  if (!validatePasswordStrength(password)) {
    return NextResponse.json({ error: 'Password must be between 8 and 128 characters' }, { status: 400 });
  }

  const db = getDb();
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, username)).limit(1);
  if (existing) {
    return NextResponse.json({ error: 'User already exists' }, { status: 409 });
  }

  const permissionFlags = permissionsFromBody(role, body.permissions);
  const [created] = await db
    .insert(users)
    .values({
      username,
      displayName,
      passwordHash: await hashPassword(password),
      passwordPlain: '',
      role,
      ...permissionFlags,
      updatedAt: new Date(),
    })
    .returning();

  return NextResponse.json(
    {
      id: created.id,
      username: created.username,
      displayName: created.displayName,
      role: created.role,
      createdAt: created.createdAt,
      permissions: buildPermissionsForUser(created),
      conversationCount: 0,
      pdfCount: 0,
      lastActiveAt: null,
      passwordManaged: true,
    },
    { status: 201 }
  );
}
