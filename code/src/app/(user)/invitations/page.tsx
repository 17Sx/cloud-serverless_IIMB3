"use client";

import { useState, useEffect, useCallback } from "react";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";

interface Invitation {
  id: string;
  team?: { name: string };
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInvitations = useCallback(async () => {
    try {
      const data = await api.get<{ invitations: Invitation[] }>("/api/invitations");
      setInvitations(data.invitations);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchInvitations();
  }, [fetchInvitations]);

  const accept = async (id: string) => {
    await api.post(`/api/invitations/${id}/accept`);
    fetchInvitations();
  };

  const decline = async (id: string) => {
    await api.post(`/api/invitations/${id}/decline`);
    fetchInvitations();
  };

  return (
    <AuthGuard>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          Invitations
        </h1>

        {loading ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : invitations.length === 0 ? (
          <p className="text-sm text-zinc-500">Aucune invitation en attente.</p>
        ) : (
          <div className="space-y-3">
            {invitations.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
              >
                <div>
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {inv.team?.name ?? "Équipe"}
                  </p>
                  <p className="text-sm text-zinc-500">Invitation reçue</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => accept(inv.id)}
                    className="rounded-md bg-green-600 px-3 py-1.5 text-sm text-white hover:bg-green-700"
                  >
                    Accepter
                  </button>
                  <button
                    onClick={() => decline(inv.id)}
                    className="rounded-md bg-zinc-200 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    Refuser
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
