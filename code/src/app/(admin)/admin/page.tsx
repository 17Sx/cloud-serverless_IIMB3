export default function AdminHome() {
  return (
    <div className="flex flex-col items-center gap-8 py-20 text-center">
      <h1 className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
        Front Admin
      </h1>
      <p className="max-w-md text-lg text-zinc-600 dark:text-zinc-400">
        Bienvenue sur l&apos;interface administrateur.
      </p>
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-6 py-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Environnement :{" "}
          <code className="font-mono font-semibold text-zinc-900 dark:text-zinc-100">
            {process.env.NEXT_PUBLIC_ENV ?? "non défini"}
          </code>
        </p>
      </div>
    </div>
  );
}
