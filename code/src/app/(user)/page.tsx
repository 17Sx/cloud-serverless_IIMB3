"use client";

import { useSession } from "@/lib/auth-client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function HomePage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  // Ne pas dépendre de `session` (référence instable → replace en boucle avec le header / navigation).
  const userId = session?.user?.id;

  useEffect(() => {
    if (isPending) return;
    if (!userId) {
      router.replace("/login");
    } else {
      router.replace("/teams");
    }
  }, [isPending, userId, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-zinc-300 border-t-zinc-900" />
    </div>
  );
}
