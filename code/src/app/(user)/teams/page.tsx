"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";
import Link from "next/link";

interface Team {
  id: string;
  name: string;
  role: string;
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);

  const fetchTeams = useCallback(async () => {
    try {
      const data = await api.get<{ teams: Team[] }>("/api/teams");
      setTeams(data.teams);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTeams();
  }, [fetchTeams]);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api.post("/api/teams", { name });
    setName("");
    fetchTeams();
  };

  return (
    <AuthGuard>
      <div className="space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Mes équipes</h1>
        </div>

        <form onSubmit={createTeam} className="flex gap-3">
          <input
            type="text"
            placeholder="Nom de l'équipe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1 rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          />
          <button
            type="submit"
            className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Créer
          </button>
        </form>

        {loading ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : teams.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucune équipe. Créez-en une !</p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {teams.map((team) => (
              <Link
                key={team.id}
                href={`/team?id=${team.id}`}
                className="rounded-lg border border-zinc-200 p-5 transition hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
              >
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {team.name}
                </h2>
                <p className="mt-1 text-xs text-zinc-500">Rôle : {team.role}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
