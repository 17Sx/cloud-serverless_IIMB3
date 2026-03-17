"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";

interface Team {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  members?: { id: string }[];
  projects?: { id: string }[];
}

export default function AdminTeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    try {
      const d = await api.get<{ teams: Team[] }>("/api/admin/teams");
      setTeams(d.teams);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleSave(id: string) {
    if (!editName.trim()) return;
    await api.patch(`/api/admin/teams/${id}`, { name: editName });
    setEditing(null);
    load();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer l'équipe "${name}" et tout son contenu ?`)) return;
    await api.delete(`/api/admin/teams/${id}`);
    load();
  }

  return (
    <AuthGuard requireAdmin>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Toutes les équipes
        </h1>

        {loading ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Nom</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Membres</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Projets</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Créé le</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                      {editing === t.id ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSave(t.id)}
                          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          autoFocus
                        />
                      ) : (
                        t.name
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{t.members?.length ?? 0}</td>
                    <td className="px-4 py-3 text-zinc-500">{t.projects?.length ?? 0}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(t.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {editing === t.id ? (
                          <>
                            <button
                              onClick={() => handleSave(t.id)}
                              className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700"
                            >
                              OK
                            </button>
                            <button
                              onClick={() => setEditing(null)}
                              className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
                            >
                              Annuler
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => { setEditing(t.id); setEditName(t.name); }}
                              className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDelete(t.id, t.name)}
                              className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300"
                            >
                              Supprimer
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {teams.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                      Aucune équipe
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
