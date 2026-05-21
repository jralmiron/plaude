'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { AppFrame, HermesWordmark } from '@/components/AppFrame';
import type { AdminUserItem, CurrentUser, PermissionSet, Role } from '@/components/types';

const DEFAULT_PERMISSIONS: Record<Role, PermissionSet> = {
  admin: {
    manageUsers: true,
    viewPasswords: true,
    manageRoles: true,
    deleteUsers: true,
    exportPdfs: true,
    editOwnConversations: true,
    changeOwnPassword: true,
  },
  user: {
    manageUsers: false,
    viewPasswords: false,
    manageRoles: false,
    deleteUsers: false,
    exportPdfs: true,
    editOwnConversations: true,
    changeOwnPassword: true,
  },
};

const PERMISSION_FIELDS: { key: keyof PermissionSet; label: string }[] = [
  { key: 'manageUsers', label: 'Gestionar usuarios' },
  { key: 'viewPasswords', label: 'Ver contraseñas' },
  { key: 'manageRoles', label: 'Cambiar roles' },
  { key: 'deleteUsers', label: 'Eliminar usuarios' },
  { key: 'exportPdfs', label: 'Exportar PDFs' },
  { key: 'editOwnConversations', label: 'Editar conversaciones propias' },
  { key: 'changeOwnPassword', label: 'Cambiar contraseña propia' },
];

function fmtDate(iso?: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function buildPermissions(role: Role, permissions?: PermissionSet): PermissionSet {
  return { ...DEFAULT_PERMISSIONS[role], ...permissions };
}

export function AdminUserManager({ currentUser }: { currentUser: CurrentUser }) {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('user');
  const [newPermissions, setNewPermissions] = useState<PermissionSet>(buildPermissions('user'));
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const [editing, setEditing] = useState<number | null>(null);
  const [editModel, setEditModel] = useState<{ username: string; role: Role; password: string; permissions: PermissionSet }>({
    username: '',
    role: 'user',
    password: '',
    permissions: buildPermissions('user'),
  });
  const [saving, setSaving] = useState(false);

  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/users', { cache: 'no-store', credentials: 'include' });
      if (!res.ok) throw new Error('No se pudo cargar el listado de usuarios');
      const data = (await res.json()) as AdminUserItem[];
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const resetCreateForm = () => {
    setNewUsername('');
    setNewPassword('');
    setNewRole('user');
    setNewPermissions(buildPermissions('user'));
  };

  const handleRolePreset = (role: Role, mode: 'create' | 'edit') => {
    if (mode === 'create') {
      setNewRole(role);
      setNewPermissions(buildPermissions(role, newPermissions));
      return;
    }
    setEditModel((prev) => ({ ...prev, role, permissions: buildPermissions(role, prev.permissions) }));
  };

  const togglePermission = (mode: 'create' | 'edit', key: keyof PermissionSet) => {
    if (mode === 'create') {
      setNewPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
      return;
    }
    setEditModel((prev) => ({ ...prev, permissions: { ...prev.permissions, [key]: !prev.permissions[key] } }));
  };

  const createUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          role: newRole,
          permissions: newPermissions,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'No se pudo crear el usuario');
      resetCreateForm();
      await load();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (user: AdminUserItem) => {
    setEditing(user.id);
    setEditModel({
      username: user.username,
      role: user.role,
      password: '',
      permissions: buildPermissions(user.role, user.permissions),
    });
  };

  const saveEdit = async (id: number) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        username: editModel.username,
        role: editModel.role,
        permissions: editModel.permissions,
      };
      if (editModel.password) body.password = editModel.password;
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'No se pudo guardar');
      setEditing(null);
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id: number) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE', credentials: 'include' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload.error || 'No se pudo eliminar');
      setConfirmDelete(null);
      await load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  const logout = async () => {
    setLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } finally {
      router.replace('/login');
      router.refresh();
      setLoggingOut(false);
    }
  };

  return (
    <AppFrame
      eyebrow="Administración"
      title={<HermesWordmark suffix="usuarios" />}
      actions={
        <>
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950">
            Dashboard personal
          </Link>
          <button
            type="button"
            onClick={logout}
            disabled={loggingOut}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950 disabled:opacity-50"
          >
            {loggingOut ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" /> : null}
            Cerrar sesión
          </button>
        </>
      }
    >
      <div className="space-y-6">
        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <form onSubmit={createUser} className="rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.28)] backdrop-blur sm:p-7">
            <div className="mb-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-500">Nuevo usuario</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">Crear cuenta</h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Usuario</label>
                <input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Rol</label>
                <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                  {(['user', 'admin'] as Role[]).map((role) => (
                    <button key={role} type="button" onClick={() => handleRolePreset(role, 'create')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${newRole === role ? 'bg-slate-950 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                      {role === 'admin' ? 'Administrador' : 'Usuario'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Contraseña inicial</label>
                <input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100" />
              </div>
              <div className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-700">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                Contraseña cifrada · no recuperable
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Permisos operativos</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {PERMISSION_FIELDS.map((permission) => (
                  <button
                    key={permission.key}
                    type="button"
                    onClick={() => togglePermission('create', permission.key)}
                    className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${newPermissions[permission.key] ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}
                  >
                    <span>{permission.label}</span>
                    <span className={`h-5 w-9 rounded-full p-0.5 transition ${newPermissions[permission.key] ? 'bg-orange-500' : 'bg-slate-300'}`}>
                      <span className={`block h-4 w-4 rounded-full bg-white transition ${newPermissions[permission.key] ? 'translate-x-4' : 'translate-x-0'}`} />
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {createError ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{createError}</div> : null}

            <button type="submit" disabled={creating || !newUsername || !newPassword} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">
              {creating ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
              Crear usuario
            </button>
          </form>

          <section className="rounded-[32px] border border-slate-200/80 bg-slate-950 p-6 text-white shadow-[0_24px_90px_-44px_rgba(15,23,42,0.8)] sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-200">Resumen</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Sesión activa</p>
                <p className="mt-2 text-base font-semibold">{currentUser.displayName || currentUser.username}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Total usuarios</p>
                <p className="mt-2 text-base font-semibold">{users.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Administradores</p>
                <p className="mt-2 text-base font-semibold">{users.filter((u) => u.role === 'admin').length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-4">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Conversaciones totales</p>
                <p className="mt-2 text-base font-semibold">{users.reduce((acc, u) => acc + (u.conversationCount ?? 0), 0)}</p>
              </div>
            </div>
          </section>
        </section>

        <section className="rounded-[32px] border border-white/80 bg-white/92 p-6 shadow-[0_24px_80px_-44px_rgba(15,23,42,0.28)] backdrop-blur sm:p-7">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.32em] text-orange-500">Usuarios</p>
              <h2 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-slate-950">Accesos y permisos</h2>
            </div>
            <button type="button" onClick={() => void load()} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950">
              Refrescar
            </button>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-36 animate-pulse rounded-[24px] bg-slate-100" />)}
            </div>
          ) : (
            <div className="space-y-4">
              {users.map((user) => {
                const isEditing = editing === user.id;
                const permissionSource = isEditing ? editModel.permissions : buildPermissions(user.role, user.permissions);
                return (
                  <article key={user.id} className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,_rgba(255,255,255,1)_0%,_rgba(248,250,252,0.88)_100%)] p-5 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)] sm:p-6">
                    {isEditing ? (
                      <div className="space-y-5">
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Usuario</label>
                            <input value={editModel.username} onChange={(e) => setEditModel((prev) => ({ ...prev, username: e.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100" />
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Rol</label>
                            <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                              {(['user', 'admin'] as Role[]).map((role) => (
                                <button key={role} type="button" onClick={() => handleRolePreset(role, 'edit')} className={`flex-1 rounded-xl px-3 py-2 text-sm font-medium transition ${editModel.role === role ? 'bg-slate-950 text-white' : 'text-slate-500 hover:text-slate-900'}`}>
                                  {role === 'admin' ? 'Administrador' : 'Usuario'}
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Resetear contraseña</label>
                            <input value={editModel.password} onChange={(e) => setEditModel((prev) => ({ ...prev, password: e.target.value }))} placeholder="Dejar vacío para no cambiar" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-300 focus:bg-white focus:ring-4 focus:ring-orange-100" />
                          </div>
                        </div>
                        <div>
                          <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Permisos</p>
                          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                            {PERMISSION_FIELDS.map((permission) => (
                              <button key={permission.key} type="button" onClick={() => togglePermission('edit', permission.key)} className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition ${permissionSource[permission.key] ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:text-slate-800'}`}>
                                <span>{permission.label}</span>
                                <span className={`h-5 w-9 rounded-full p-0.5 transition ${permissionSource[permission.key] ? 'bg-orange-500' : 'bg-slate-300'}`}>
                                  <span className={`block h-4 w-4 rounded-full bg-white transition ${permissionSource[permission.key] ? 'translate-x-4' : 'translate-x-0'}`} />
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => saveEdit(user.id)} disabled={saving} className="inline-flex items-center gap-2 rounded-2xl bg-slate-950 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:opacity-50">
                            {saving ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" /> : null}
                            Guardar cambios
                          </button>
                          <button onClick={() => setEditing(null)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950">Cancelar</button>
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                        <div className="space-y-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-200 bg-orange-50 text-base font-semibold text-orange-600">
                                {user.username.slice(0, 1).toUpperCase()}
                              </div>
                              <div>
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="text-lg font-semibold tracking-[-0.03em] text-slate-950">{user.displayName || user.username}</h3>
                                  <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${user.role === 'admin' ? 'border border-orange-200 bg-orange-50 text-orange-700' : 'border border-slate-200 bg-slate-50 text-slate-500'}`}>
                                    {user.role === 'admin' ? 'Admin' : 'Usuario'}
                                  </span>
                                </div>
                                <p className="mt-1 text-sm text-slate-500">@{user.username}</p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <button onClick={() => startEdit(user)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:text-slate-950">Editar</button>
                              {confirmDelete === user.id ? (
                                <div className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                  <span>¿Eliminar?</span>
                                  <button onClick={() => deleteUser(user.id)} disabled={deleting === user.id} className="rounded-xl bg-red-600 px-3 py-1.5 text-white transition hover:bg-red-500 disabled:opacity-50">{deleting === user.id ? 'Borrando…' : 'Sí'}</button>
                                  <button onClick={() => setConfirmDelete(null)} className="font-medium text-red-700 hover:text-red-900">Cancelar</button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmDelete(user.id)} className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-400 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600">Borrar</button>
                              )}
                            </div>
                          </div>

                          <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Alta</p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">{fmtDate(user.createdAt)}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">Conversaciones</p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">{user.conversationCount ?? '—'}</p>
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                              <p className="text-[11px] uppercase tracking-[0.22em] text-slate-400">PDFs</p>
                              <p className="mt-2 text-sm font-semibold text-slate-900">{user.pdfCount ?? '—'}</p>
                            </div>
                          </div>


                        </div>

                        <div>
                          <p className="mb-3 text-xs font-medium uppercase tracking-[0.22em] text-slate-400">Permisos</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {PERMISSION_FIELDS.map((permission) => (
                              <div key={permission.key} className={`flex items-center gap-2 rounded-2xl border px-3 py-2.5 text-sm ${permissionSource[permission.key] ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-400'}`}>
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${permissionSource[permission.key] ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                                <span>{permission.label}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </AppFrame>
  );
}
