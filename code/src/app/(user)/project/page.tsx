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
  const didLoad = useRef(false);

  async function load() {
    if (!projectId) return;
    const [p, t] = await Promise.all([
      api.get<{ project: ProjectData }>(`/api/projects/${projectId}`),
      api.get<{ tasks: Task[] }>(`/api/tasks?projectId=${projectId}`),
    ]);
    setProject(p.project);
    setTasks(t.tasks);
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
                      className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">
                          {task.name}
                        </p>
                        {task.description && (
                          <p className="mt-0.5 text-sm text-zinc-500">{task.description}</p>
                        )}
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
                        <button
                          onClick={() => deleteTask(task.id)}
                          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Supprimer
                        </button>
                      </div>
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
