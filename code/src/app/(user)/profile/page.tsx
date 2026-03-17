"use client";

import { useState, useRef, useEffect } from "react";
import { api } from "@/lib/api";
import { AuthGuard } from "@/components/AuthGuard";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  image?: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [image, setImage] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const didLoad = useRef(false);

  async function loadProfile() {
    try {
      const data = await api.get<{ user: UserProfile }>("/api/users/me");
      setUser(data.user);
      setName(data.user.name);
      setImage(data.user.image ?? "");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors du chargement du profil");
    }
  }

  useEffect(() => {
    if (didLoad.current) return;
    didLoad.current = true;
    loadProfile();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage("");
    setError("");
    try {
      await api.patch("/api/users/me", {
        name: name.trim(),
        image: image.trim() || undefined,
      });
      setMessage("Profil mis à jour !");
      setEditing(false);
      loadProfile();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erreur lors de la mise à jour");
    }
  };

  const handleCancel = () => {
    if (user) {
      setName(user.name);
      setImage(user.image ?? "");
    }
    setEditing(false);
    setMessage("");
    setError("");
  };

  return (
    <AuthGuard>
      <div className="space-y-8">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">Mon profil</h1>

        {error && (
          <div className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {message && (
          <div className="rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
            {message}
          </div>
        )}

        {!user ? (
          <p className="text-sm text-zinc-500">Chargement...</p>
        ) : !editing ? (
          <div className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
            <div className="space-y-4">
              {user.image && (
                <div>
                  <img
                    src={user.image}
                    alt="Photo de profil"
                    className="h-20 w-20 rounded-full object-cover"
                  />
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Nom</p>
                <p className="text-zinc-900 dark:text-zinc-100">{user.name}</p>
              </div>
              <div>
                <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">Email</p>
                <p className="text-zinc-900 dark:text-zinc-100">{user.email}</p>
              </div>
              <button
                onClick={() => setEditing(true)}
                className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900"
              >
                Modifier
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={handleSave}
            className="space-y-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
          >
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Nom
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Email
              </label>
              <input
                type="email"
                value={user.email}
                disabled
                className="block w-full rounded-md border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400"
              />
              <p className="mt-1 text-xs text-zinc-400">L&apos;email ne peut pas être modifié.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-semibold text-zinc-700 dark:text-zinc-300">
                Image (URL)
              </label>
              <input
                type="url"
                value={image}
                onChange={(e) => setImage(e.target.value)}
                placeholder="https://exemple.com/photo.jpg"
                className="block w-full rounded-md border border-zinc-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
              />
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
              >
                Enregistrer
              </button>
              <button
                type="button"
                onClick={handleCancel}
                className="rounded-md bg-zinc-100 px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Annuler
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthGuard>
  );
}
