import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { ensureAppBootstrap } from '@/lib/bootstrap';
import {
  buildPermissionsForUser,
  hashPassword,
  masterUsername,
  normalizeUsername,
  requireUser,
  sanitizeBoolean,
  validatePasswordStrength,
  validateRole,
} from '@/lib/auth';
import { getDb } from '@/lib/db';
import { audioChunks, pdfDocuments, sessions, transcriptions, users } from '@/lib/schema';

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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureAppBootstrap();
  const auth = await requireUser({ adminOnly: true });
  if (auth.response) return auth.response;

  const { id } = await params;
  const userId = Number.parseInt(id, 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  const db = getDb();
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const body = await request.json().catch(() => ({}));
  const role = typeof body.role === 'string' && validateRole(body.role) ? body.role : (target.role as 'admin' | 'user');
  const username = typeof body.username === 'string' ? normalizeUsername(body.username) : target.username;
  const displayName =
    typeof body.displayName === 'string' && body.displayName.trim() ? body.displayName.trim() : target.displayName;

  if (target.username === masterUsername() && (username !== masterUsername() || role !== 'admin')) {
    return NextResponse.json({ error: 'The master admin account cannot be renamed or demoted' }, { status: 400 });
  }

  const updates: Record<string, unknown> = {
    username,
    displayName,
    role,
    ...permissionsFromBody(role, body.permissions),
    updatedAt: new Date(),
  };

  if (typeof body.password === 'string' && body.password.length > 0) {
    if (!validatePasswordStrength(body.password)) {
      return NextResponse.json({ error: 'Password must be between 8 and 128 characters' }, { status: 400 });
    }
    updates.passwordHash = await hashPassword(body.password);
    updates.passwordPlain = '';
  }

  const [updated] = await db.update(users).set(updates).where(eq(users.id, userId)).returning();
  return NextResponse.json({
    id: updated.id,
    username: updated.username,
    displayName: updated.displayName,
    role: updated.role,
    createdAt: updated.createdAt,
    permissions: buildPermissionsForUser(updated),
    passwordManaged: true,
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  await ensureAppBootstrap();
  const auth = await requireUser({ adminOnly: true });
  if (auth.response) return auth.response;
  const actingUser = auth.user;

  const { id } = await params;
  const userId = Number.parseInt(id, 10);
  if (!Number.isInteger(userId) || userId <= 0) {
    return NextResponse.json({ error: 'Invalid user id' }, { status: 400 });
  }

  const db = getDb();
  const [target] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!target) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }
  if (target.id === actingUser.id) {
    return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 });
  }
  if (target.username === masterUsername()) {
    return NextResponse.json({ error: 'The master admin account cannot be deleted' }, { status: 400 });
  }

  const ownedSessions = await db.select({ id: sessions.id }).from(sessions).where(eq(sessions.userId, userId));
  for (const session of ownedSessions) {
    await db.delete(audioChunks).where(eq(audioChunks.sessionId, session.id));
  }
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(pdfDocuments).where(eq(pdfDocuments.userId, userId));
  await db.delete(transcriptions).where(eq(transcriptions.userId, userId));
  await db.delete(users).where(eq(users.id, userId));

  return NextResponse.json({ success: true });
}
