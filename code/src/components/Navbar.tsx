"use client";

import Link from "next/link";
import { useSession, signOut } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { headerLogoCdnUrl } from "@/lib/public-asset-url";

export function Navbar() {
  const { data: session } = useSession();
  const router = useRouter();
  const logoCdnUrl = headerLogoCdnUrl("test.png");

  const handleSignOut = async () => {
    await signOut({
      fetchOptions: {
        onSuccess: () => router.push("/login"),
      },
    });
  };

  return (
    <header className="border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
      <nav className="mx-auto flex max-w-5xl items-center justify-between">
        <div className="flex items-center gap-6">
          <Link
            href="/teams"
            className="flex items-center gap-2 text-lg font-semibold text-zinc-900 dark:text-zinc-100"
          >
            {logoCdnUrl ? (
              <img
                src={logoCdnUrl}
                alt=""
                width={32}
                height={32}
                className="h-8 w-8 rounded-md object-cover ring-1 ring-zinc-200 dark:ring-zinc-700"
              />
            ) : (
              <span
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-zinc-200 text-xs font-bold text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                aria-hidden
              >
                T
              </span>
            )}
            TaskFlow
          </Link>
          {session && (
            <>
              <Link href="/teams" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                Équipes
              </Link>
              <Link href="/invitations" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                Invitations
              </Link>
              <Link href="/profile" className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100">
                Profil
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          {session ? (
            <>
              <span className="text-sm text-zinc-500">{session.user.name}</span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                {process.env.NEXT_PUBLIC_ENV ?? "dev"}
              </span>
              <button
                onClick={handleSignOut}
                className="rounded-md bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Déconnexion
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sm text-blue-600 hover:text-blue-800">
              Connexion
            </Link>
          )}
        </div>
      </nav>
    </header>
  );
}
