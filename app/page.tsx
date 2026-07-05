import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { bypassAuth } from "@/lib/utils";

// The whole app lives under /app. Send signed-in users there and everyone
// else to the login screen. The per-request auth read lives inside a Suspense
// boundary as required by Cache Components.
export default function Home() {
  return (
    <Suspense>
      <RouteVisitor />
    </Suspense>
  );
}

async function RouteVisitor() {
  if (bypassAuth) {
    redirect("/app/timeline");
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  redirect(data?.claims ? "/app/timeline" : "/auth/login");
  return null; // unreachable; satisfies the JSX component return type
}
