"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";

interface Stats {
  users: number;
  teams: number;
  projects: number;
  tasks: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api.get<{ stats: Stats }>("/api/admin/stats").then((d) => setStats(d.stats)).catch(() => {});
  }, []);

  return (
    <AuthGuard requireAdmin>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Dashboard Admin
        </h1>

        {!stats ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Utilisateurs", value: stats.users },
              { label: "Équipes", value: stats.teams },
              { label: "Projets", value: stats.projects },
              { label: "Tâches", value: stats.tasks },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-zinc-200 bg-white p-5 text-center dark:border-zinc-800 dark:bg-zinc-900"
              >
                <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-100">
                  {item.value}
                </p>
                <p className="mt-1 text-sm text-zinc-500">{item.label}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
