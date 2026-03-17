"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const USER_SITE = (process.env.NEXT_PUBLIC_USER_SITE_URL ?? "").replace(/\/$/, "");

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
      // Sur le domaine admin, /login n'existe pas → boucle. Rediriger vers le site user.
      if (USER_SITE && typeof window !== "undefined") {
        try {
          const userOrigin = new URL(USER_SITE).origin;
          if (window.location.origin !== userOrigin) {
            const returnTo = encodeURIComponent(window.location.href);
            window.location.href = `${USER_SITE}/login?callbackUrl=${returnTo}`;
            return;
          }
        } catch {
          /* USER_SITE invalide, fallback sur router */
        }
      }
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
