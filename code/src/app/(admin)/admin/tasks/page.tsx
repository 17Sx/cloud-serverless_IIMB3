"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";

const STATUS_LABELS: Record<string, string> = {
  todo: "À faire",
  in_progress: "En cours",
  done: "Terminé",
};

const STATUS_COLORS: Record<string, string> = {
  todo: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  in_progress: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  done: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
};

interface Project {
  id: string;
  name: string;
}

interface Task {
  id: string;
  name: string;
  description?: string;
  status: string;
  assigneeId?: string;
  projectId: string;
  createdAt: string;
  project?: Project;
}

export default function AdminTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterProject, setFilterProject] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("todo");

  async function loadProjects() {
    try {
      const d = await api.get<{ projects: { id: string; name: string }[] }>("/api/admin/projects");
      setProjects(d.projects);
    } catch {}
  }

  async function loadTasks() {
    try {
      const url = filterProject
        ? `/api/admin/tasks?projectId=${filterProject}`
        : "/api/admin/tasks";
      const d = await api.get<{ tasks: Task[] }>(url);
      setTasks(d.tasks);
    } catch {}
    setLoading(false);
  }

  useEffect(() => { loadProjects(); }, []);
  useEffect(() => { loadTasks(); }, [filterProject]);

  async function handleSave(id: string) {
    if (!editName.trim()) return;
    await api.patch(`/api/admin/tasks/${id}`, {
      name: editName,
      description: editDesc || undefined,
      status: editStatus,
    });
    setEditing(null);
    loadTasks();
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer la tâche "${name}" ?`)) return;
    await api.delete(`/api/admin/tasks/${id}`);
    loadTasks();
  }

  return (
    <AuthGuard requireAdmin>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Toutes les tâches
          </h1>
          <select
            value={filterProject}
            onChange={(e) => setFilterProject(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Tous les projets</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
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
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Projet</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Statut</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Créé le</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => (
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
                    <td className="max-w-[200px] truncate px-4 py-3 text-zinc-500">
                      {editing === t.id ? (
                        <input
                          value={editDesc}
                          onChange={(e) => setEditDesc(e.target.value)}
                          className="rounded border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                      ) : (
                        t.description ?? "—"
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500">{t.project?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      {editing === t.id ? (
                        <select
                          value={editStatus}
                          onChange={(e) => setEditStatus(e.target.value)}
                          className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
                        >
                          <option value="todo">À faire</option>
                          <option value="in_progress">En cours</option>
                          <option value="done">Terminé</option>
                        </select>
                      ) : (
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[t.status] ?? ""}`}>
                          {STATUS_LABELS[t.status] ?? t.status}
                        </span>
                      )}
                    </td>
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
                              onClick={() => {
                                setEditing(t.id);
                                setEditName(t.name);
                                setEditDesc(t.description ?? "");
                                setEditStatus(t.status);
                              }}
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
                {tasks.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-zinc-500">
                      Aucune tâche
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
