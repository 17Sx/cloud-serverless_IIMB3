"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function AuthGuard({
  children,
  requireAdmin = false,
}: {
  children: React.ReactNode;
  requireAdmin?: boolean;
}) {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (isPending) return;
    if (!session) {
      router.replace("/login");
      return;
    }
    if (
      requireAdmin &&
      (session.user as unknown as { role: string }).role !== "admin"
    ) {
      router.replace("/");
    }
  }, [session, isPending, requireAdmin, router]);

  if (isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900" />
      </div>
    );
  }

  if (!session) return null;
  if (
    requireAdmin &&
    (session.user as unknown as { role: string }).role !== "admin"
  )
    return null;

  return <>{children}</>;
}
