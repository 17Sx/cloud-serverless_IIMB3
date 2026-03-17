import Link from "next/link";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-700 bg-zinc-900 px-6 py-3">
        <nav className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-6">
            <Link href="/admin" className="text-lg font-semibold text-white">
              Admin
            </Link>
            <Link href="/admin/users" className="text-sm text-zinc-400 hover:text-white">
              Utilisateurs
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800">
              {process.env.NEXT_PUBLIC_ENV ?? "dev"}
            </span>
            <Link href="/" className="text-sm text-zinc-400 hover:text-white">
              Retour au site
            </Link>
          </div>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
