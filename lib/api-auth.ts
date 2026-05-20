import { NextResponse } from 'next/server';
import { getCurrentUser } from './auth';
import { ensureAppBootstrap } from './bootstrap';

export async function requireApiUser() {
  await ensureAppBootstrap();
  const user = await getCurrentUser();
  if (!user) {
    return {
      error: NextResponse.json({ error: 'No autenticado' }, { status: 401 }),
      user: null,
    };
  }

  return { error: null, user };
}

export async function requireApiAdmin() {
  const result = await requireApiUser();
  if (result.error || !result.user) return result;

  if (result.user.role !== 'admin' && !result.user.canManageUsers) {
    return {
      error: NextResponse.json({ error: 'No autorizado' }, { status: 403 }),
      user: null,
    };
  }

  return result;
}
