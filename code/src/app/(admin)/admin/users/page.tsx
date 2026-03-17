"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { authClient } from "@/lib/auth-client";
import { AuthGuard } from "@/components/AuthGuard";

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  banned?: boolean;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const d = await api.get<{ users: User[] | { users: User[] } }>("/api/admin/users");
      const list = Array.isArray(d.users) ? d.users : (d.users as { users: User[] }).users ?? [];
      setUsers(list);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const d = await api.get<{ users: User[] | { users: User[] } }>("/api/admin/users");
        const list = Array.isArray(d.users) ? d.users : (d.users as { users: User[] }).users ?? [];
        if (!cancelled) setUsers(list);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSetRole(userId: string, role: string) {
    try {
      await authClient.admin.setRole({ userId, role });
      load();
    } catch {
      alert("Erreur lors du changement de rôle");
    }
  }

  async function handleBan(userId: string, name: string) {
    if (!confirm(`Bannir l'utilisateur "${name}" ?`)) return;
    try {
      await authClient.admin.banUser({ userId });
      load();
    } catch {
      alert("Erreur lors du bannissement");
    }
  }

  async function handleUnban(userId: string) {
    try {
      await authClient.admin.unbanUser({ userId });
      load();
    } catch {
      alert("Erreur lors du débannissement");
    }
  }

  return (
    <AuthGuard requireAdmin>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Tous les utilisateurs
        </h1>

        {loading ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Nom</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Email</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Rôle</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Statut</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Créé le</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{u.name}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role ?? "user"}
                        onChange={(e) => handleSetRole(u.id, e.target.value)}
                        className="rounded border border-zinc-300 px-2 py-0.5 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                      >
                        <option value="user">user</option>
                        <option value="admin">admin</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      {u.banned ? (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
                          Banni
                        </span>
                      ) : (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900 dark:text-green-300">
                          Actif
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(u.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      {u.banned ? (
                        <button
                          onClick={() => handleUnban(u.id)}
                          className="rounded bg-green-100 px-2 py-1 text-xs text-green-700 hover:bg-green-200 dark:bg-green-900 dark:text-green-300"
                        >
                          Débannir
                        </button>
                      ) : (
                        <button
                          onClick={() => handleBan(u.id, u.name)}
                          className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300"
                        >
                          Bannir
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
