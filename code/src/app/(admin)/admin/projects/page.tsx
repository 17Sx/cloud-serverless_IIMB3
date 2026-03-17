"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";

interface Team {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  description?: string;
  teamId: string;
  createdAt: string;
  team?: Team;
  tasks?: { id: string }[];
}

export default function AdminProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTeam, setFilterTeam] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  async function loadTeams() {
    try {
      const d = await api.get<{ teams: Team[] }>("/api/admin/teams");
      setTeams(d.teams);
    } catch {}
  }

  async function loadProjects() {
    try {
      const url = filterTeam
        ? `/api/admin/projects?teamId=${filterTeam}`
        : "/api/admin/projects";
      const d = await api.get<{ projects: Project[] }>(url);
      setProjects(d.projects);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadTeams(); }, []);
  useEffect(() => { loadProjects(); }, [filterTeam]);

  async function handleSave(id: string) {
    if (!editName.trim()) return;
    await api.patch(`/api/admin/projects/${id}`, {
      name: editName,
      description: editDesc || undefined,
    });
    setEditing(null);
    loadProjects();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer le projet "${name}" et toutes ses tâches ?`)) return;
    await api.delete(`/api/admin/projects/${id}`);
    loadProjects();
  }

  return (
    <AuthGuard requireAdmin>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Tous les projets
          </h1>
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Toutes les équipes</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Nom</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Description</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Équipe</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Tâches</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Créé le</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map((p) => (
                  <tr key={p.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">
                      {editing === p.id ? (
                        <input
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && handleSave(p.id)}
                          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                          autoFocus
                        />
                      ) : (
                        p.name
                      )}
                    </td>
                    <td className="max-w-[200px] truncate px-4 py-3 text-zinc-500">
                      {editing === p.id ? (
                        <input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      ) : (
                        p.description ?? "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{p.team?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-zinc-500">{p.tasks?.length ?? 0}</td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(p.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {editing === p.id ? (
                          <>
                            <button
                              onClick={() => handleSave(p.id)}
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
                              onClick={() => {
                                setEditing(p.id);
                                setEditName(p.name);
                                setEditDesc(p.description ?? "");
                              }}
                              className="rounded bg-zinc-200 px-2 py-1 text-xs text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-700 dark:text-zinc-300"
                            >
                              Modifier
                            </button>
                            <button
                              onClick={() => handleDelete(p.id, p.name)}
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
                {projects.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                      Aucun projet
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
