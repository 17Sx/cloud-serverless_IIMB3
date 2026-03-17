"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";

interface User {
  id: string;
  name: string;
  email: string;
  role?: string;
  createdAt: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ users: User[] | { users: User[] } }>("/api/admin/users")
      .then((d) => {
        const list = Array.isArray(d.users) ? d.users : (d.users as { users: User[] }).users ?? [];
        setUsers(list);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

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
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Créé le</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{u.name}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-400">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          u.role === "admin"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {u.role ?? "user"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(u.createdAt).toLocaleDateString("fr-FR")}
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
