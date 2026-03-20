"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

const USER_SITE = (process.env.NEXT_PUBLIC_USER_SITE_URL ?? "").replace(/\/$/, "");
/** Hostname de la CF « admin » (ex. d1111abcd.cloudfront.net). Optionnel : précise qu’on est sur le bucket admin. */
const ADMIN_SITE_HOSTNAME = (process.env.NEXT_PUBLIC_ADMIN_SITE_HOSTNAME ?? "").trim().toLowerCase();

/**
 * Rediriger vers le site user pour le login uniquement depuis le déploiement admin
 * (autre origine, pas de /login utilisable).
 *
 * Sur la CF user dev, même si NEXT_PUBLIC_USER_SITE_URL est mal rempli (ex. URL prod),
 * il ne faut pas envoyer vers un autre domaine : ça provoque une boucle (session sur une autre origine).
 */
function shouldSendToUserSiteLogin(): boolean {
  if (!USER_SITE || typeof window === "undefined") return false;

  try {
    const userOrigin = new URL(USER_SITE).origin;
    if (window.location.origin === userOrigin) return false;
  } catch {
    return false;
  }

  const host = window.location.hostname.toLowerCase();
  if (ADMIN_SITE_HOSTNAME && host === ADMIN_SITE_HOSTNAME) return true;

  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const onAdminPath = path === "/admin" || path.startsWith("/admin/");
  return onAdminPath;
}

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
      if (shouldSendToUserSiteLogin()) {
        const returnTo = encodeURIComponent(window.location.href);
        window.location.href = `${USER_SITE}/login?callbackUrl=${returnTo}`;
        return;
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
