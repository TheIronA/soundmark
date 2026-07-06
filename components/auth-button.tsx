import Link from "next/link";
import { Button } from "./ui/button";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/lib/profile";
import { getObjectUrl } from "@/lib/storage";
import { ProfileMenu } from "./profile-menu";

export async function AuthButton() {
  const supabase = await createClient();

  // You can also use getUser() which will be slower.
  const { data } = await supabase.auth.getClaims();

  const claims = data?.claims;
  if (!claims) {
    return (
      <div className="flex gap-2">
        <Button asChild size="sm" variant={"outline"}>
          <Link href="/auth/login">Sign in</Link>
        </Button>
        <Button asChild size="sm" variant={"default"}>
          <Link href="/auth/sign-up">Sign up</Link>
        </Button>
      </div>
    );
  }

  const userId = claims.sub as string;
  const email = (claims.email as string | undefined) ?? null;

  // A missing profiles table (migration not yet applied) shouldn't take down
  // the nav on every page; fall back to no username/avatar.
  let username: string | null = null;
  let avatarUrl: string | null = null;
  try {
    const profile = await getProfile(supabase, userId);
    username = profile?.username ?? null;
    if (profile?.avatar_path) {
      avatarUrl = await getObjectUrl(supabase, profile.avatar_path);
    }
  } catch {
    // Ignore; the profile menu still works without a username/avatar.
  }

  return <ProfileMenu email={email} username={username} avatarUrl={avatarUrl} />;
}

