import { redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getObjectUrl } from "@/lib/storage";
import { bypassAuth } from "@/lib/utils";
import { PageSpinner } from "@/components/page-spinner";
import { ProfileForm } from "@/components/profile-form";

export const metadata = { title: "Profile — Soundmark" };

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSpinner />}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  if (bypassAuth) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
        <h1 className="text-xl font-bold">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Profile editing is unavailable while auth is bypassed.
        </p>
      </div>
    );
  }

  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims) redirect("/auth/login");

  const userId = claims.sub as string;
  const email = (claims.email as string | undefined) ?? null;
  const profile = await getProfile(supabase, userId);
  const avatarUrl = profile?.avatar_path
    ? await getObjectUrl(supabase, profile.avatar_path)
    : null;

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <h1 className="text-xl font-bold">Profile</h1>
      <ProfileForm
        userId={userId}
        email={email}
        initialUsername={profile?.username ?? ""}
        initialAvatarUrl={avatarUrl}
        initialAvatarPath={profile?.avatar_path ?? null}
      />
    </div>
  );
}
