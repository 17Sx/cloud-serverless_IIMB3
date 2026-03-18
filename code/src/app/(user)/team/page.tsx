"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";
import Link from "next/link";

interface TeamData {
  id: string;
  name: string;
  members?: { userId: string; role: string }[];
}

interface Project {
  id: string;
  name: string;
  description?: string;
}

export default function TeamDetailPageWrapper() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Chargement...</p>}>
      <TeamDetailPage />
    </Suspense>
  );
}

function TeamDetailPage() {
  const searchParams = useSearchParams();
  const teamId = searchParams.get("id");
  const [team, setTeam] = useState<TeamData | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [projectName, setProjectName] = useState("");
  const [message, setMessage] = useState("");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectName, setEditProjectName] = useState("");
  const [editProjectDesc, setEditProjectDesc] = useState("");
  const didLoad = useRef(false);

  async function loadData() {
    if (!teamId) return;
    const [t, p] = await Promise.all([
      api.get<{ team: TeamData }>(`/api/teams/${teamId}`),
      api.get<{ projects: Project[] }>(`/api/projects?teamId=${teamId}`),
    ]);
    setTeam(t.team);
    setProjects(p.projects);
  }

  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId]);

  const invite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post(`/api/teams/${teamId}/invite`, { email: inviteEmail });
      setInviteEmail("");
      setMessage("Invitation envoyée !");
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Erreur");
    }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectName.trim()) return;
    await api.post("/api/projects", { teamId, name: projectName });
    setProjectName("");
    loadData();
  };

  const startEditProject = (project: Project) => {
    setEditingProjectId(project.id);
    setEditProjectName(project.name);
    setEditProjectDesc(project.description ?? "");
  };

  const cancelEditProject = () => {
    setEditingProjectId(null);
    setEditProjectName("");
    setEditProjectDesc("");
  };

  const saveEditProject = async (projectId: string) => {
    if (!editProjectName.trim()) return;
    try {
      await api.patch(`/api/projects/${projectId}`, {
        name: editProjectName.trim(),
        description: editProjectDesc.trim() || undefined,
      });
      setEditingProjectId(null);
      loadData();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Erreur lors de la modification");
    }
  };

  const deleteProject = async (projectId: string) => {
    if (!confirm("Voulez-vous vraiment supprimer ce projet ?")) return;
    try {
      await api.delete(`/api/projects/${projectId}`);
      loadData();
    } catch (err: unknown) {
      setMessage(err instanceof Error ? err.message : "Erreur lors de la suppression");
    }
  };

  if (!teamId) {
    return (
      <AuthGuard>
        <p className="text-sm text-zinc-500">ID d&apos;équipe manquant.</p>
      </AuthGuard>
    );
  }

  if (!team) {
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
          <Link href="/teams" className="text-sm text-blue-600 hover:text-blue-800">
            &larr; Équipes
          </Link>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{team.name}</h1>
          <span className="text-sm text-zinc-500">{team.members?.length ?? 0} membre(s)</span>
        </div>

        <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
          <h2 className="mb-3 text-sm font-semibold text-zinc-700 dark:text-zinc-300">
            Inviter un membre
          </h2>
          <form onSubmit={invite} className="flex gap-3">
            <input
              type="email"
              placeholder="email@exemple.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button type="submit" className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700">
              Inviter
            </button>
          </form>
          {message && <p className="mt-2 text-sm text-zinc-500">{message}</p>}
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-100">Projets</h2>
          <form onSubmit={createProject} className="mb-4 flex gap-3">
            <input
              type="text"
              placeholder="Nom du projet"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
            />
            <button type="submit" className="rounded-md bg-zinc-900 px-4 py-2 text-sm text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900">
              Ajouter
            </button>
          </form>

          {projects.length === 0 ? (
            <p className="text-sm text-zinc-500">Aucun projet.</p>
          ) : (
            <div className="grid gap-3">
              {projects.map((p) => (
                <div
                  key={p.id}
                  className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
                >
                  {editingProjectId === p.id ? (
                    <div className="space-y-3">
                      <input
                        type="text"
                        value={editProjectName}
                        onChange={(e) => setEditProjectName(e.target.value)}
                        placeholder="Nom du projet"
                        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                      <input
                        type="text"
                        value={editProjectDesc}
                        onChange={(e) => setEditProjectDesc(e.target.value)}
                        placeholder="Description (optionnel)"
                        className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveEditProject(p.id)}
                          className="rounded-md bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700"
                        >
                          Enregistrer
                        </button>
                        <button
                          onClick={cancelEditProject}
                          className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                        >
                          Annuler
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/project?id=${p.id}`}
                        className="flex-1 transition hover:opacity-80"
                      >
                        <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{p.name}</h3>
                        {p.description && (
                          <p className="mt-1 text-sm text-zinc-500">{p.description}</p>
                        )}
                      </Link>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => startEditProject(p)}
                          className="rounded px-2 py-1 text-xs text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                        >
                          Modifier
                        </button>
                        <button
                          onClick={() => deleteProject(p.id)}
                          className="rounded px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                        >
                          Supprimer
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AuthGuard>
  );
}
