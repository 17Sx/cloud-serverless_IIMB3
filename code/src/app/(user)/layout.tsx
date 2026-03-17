import { Navbar } from "@/components/Navbar";

export default function UserLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">
      <Navbar />
      <main className="mx-auto max-w-5xl px-6 py-8">{children}</main>
    </div>
  );
}
