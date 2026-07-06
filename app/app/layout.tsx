import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { MapPin } from "lucide-react";

import { createClient } from "@/lib/supabase/server";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { AppNav } from "@/components/app-nav";
import { bypassAuth } from "@/lib/utils";

// The shell (nav/footer) is static; per-request auth is read inside the
// Suspense-wrapped AuthGuard so it doesn't block the whole route tree from
// streaming (required by Cache Components).
export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col items-center">
        <nav className="w-full flex justify-center border-b-3 border-border min-h-16 bg-card">
          <div className="w-full max-w-5xl flex flex-wrap items-center justify-between gap-y-2 p-3 px-4 text-sm sm:px-5">
            <div className="flex items-center gap-3 sm:gap-6">
              <Link
                href="/app/timeline"
                className="flex items-center gap-2 font-display font-semibold text-base"
              >
                <MapPin className="size-4 text-accent" /> Soundmark
              </Link>
              <Suspense>
                <AppNav />
              </Suspense>
            </div>
            <Suspense>
              <AuthButton />
            </Suspense>
          </div>
        </nav>

        <div className="flex-1 w-full flex flex-col max-w-5xl p-4 sm:p-5">
          <Suspense>
            <AuthGuard />
          </Suspense>
          {children}
        </div>

        <footer className="w-full flex flex-wrap items-center justify-center gap-4 border-t px-4 py-8 text-center text-xs sm:gap-8">
          <span className="text-muted-foreground">
            Soundmark — your geotagged media archive
          </span>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}

async function AuthGuard() {
  if (bypassAuth) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) {
    redirect("/auth/login");
  }
  return null;
}
