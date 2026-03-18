"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";
import Link from "next/link";

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

interface ProjectData {
  id: string;
  teamId: string;
  name: string;
  description?: string;
}

interface Task {
  id: string;
  name: string;
  description?: string;
  status: string;
  assigneeId?: string;
}

interface TeamMember {
  userId: string;
  role: string;
  name?: string;
  email?: string;
  user?: { id: string; name: string; email: string };
}

interface TeamData {
  id: string;
  name: string;
  members?: TeamMember[];
}

interface Asset {
  id: string;
  filename: string;
  downloadUrl?: string;
  taskId: string;
  createdAt?: string;
}

export default function ProjectPageWrapper() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Chargement...</p>}>
      <ProjectPageContent />
    </Suspense>
  );
}

function ProjectPageContent() {
  const searchParams = useSearchParams();
  const projectId = searchParams.get("id");
  const [project, setProject] = useState<ProjectData | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskName, setTaskName] = useState("");
  const [taskDesc, setTaskDesc] = useState("");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editTaskName, setEditTaskName] = useState("");
  const [editTaskDesc, setEditTaskDesc] = useState("");
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
  const [taskAssets, setTaskAssets] = useState<Record<string, Asset[]>>({});
  const [uploading, setUploading] = useState<string | null>(null);
  const didLoad = useRef(false);

  async function load() {
    if (!projectId) return;
    const [p, t] = await Promise.all([
      api.get<{ project: ProjectData }>(`/api/projects/${projectId}`),
      api.get<{ tasks: Task[] }>(`/api/tasks?projectId=${projectId}`),
    ]);
    setProject(p.project);
    setTasks(t.tasks);

    // Load team members for assignation
    if (p.project.teamId) {
      try {
        const teamData = await api.get<{ team: TeamData }>(`/api/teams/${p.project.teamId}`);
        setMembers(teamData.team.members ?? []);
      } catch {
        // ignore if team members can't be loaded
      }
    }
  }

  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskName.trim()) return;
    await api.post("/api/tasks", {
      projectId,
      name: taskName,
      description: taskDesc || undefined,
    });
    setTaskName("");
    setTaskDesc("");
    load();
  };

  const updateStatus = async (taskId: string, status: string) => {
    await api.patch(`/api/tasks/${taskId}/status`, { status });
    load();
  };

  const deleteTask = async (taskId: string) => {
    await api.delete(`/api/tasks/${taskId}`);
    load();
  };

  // --- Task editing ---
  const startEditTask = (task: Task) => {
    setEditingTaskId(task.id);
    setEditTaskName(task.name);
    setEditTaskDesc(task.description ?? "");
  };

  const cancelEditTask = () => {
    setEditingTaskId(null);
    setEditTaskName("");
    setEditTaskDesc("");
  };

  const saveEditTask = async (taskId: string) => {
    if (!editTaskName.trim()) return;
    await api.patch(`/api/tasks/${taskId}`, {
      name: editTaskName.trim(),
      description: editTaskDesc.trim() || undefined,
    });
    setEditingTaskId(null);
    load();
  };

  // --- Assignation ---
  const assignTask = async (taskId: string, assigneeId: string) => {
    await api.patch(`/api/tasks/${taskId}/assign`, {
      assigneeId: assigneeId || null,
    });
    load();
  };

  const getMemberName = (userId?: string) => {
    if (!userId) return "Non assigné";
    const member = members.find((m) => m.userId === userId);
    if (!member) return userId;
    return member.user?.name ?? member.name ?? member.user?.email ?? member.email ?? userId;
  };

  // --- Assets ---
  const loadAssets = async (taskId: string) => {
    try {
      const data = await api.get<{ assets: Asset[] }>(`/api/assets?taskId=${taskId}`);
      setTaskAssets((prev) => ({ ...prev, [taskId]: data.assets }));
    } catch {
      setTaskAssets((prev) => ({ ...prev, [taskId]: [] }));
    }
  };

  const toggleExpand = (taskId: string) => {
    if (expandedTaskId === taskId) {
      setExpandedTaskId(null);
    } else {
      setExpandedTaskId(taskId);
      loadAssets(taskId);
    }
  };

  const handleFileUpload = async (taskId: string, file: File) => {
    setUploading(taskId);
    try {
      // Step 1: Get presigned URL
      const { uploadUrl } = await api.post<{ uploadUrl: string; asset: Asset }>(
        "/api/assets/upload-url",
        { taskId, filename: file.name }
      );
      // Step 2: Upload file to S3
      await fetch(uploadUrl, {
        method: "PUT",
        body: file,
      });
      // Step 3: Reload assets
      await loadAssets(taskId);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Erreur lors de l'upload");
    } finally {
      setUploading(null);
    }
  };

  const deleteAsset = async (assetId: string, taskId: string) => {
    if (!confirm("Supprimer ce fichier ?")) return;
    await api.delete(`/api/assets/${assetId}`);
    loadAssets(taskId);
  };

  if (!projectId) {
    return (
      <AuthGuard>
        <p className="text-sm text-zinc-500">ID de projet manquant.</p>
      </AuthGuard>
    );
  }

  if (!project) {
    return (
      <AuthGuard>
        <p className="text-sm text-zinc-500">Chargement...</p>
      </AuthGuard>
    );
  }

  return (
    <AuthGuard>
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href={`/team?id=${project.teamId}`}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            &larr; Équipe
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{project.name}</h1>
            {project.description && (
              <p className="mt-1 text-zinc-500">{project.description}</p>
            )}
          </div>
        </div>

        <form
          onSubmit={createTask}
          className="space-y-3 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
        >
          <h2 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Nouvelle tâche
          </h2>
          <input
            type="text"
            placeholder="Nom de la tâche"
            value={taskName}
            onChange={(e) => setTaskName(e.target.value)}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <input
            type="text"
            placeholder="Description (optionnel)"
            value={taskDesc}
            onChange={(e) => setTaskDesc(e.target.value)}
            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Créer la tâche
          </button>
        </form>

        {["todo", "in_progress", "done"].map((status) => {
          const filtered = tasks.filter((t) => t.status === status);
          return (
            <div key={status}>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {STATUS_LABELS[status]} ({filtered.length})
              </h2>
              {filtered.length === 0 ? (
                <p className="text-sm text-zinc-400">Aucune tâche.</p>
              ) : (
                <div className="space-y-2">
                  {filtered.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      {editingTaskId === task.id ? (
                        /* --- Mode édition --- */
                        <div className="space-y-3">
                          <input
                            type="text"
                            value={editTaskName}
                            onChange={(e) => setEditTaskName(e.target.value)}
                            placeholder="Nom de la tâche"
                            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                          <input
                            type="text"
                            value={editTaskDesc}
                            onChange={(e) => setEditTaskDesc(e.target.value)}
                            placeholder="Description (optionnel)"
                            className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveEditTask(task.id)}
                              className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                            >
                              Enregistrer
                            </button>
                            <button
                              onClick={cancelEditTask}
                              className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      ) : (
                        /* --- Mode affichage --- */
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                                {task.name}
                              </p>
                              {task.description && (
                                <p className="mt-0.5 text-sm text-zinc-500">{task.description}</p>
                              )}
                              <p className="mt-1 text-xs text-zinc-400">
                                Assigné : {getMemberName(task.assigneeId)}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[task.status]}`}
                              >
                                {STATUS_LABELS[task.status]}
                              </span>
                              <select
                                value={task.status}
                                onChange={(e) => updateStatus(task.id, e.target.value)}
                                className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                              >
                                <option value="todo">À faire</option>
                                <option value="in_progress">En cours</option>
                                <option value="done">Terminé</option>
                              </select>
                              <select
                                value={task.assigneeId ?? ""}
                                onChange={(e) => assignTask(task.id, e.target.value)}
                                className="rounded border border-zinc-300 px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                              >
                                <option value="">Non assigné</option>
                                {members.map((m) => (
                                  <option key={m.userId} value={m.userId}>
                                    {m.user?.name ?? m.name ?? m.user?.email ?? m.email ?? m.userId}
                                  </option>
                                ))}
                              </select>
                              <button
                                onClick={() => startEditTask(task)}
                                className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                              >
                                Modifier
                              </button>
                              <button
                                onClick={() => toggleExpand(task.id)}
                                className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                              >
                                Fichiers
                              </button>
                              <button
                                onClick={() => deleteTask(task.id)}
                                className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              >
                                Supprimer
                              </button>
                            </div>
                          </div>

                          {/* --- Section Assets --- */}
                          {expandedTaskId === task.id && (
                            <div className="mt-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
                              <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                                  Fichiers
                                </h3>
                                <label className="cursor-pointer rounded-md bg-blue-600 px-3 py-1.5 text-xs text-white hover:bg-blue-700">
                                  {uploading === task.id ? "Upload..." : "Ajouter un fichier"}
                                  <input
                                    type="file"
                                    className="hidden"
                                    disabled={uploading === task.id}
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleFileUpload(task.id, file);
                                      e.target.value = "";
                                    }}
                                  />
                                </label>
                              </div>
                              {(!taskAssets[task.id] || taskAssets[task.id].length === 0) ? (
                                <p className="text-xs text-zinc-400">Aucun fichier.</p>
                              ) : (
                                <ul className="space-y-2">
                                  {taskAssets[task.id].map((asset) => (
                                    <li
                                      key={asset.id}
                                      className="flex items-center justify-between rounded border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-700"
                                    >
                                      <div className="flex-1 min-w-0">
                                        {asset.downloadUrl ? (
                                          <a
                                            href={asset.downloadUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-blue-600 hover:text-blue-800 truncate block"
                                          >
                                            {asset.filename}
                                          </a>
                                        ) : (
                                          <span className="text-zinc-900 dark:text-zinc-100 truncate block">
                                            {asset.filename}
                                          </span>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => deleteAsset(asset.id, task.id)}
                                        className="ml-2 rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                                      >
                                        Supprimer
                                      </button>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </AuthGuard>
  );
}
