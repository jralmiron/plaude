'use client';

import { useEffect, useState } from 'react';

interface UserItem {
  id: number;
  username: string;
  role: string;
  createdAt: string;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('es-ES', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function AdminPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Nuevo usuario
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'user' | 'admin'>('user');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Edición
  const [editing, setEditing] = useState<number | null>(null);
  const [editUsername, setEditUsername] = useState('');
  const [editPassword, setEditPassword] = useState('');
  const [editRole, setEditRole] = useState<'user' | 'admin'>('user');
  const [saving, setSaving] = useState(false);

  // Borrado
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [deleting, setDeleting] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    fetch('/api/admin/users')
      .then((r) => r.json())
      .then((d: UserItem[]) => { setUsers(d); setLoading(false); })
      .catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const createUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername, password: newPassword, role: newRole }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al crear');
      setNewUsername(''); setNewPassword(''); setNewRole('user');
      load();
    } catch (err) {
      setCreateError((err as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (u: UserItem) => {
    setEditing(u.id);
    setEditUsername(u.username);
    setEditPassword('');
    setEditRole(u.role as 'user' | 'admin');
  };

  const saveEdit = async (id: number) => {
    setSaving(true);
    const body: Record<string, string> = { username: editUsername, role: editRole };
    if (editPassword) body.password = editPassword;
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Error al guardar');
      setEditing(null);
      load();
    } catch {
      alert('No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const deleteUser = async (id: number) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'Error al borrar');
      setConfirmDelete(null);
      load();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setDeleting(null);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 py-16">
        {/* Cabecera */}
        <div className="flex items-center justify-between mb-10">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">
              pla<span className="text-indigo-400">ude</span>{' '}
              <span className="text-gray-400 font-normal text-xl">/ admin</span>
            </h1>
            <p className="text-gray-500 text-sm mt-1">Gestión de usuarios</p>
          </div>
          <a
            href="/"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Volver
          </a>
        </div>

        {/* Formulario nuevo usuario */}
        <div className="bg-white border border-gray-200 shadow-sm rounded-2xl p-6 mb-8">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-widest mb-4">
            Nuevo usuario
          </h2>
          <form onSubmit={createUser} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Usuario</label>
                <input
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  placeholder="nombre_usuario"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Contraseña</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2.5 text-sm text-gray-900 focus:outline-none focus:border-indigo-500/60 transition-all"
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-xl p-1">
                {(['user', 'admin'] as const).map((r) => (
                  <button
                    key={r} type="button" onClick={() => setNewRole(r)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      newRole === r ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-700'
                    }`}
                  >
                    {r === 'admin' ? 'Administrador' : 'Usuario'}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={creating}
                className="ml-auto flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
              >
                {creating ? (
                  <div className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                )}
                Crear
              </button>
            </div>
            {createError && (
              <p className="text-red-400 text-xs bg-red-400/10 border border-red-400/20 rounded-lg px-3 py-2">
                {createError}
              </p>
            )}
          </form>
        </div>

        {/* Lista de usuarios */}
        <div>
          <p className="text-xs font-medium text-gray-500 uppercase tracking-widest mb-4">
            Usuarios · {users.length}
          </p>
          {loading ? (
            <div className="space-y-3">
              {[1, 2].map((i) => (
                <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((u) => (
                <div
                  key={u.id}
                  className="bg-white border border-gray-200 shadow-sm rounded-xl overflow-hidden"
                >
                  {editing === u.id ? (
                    <div className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Usuario</label>
                          <input
                            value={editUsername}
                            onChange={(e) => setEditUsername(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 focus:outline-none focus:border-indigo-500/60 transition-all"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Nueva contraseña (opcional)</label>
                          <input
                            type="password"
                            value={editPassword}
                            onChange={(e) => setEditPassword(e.target.value)}
                            placeholder="dejar vacío para no cambiar"
                            className="w-full bg-gray-50 border border-gray-300 rounded-xl px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-indigo-500/60 transition-all"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-gray-100 border border-gray-200 rounded-xl p-1">
                          {(['user', 'admin'] as const).map((r) => (
                            <button
                              key={r} type="button" onClick={() => setEditRole(r)}
                              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                                editRole === r ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-700'
                              }`}
                            >
                              {r === 'admin' ? 'Administrador' : 'Usuario'}
                            </button>
                          ))}
                        </div>
                        <div className="ml-auto flex gap-2">
                          <button
                            onClick={() => saveEdit(u.id)}
                            disabled={saving}
                            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white transition-all disabled:opacity-50"
                          >
                            {saving ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : null}
                            Guardar
                          </button>
                          <button
                            onClick={() => setEditing(null)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-all"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-4 p-4">
                      <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
                        <span className="text-indigo-400 text-sm font-bold uppercase">
                          {u.username[0]}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900">{u.username}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            u.role === 'admin'
                              ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/20'
                              : 'bg-gray-100 text-gray-500'
                          }`}>
                            {u.role === 'admin' ? 'Admin' : 'Usuario'}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(u.createdAt)}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button
                          onClick={() => startEdit(u)}
                          className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-gray-700 hover:border-gray-400 transition-all"
                        >
                          Editar
                        </button>
                        {confirmDelete === u.id ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-red-400">¿Seguro?</span>
                            <button
                              onClick={() => deleteUser(u.id)}
                              disabled={deleting === u.id}
                              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 transition-all disabled:opacity-50"
                            >
                              {deleting === u.id ? 'Borrando…' : 'Sí'}
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-xs text-gray-400 hover:text-gray-600 transition-all"
                            >
                              No
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(u.id)}
                            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-gray-200 text-gray-400 hover:text-red-500 hover:border-red-400/40 transition-all"
                          >
                            Borrar
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
