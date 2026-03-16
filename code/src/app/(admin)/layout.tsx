export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-zinc-900 px-6 py-4 dark:border-zinc-700">
        <nav className="mx-auto flex max-w-5xl items-center justify-between">
          <span className="text-lg font-semibold text-white">Front Admin</span>
          <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-800">
            {process.env.NEXT_PUBLIC_ENV ?? "unknown"}
          </span>
        </nav>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
    </div>
  );
}
