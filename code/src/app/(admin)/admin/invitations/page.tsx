"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  accepted: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  declined: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

interface Invitation {
  id: string;
  email: string;
  status: string;
  invitedBy: string;
  createdAt: string;
  team?: { id: string; name: string };
}

export default function AdminInvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");

  async function load() {
    try {
      const url = filterStatus
        ? `/api/admin/invitations?status=${filterStatus}`
        : "/api/admin/invitations";
      const d = await api.get<{ invitations: Invitation[] }>(url);
      setInvitations(d.invitations);
    } catch {}
    setLoading(false);
  }

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const url = filterStatus
          ? `/api/admin/invitations?status=${filterStatus}`
          : "/api/admin/invitations";
        const d = await api.get<{ invitations: Invitation[] }>(url);
        if (!cancelled) setInvitations(d.invitations);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [filterStatus]);

  async function handleDelete(id: string, email: string) {
    if (!confirm(`Supprimer l'invitation pour "${email}" ?`)) return;
    await api.delete(`/api/admin/invitations/${id}`);
    load();
  }

  return (
    <AuthGuard requireAdmin>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
            Toutes les invitations
          </h1>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="">Tous les statuts</option>
            <option value="pending">En attente</option>
            <option value="accepted">Acceptée</option>
            <option value="declined">Refusée</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900">
                <tr>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Email</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Équipe</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Statut</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Créé le</th>
                  <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invitations.map((inv) => (
                  <tr key={inv.id} className="border-b border-zinc-100 dark:border-zinc-800">
                    <td className="px-4 py-3 text-zinc-900 dark:text-zinc-100">{inv.email}</td>
                    <td className="px-4 py-3 text-zinc-500">{inv.team?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[inv.status] ?? ""}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-zinc-500">
                      {new Date(inv.createdAt).toLocaleDateString("fr-FR")}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleDelete(inv.id, inv.email)}
                        className="rounded bg-red-100 px-2 py-1 text-xs text-red-700 hover:bg-red-200 dark:bg-red-900 dark:text-red-300"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))}
                {invitations.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-500">
                      Aucune invitation
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
